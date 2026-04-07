import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createAiClient, ConcurrencyControl } from './ai-client';
import { parseAiReviewDecision, parseAiReviewDecisions } from './parser';
import type { ReviewProcessConfig } from './types';
import * as db from './db';

const REVIEW_BYONE_PROMPT_PATH = join(process.cwd(), 'prompts', 'review-byone.md');
const REVIEW_BYCHUNK_PROMPT_PATH = join(process.cwd(), 'prompts', 'review-bychunk.md');

export function loadReviewByOnePrompt(): string {
  return readFileSync(REVIEW_BYONE_PROMPT_PATH, 'utf-8').trim();
}

export function loadReviewByChunkPrompt(): string {
  return readFileSync(REVIEW_BYCHUNK_PROMPT_PATH, 'utf-8').trim();
}

export interface ReviewOptions {
  extractionRunId: string;
  config: ReviewProcessConfig;
  signal?: AbortSignal;
  onProgress?: (processed: number, total: number) => void;
}

export interface ReviewResult {
  runId: string;
  status: 'completed' | 'stopped' | 'error';
  processedItems: number;
  approvedCount: number;
  rejectedCount: number;
  error?: string;
}

export async function startReview(options: ReviewOptions): Promise<ReviewResult> {
  const extractionRun = db.getExtractionRun(options.extractionRunId);
  if (!extractionRun) {
    throw new Error(`Extraction run not found: ${options.extractionRunId}`);
  }

  // 检查是否已有运行中的精筛任务
  const existingReviews = db.getReviewRunsByExtractionRunId(options.extractionRunId);
  const runningReview = existingReviews.find((r: db.ReviewRun) => r.status === 'running' || r.status === 'idle');
  if (runningReview) {
    return {
      runId: runningReview.id,
      status: 'error',
      processedItems: runningReview.processed_items,
      approvedCount: 0,
      rejectedCount: 0,
      error: '已有运行中的精筛任务'
    };
  }

  // 获取所有候选
  const candidates = db.getCandidatesByRunId(options.extractionRunId);
  if (candidates.length === 0) {
    throw new Error('No candidates found for this extraction run');
  }

  // 创建精筛批次
  const runId = randomUUID();
  db.insertReviewRun({
    id: runId,
    extraction_run_id: options.extractionRunId,
    mode: options.config.mode,
    status: 'running',
    total_items: candidates.length,
    processed_items: 0,
    config_json: JSON.stringify(options.config)
  });

  const aiClient = createAiClient(options.config.modelConfig);
  const concurrency = new ConcurrencyControl(options.config.modelConfig.concurrency);

  let approvedCount = 0;
  let rejectedCount = 0;

  if (options.config.mode === 'one-by-one') {
    // 逐条处理
    const systemPrompt = options.config.prompt || loadReviewByOnePrompt();

    let processedCount = 0;
    await Promise.allSettled(
      candidates.map((candidate: db.Candidate) =>
        concurrency.run(async () => {
          if (options.signal?.aborted) {
            throw new Error('Aborted');
          }

          const userPrompt = candidate.text;

          const response = await aiClient.call({
            systemPrompt,
            userPrompt,
            signal: options.signal
          });

          const decision = parseAiReviewDecision(response);

          if (decision) {
            const aiReviewedId = randomUUID();
            db.insertAiReviewed({
              id: aiReviewedId,
              candidate_id: candidate.id,
              review_run_id: runId,
              ai_status: decision
            });

            if (decision === 'approved') approvedCount++;
            else rejectedCount++;
          }

          processedCount++;
          db.updateReviewRunProgress(runId, processedCount);
          options.onProgress?.(processedCount, candidates.length);

          return decision;
        })
      )
    );

    // 更新最终状态
    const finalStatus = options.signal?.aborted ? 'stopped' : 'completed';
    db.updateReviewRunStatus(runId, finalStatus);

    return {
      runId,
      status: finalStatus,
      processedItems: processedCount,
      approvedCount,
      rejectedCount
    };
  } else {
    // 批量处理 (chunk-by-chunk)
    const systemPrompt = options.config.prompt || loadReviewByChunkPrompt();
    const batchSize = Math.max(1, options.config.batchSize);

    // 分批
    const batches: db.Candidate[][] = [];
    for (let i = 0; i < candidates.length; i += batchSize) {
      batches.push(candidates.slice(i, i + batchSize));
    }

    let processedCount = 0;
    await Promise.allSettled(
      batches.map((batch: db.Candidate[]) =>
        concurrency.run(async () => {
          if (options.signal?.aborted) {
            throw new Error('Aborted');
          }

          const userPrompt = buildBatchUserPrompt(batch);

          const response = await aiClient.call({
            systemPrompt,
            userPrompt,
            signal: options.signal
          });

          const decisions = parseAiReviewDecisions(response, batch.length);

          // 写入结果
          for (let i = 0; i < batch.length; i++) {
            const decision = decisions[i];
            if (decision) {
              const aiReviewedId = randomUUID();
              db.insertAiReviewed({
                id: aiReviewedId,
                candidate_id: batch[i].id,
                review_run_id: runId,
                ai_status: decision
              });

              if (decision === 'approved') approvedCount++;
              else rejectedCount++;
            }
          }

          processedCount += batch.length;
          db.updateReviewRunProgress(runId, processedCount);
          options.onProgress?.(processedCount, candidates.length);

          return decisions.length;
        })
      )
    );

    // 更新最终状态
    const finalStatus = options.signal?.aborted ? 'stopped' : 'completed';
    db.updateReviewRunStatus(runId, finalStatus);

    return {
      runId,
      status: finalStatus,
      processedItems: processedCount,
      approvedCount,
      rejectedCount
    };
  }
}

function buildBatchUserPrompt(candidates: db.Candidate[]): string {
  const items = candidates
    .map((c, i) => `${i + 1}. ${c.text}`)
    .join('\n\n');

  return `请评审以下 ${candidates.length} 个候选句子：

${items}

输出格式：["YES", "NO", "YES", ...]，其中 YES 表示收录，NO 表示拒绝。`;
}

export function stopReview(runId: string): void {
  const run = db.getReviewRun(runId);
  if (run && (run.status === 'running' || run.status === 'idle')) {
    db.updateReviewRunStatus(runId, 'stopped');
  }
}

export function getReviewProgress(runId: string): {
  run: db.ReviewRun | null;
  pending: ReturnType<typeof db.getPendingReviewItems>;
  reviewed: ReturnType<typeof db.getReviewedItems>;
} {
  const run = db.getReviewRun(runId) || null;
  const pending = run ? db.getPendingReviewItems(runId) : [];
  const reviewed = run ? db.getReviewedItems(runId) : [];
  return { run, pending, reviewed };
}

// 人工审核
export interface HumanReviewOptions {
  aiReviewedId: string;
  finalStatus: 'approved' | 'rejected';
}

export function submitHumanReview(options: HumanReviewOptions): void {
  const id = randomUUID();
  db.insertHumanReviewed({
    id,
    ai_reviewed_id: options.aiReviewedId,
    final_status: options.finalStatus
  });
}
