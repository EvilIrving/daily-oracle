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

  logInfo('extractor', `Starting run — «${input.meta.title ?? input.bookId}» ${chunks.length} chunks × concurrency=${config.concurrency}, chunkSize=${config.chunkSize}, model=${config.model}`);

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
      const chunkT0 = Date.now();
      const controller = new AbortController();
      registerRequestController(run.id, controller);

      logInfo('extractor', `[${chunk.index + 1}/${chunks.length}] dispatching (workers=${activeWorkers}, done=${processedChunks}, failed=${failedChunks})`);

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
        const elapsed = ((Date.now() - chunkT0) / 1000).toFixed(1);
        logInfo('extractor', `[${chunk.index + 1}/${chunks.length}] ✓ ${candidates.length} quotes (${elapsed}s)`);
        if (candidates.length > 0) {
          candidates.forEach((c, i) => {
            logInfo('extractor', `  ${i + 1}. ${c.text.slice(0, 60)}${c.text.length > 60 ? '…' : ''}`);
          });
        }
      } catch (error) {
        if (isRunStopRequested(run.id)) {
          lastError = getRunStopMessage();
          logInfo('extractor', `[${chunk.index + 1}/${chunks.length}] ✗ aborted (${lastError})`);
        } else {
        const elapsed = ((Date.now() - chunkT0) / 1000).toFixed(1);
        logError('extractor', `[${chunk.index + 1}/${chunks.length}] ✗ failed (${elapsed}s): ${error instanceof Error ? error.message : String(error)}`);
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
  logInfo('extractor', `Run finished — status=${status}, processed=${processedChunks}/${chunks.length}, failed=${failedChunks}${failures.length ? `, errors=[${failures.join(' | ')}]` : ''}`);
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
