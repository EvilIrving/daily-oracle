import crypto from 'node:crypto';
import type { BookMeta, ExtractionConfig, ExtractionRun, TaskStatus } from '../types';
import { chunkTextByParagraph } from './chunker';
import { createDb, createExtractionRun, updateRunStatus } from './db';
import { runExtraction } from './extractor';
import { logError, logInfo } from './logger';

type ProgressState = {
  status: TaskStatus;
  processedChunks: number;
  failedChunks: number;
  activeWorkers: number;
  totalChunks: number;
  lastError: string | null;
};

type Subscriber = (run: ExtractionRun) => void;

const subscribers = new Map<string, Set<Subscriber>>();
const activeJobs = new Map<string, Promise<void>>();

function emit(run: ExtractionRun) {
  subscribers.get(run.id)?.forEach((subscriber) => subscriber(run));
}

export function subscribeToExtraction(runId: string, subscriber: Subscriber) {
  const set = subscribers.get(runId) ?? new Set<Subscriber>();
  set.add(subscriber);
  subscribers.set(runId, set);

  return () => {
    const current = subscribers.get(runId);
    if (!current) return;
    current.delete(subscriber);
    if (current.size === 0) {
      subscribers.delete(runId);
    }
  };
}

export function startExtractionJob(input: {
  bookId: string;
  rawText: string;
  meta: BookMeta;
  config: ExtractionConfig;
}): ExtractionRun {
  const totalChunks = chunkTextByParagraph(input.rawText, input.config.chunkSize).length;
  const db = createDb();
  const run = createExtractionRun(db, {
    id: crypto.randomUUID(),
    bookId: input.bookId,
    config: input.config,
    totalChunks
  });

  emit(run);

  const task = (async () => {
    let currentRun = run;

    try {
      const workerDb = createDb();
      currentRun = await runExtraction({
        db: workerDb,
        run,
        bookId: input.bookId,
        rawText: input.rawText,
        meta: input.meta,
        config: input.config,
        onProgress: (state: ProgressState) => {
          currentRun = {
            ...currentRun,
            status: state.status,
            processedChunks: state.processedChunks,
            failedChunks: state.failedChunks,
            activeWorkers: state.activeWorkers,
            totalChunks: state.totalChunks,
            lastError: state.lastError
          };
          emit(currentRun);
        }
      });
      emit(currentRun);
    } catch (error) {
      const failedRun = {
        ...currentRun,
        status: 'error' as TaskStatus,
        lastError: error instanceof Error ? error.message : '提取失败。',
        finishedAt: new Date().toISOString(),
        activeWorkers: 0
      };
      updateRunStatus(db, run.id, {
        status: failedRun.status,
        lastError: failedRun.lastError,
        finishedAt: failedRun.finishedAt,
        activeWorkers: 0
      });
      emit(failedRun);
      logError('extraction-jobs', 'Background extraction job failed.', {
        runId: run.id,
        bookId: input.bookId,
        error
      });
    } finally {
      activeJobs.delete(run.id);
      logInfo('extraction-jobs', 'Background extraction job completed.', {
        runId: run.id,
        bookId: input.bookId
      });
    }
  })();

  activeJobs.set(run.id, task);
  return run;
}

export function isExtractionActive(runId: string) {
  return activeJobs.has(runId);
}
