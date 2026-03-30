import crypto from 'node:crypto';
import type Database from 'better-sqlite3';
import type { BookMeta, ExtractionConfig, ExtractionRun, TaskStatus } from '../types';
import { loadPromptTemplate, extractQuotesForChunk } from './ai-client';
import { chunkTextByParagraph } from './chunker';
import { createExtractionRun, insertCandidates, updateRunStatus } from './db';
import { buildQuoteCandidates } from './parser';

export async function runExtraction(input: {
  db: Database.Database;
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

  const run = createExtractionRun(input.db, {
    id: input.runId ?? crypto.randomUUID(),
    bookId: input.bookId,
    config,
    totalChunks: chunks.length
  });

  if (chunks.length === 0) {
    const finishedAt = new Date().toISOString();
    updateRunStatus(input.db, run.id, {
      status: 'error',
      lastError: '正文为空，无法切片。',
      finishedAt
    });
    return { ...run, status: 'error', lastError: '正文为空，无法切片。', finishedAt };
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
      const currentIndex = nextIndex;
      nextIndex += 1;
      const chunk = chunks[currentIndex];
      activeWorkers += 1;

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
          totalChunks: chunks.length
        });
        const candidates = buildQuoteCandidates(extracted, input.meta, chunk.index);
        insertCandidates(input.db, run.id, input.bookId, candidates);
      } catch (error) {
        failedChunks += 1;
        lastError = error instanceof Error ? error.message : String(error);
        failures.push(`第 ${chunk.index + 1} 段失败：${lastError}`);
      } finally {
        processedChunks += 1;
        activeWorkers = Math.max(0, activeWorkers - 1);
        updateRunStatus(input.db, run.id, {
          status: 'running',
          processedChunks,
          failedChunks,
          activeWorkers,
          lastError
        });
        emit('running');
      }
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  const status: TaskStatus = failures.length ? 'partial' : 'done';
  const finishedAt = new Date().toISOString();
  updateRunStatus(input.db, run.id, {
    status,
    processedChunks,
    failedChunks,
    activeWorkers: 0,
    lastError,
    finishedAt
  });
  emit(status);

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
