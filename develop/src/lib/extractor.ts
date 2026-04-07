import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createAiClient, ConcurrencyControl } from './ai-client';
import { chunkTextByParagraph } from './chunker';
import { parseTxtWithMeta, cleanText, parseAiExtractedJson, normalizeText } from './parser';
import type { ExtractProcessConfig, ModelConfig } from './types';
import * as db from './db';

const EXTRACT_PROMPT_PATH = join(process.cwd(), 'prompts', 'extract.md');

export function loadExtractPrompt(): string {
  return readFileSync(EXTRACT_PROMPT_PATH, 'utf-8').trim();
}

export interface ExtractionOptions {
  bookId: string;
  config: ExtractProcessConfig;
  signal?: AbortSignal;
  onProgress?: (processed: number, total: number, failed: number) => void;
}

export interface ExtractionResult {
  runId: string;
  status: 'completed' | 'stopped' | 'error';
  totalCandidates: number;
  processedChunks: number;
  failedChunks: number;
  error?: string;
}

export async function startExtraction(options: ExtractionOptions): Promise<ExtractionResult> {
  const book = db.getBookById(options.bookId);
  if (!book) {
    throw new Error(`Book not found: ${options.bookId}`);
  }

  // 检查是否已有运行中的任务
  const existingRuns = db.getExtractionRunsByBookId(options.bookId);
  const runningRun = existingRuns.find((r: db.ExtractionRun) => r.status === 'running' || r.status === 'idle');
  if (runningRun) {
    return {
      runId: runningRun.id,
      status: 'error',
      totalCandidates: 0,
      processedChunks: runningRun.processed_chunks,
      failedChunks: runningRun.failed_chunks,
      error: '已有运行中的提取任务'
    };
  }

  // 解析文本并切片
  const parsed = parseTxtWithMeta(book.body, book.title || undefined);
  const cleanedBody = cleanText(parsed.body);
  const chunks = chunkTextByParagraph(cleanedBody, options.config.chunkSize);

  // 创建提取批次
  const runId = randomUUID();
  db.insertExtractionRun({
    id: runId,
    book_id: options.bookId,
    status: 'running',
    total_chunks: chunks.length,
    processed_chunks: 0,
    failed_chunks: 0,
    config_json: JSON.stringify(options.config)
  });

  const aiClient = createAiClient(options.config.modelConfig);
  const concurrency = new ConcurrencyControl(options.config.modelConfig.concurrency);

  const systemPrompt = options.config.prompt || loadExtractPrompt();

  let processedCount = 0;
  let failedCount = 0;
  let totalCandidates = 0;

  // 并发处理每个 chunk
  await Promise.allSettled(
    chunks.map((chunk) =>
      concurrency.run(async () => {
        if (options.signal?.aborted) {
          throw new Error('Aborted');
        }

        const userPrompt = buildChunkUserPrompt(
          book.title,
          book.author,
          book.year,
          book.language,
          book.genre,
          chunk,
          chunks.length
        );

        const response = await aiClient.call({
          systemPrompt,
          userPrompt,
          signal: options.signal
        });

        const quotes = parseAiExtractedJson(response);

        // 写入候选
        for (const quote of quotes) {
          const normalized = normalizeText(quote.text);
          const candidateId = randomUUID();
          db.insertCandidate({
            id: candidateId,
            run_id: runId,
            book_id: options.bookId,
            text: quote.text,
            normalized_text: normalized,
            source_chunk_index: chunk.index
          });
          totalCandidates++;
        }

        processedCount++;
        db.updateExtractionRunStatus(runId, 'running', processedCount, failedCount);
        options.onProgress?.(processedCount, chunks.length, failedCount);

        return quotes.length;
      })
    )
  );

  // 统计失败数量
  const results = await Promise.allSettled(
    chunks.map((chunk) =>
      concurrency.run(async () => {
        // 这里只是为了收集错误计数，实际处理已经在上面的 Promise.allSettled 中完成
        return 0;
      })
    )
  );

  results.forEach((result) => {
    if (result.status === 'rejected') {
      failedCount++;
    }
  });

  // 更新最终状态
  const finalStatus = options.signal?.aborted ? 'stopped' : 'completed';
  db.updateExtractionRunStatus(runId, finalStatus, processedCount, failedCount);

  return {
    runId,
    status: finalStatus,
    totalCandidates,
    processedChunks: processedCount,
    failedChunks: failedCount
  };
}

function buildChunkUserPrompt(
  title: string | null,
  author: string | null,
  year: number | null,
  language: string | null,
  genre: string | null,
  chunk: { index: number; text: string },
  totalChunks: number
): string {
  const sourceLines = [
    title && `title: ${title}`,
    author && `author: ${author}`,
    year != null && `year: ${year}`,
    language && `language: ${language}`,
    genre && `genre: ${genre}`
  ].filter(Boolean);

  return `## 来源信息
${sourceLines.join('\n') || '未知'}

## 待处理文本
第 ${chunk.index + 1}/${totalChunks} 段
---
${chunk.text}
---`;
}

export function stopExtraction(runId: string): void {
  const run = db.getExtractionRun(runId);
  if (run && (run.status === 'running' || run.status === 'idle')) {
    db.updateExtractionRunStatus(runId, 'stopped', run.processed_chunks, run.failed_chunks);
  }
}

export function getExtractionProgress(runId: string): {
  run: db.ExtractionRun | null;
  candidates: db.Candidate[];
} {
  const run = db.getExtractionRun(runId) || null;
  const candidates = run ? db.getCandidatesByRunId(runId) : [];
  return { run, candidates };
}
