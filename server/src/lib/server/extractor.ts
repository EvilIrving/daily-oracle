import crypto from 'node:crypto';
import type Database from 'better-sqlite3';
import type { BookMeta, ExtractionConfig, ExtractionRun, TaskStatus } from '../types';
import { loadPromptTemplate, extractQuotesForChunk } from './ai-client';
import { chunkTextByParagraph } from './chunker';
import { createExtractionRun, insertCandidates, updateRunStatus } from './db';
import {
  clearRunControl,
  getRunStopMessage,
  isRunStopRequested,
  registerRequestController,
  registerRun,
  unregisterRequestController
} from './extraction-control';
import { logError, logInfo } from './logger';
import { buildQuoteCandidates } from './parser';

export async function runExtraction(input: {
  db: Database.Database;
  run?: ExtractionRun;
  runId?: string;
  bookId: string;
  rawText: string;
  meta: BookMeta;
  config: ExtractionConfig;
  onProgress?: (state: {
    status: TaskStatus;
    processedChunks: number;
    failedChunks: number;
    activeWorkers: number;
    totalChunks: number;
    lastError: string | null;
  }) => void;
}): Promise<ExtractionRun> {
  const chunks = chunkTextByParagraph(input.rawText, input.config.chunkSize);
  const config = {
    ...input.config,
    promptTemplate: input.config.promptTemplate || loadPromptTemplate()
  };

  logInfo('extractor', 'Starting extraction run.', {
    bookId: input.bookId,
    meta: input.meta,
    rawTextLength: input.rawText.length,
    chunkSize: config.chunkSize,
    concurrency: config.concurrency,
    totalChunks: chunks.length
  });

  const run =
    input.run ??
    createExtractionRun(input.db, {
      id: input.runId ?? crypto.randomUUID(),
      bookId: input.bookId,
      config,
      totalChunks: chunks.length
    });
  registerRun(run.id);

  if (chunks.length === 0) {
    const finishedAt = new Date().toISOString();
    const lastError = '未检测到可提取正文。请检查 txt 分隔符 --- 后是否有正文内容。';
    logError('extractor', 'Extraction aborted because no chunks were produced.', {
      bookId: input.bookId,
      runId: run.id,
      rawTextLength: input.rawText.length
    });
    updateRunStatus(input.db, run.id, {
      status: 'error',
      lastError,
      finishedAt
    });
    clearRunControl(run.id);
    return { ...run, status: 'error', lastError, finishedAt };
  }

  let processedChunks = 0;
  let failedChunks = 0;
  let activeWorkers = 0;
  let nextIndex = 0;
  let lastError: string | null = null;
  const failures: string[] = [];
  const workerCount = Math.min(Math.max(1, config.concurrency), chunks.length);

  updateRunStatus(input.db, run.id, { status: 'running' });

  const emit = (status: TaskStatus) => {
    input.onProgress?.({
      status,
      processedChunks,
      failedChunks,
      activeWorkers,
      totalChunks: chunks.length,
      lastError
    });
  };

  const worker = async () => {
    while (nextIndex < chunks.length) {
      if (isRunStopRequested(run.id)) {
        lastError = getRunStopMessage();
        break;
      }

      const currentIndex = nextIndex;
      nextIndex += 1;
      const chunk = chunks[currentIndex];
      activeWorkers += 1;
      const controller = new AbortController();
      registerRequestController(run.id, controller);

      logInfo('extractor', 'Dispatching chunk to AI worker.', {
        runId: run.id,
        bookId: input.bookId,
        chunkIndex: chunk.index,
        totalChunks: chunks.length,
        chunkLength: chunk.text.length,
        activeWorkers,
        processedChunks,
        failedChunks
      });

      updateRunStatus(input.db, run.id, {
        status: 'running',
        processedChunks,
        failedChunks,
        activeWorkers,
        lastError
      });
      emit('running');

      try {
        const extracted = await extractQuotesForChunk({
          config,
          chunk,
          meta: input.meta,
          totalChunks: chunks.length,
          signal: controller.signal
        });
        const candidates = buildQuoteCandidates(extracted, input.meta, chunk.index);
        insertCandidates(input.db, run.id, input.bookId, candidates);
        logInfo('extractor', 'Chunk processed successfully.', {
          runId: run.id,
          bookId: input.bookId,
          chunkIndex: chunk.index,
          extractedCount: extracted.length,
          candidateCount: candidates.length,
          candidates
        });
      } catch (error) {
        if (isRunStopRequested(run.id)) {
          lastError = getRunStopMessage();
          logInfo('extractor', 'Chunk aborted because extraction was stopped.', {
            runId: run.id,
            bookId: input.bookId,
            chunkIndex: chunk.index
          });
        } else {
        logError('extractor', 'Chunk extraction failed.', {
          runId: run.id,
          bookId: input.bookId,
          chunkIndex: chunk.index,
          totalChunks: chunks.length,
          error
        });
        failedChunks += 1;
        lastError = error instanceof Error ? error.message : String(error);
        failures.push(`第 ${chunk.index + 1} 段失败：${lastError}`);
        }
      } finally {
        unregisterRequestController(run.id, controller);
        processedChunks += 1;
        activeWorkers = Math.max(0, activeWorkers - 1);
        updateRunStatus(input.db, run.id, {
          status: isRunStopRequested(run.id) ? 'stopped' : 'running',
          processedChunks,
          failedChunks,
          activeWorkers,
          lastError
        });
        emit(isRunStopRequested(run.id) ? 'stopped' : 'running');
      }
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  const status: TaskStatus = isRunStopRequested(run.id) ? 'stopped' : failures.length ? 'partial' : 'done';
  const finishedAt = new Date().toISOString();
  logInfo('extractor', 'Extraction run finished.', {
    runId: run.id,
    bookId: input.bookId,
    status,
    processedChunks,
    failedChunks,
    lastError,
    finishedAt,
    failures
  });
  updateRunStatus(input.db, run.id, {
    status,
    processedChunks,
    failedChunks,
    activeWorkers: 0,
    lastError,
    finishedAt
  });
  emit(status);
  clearRunControl(run.id);

  return {
    ...run,
    status,
    processedChunks,
    failedChunks,
    activeWorkers: 0,
    lastError,
    finishedAt
  };
}
