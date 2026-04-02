import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  createDb,
  getCandidateStats,
  getBookById,
  getLatestRunByBookId,
  listCandidatesByRun,
  updateRunStatus
} from '$lib/server/db';
import { getRunStopMessage, requestRunStop } from '$lib/server/extraction-control';
import { startExtractionJob, subscribeToExtraction } from '$lib/server/extraction-jobs';
import { logError, logInfo } from '$lib/server/logger';
import type { ExtractionConfig } from '$lib/types';

function normalizeRequestConfig(input: Partial<ExtractionConfig> | null | undefined): ExtractionConfig {
  const fallback: ExtractionConfig = {
    apiBaseUrl: '',
    apiKey: '',
    model: '',
    chunkSize: 3000,
    concurrency: 1,
    temperature: 0.2,
    topP: 0.9,
    promptTemplate: ''
  };
  const next = input || {};
  const toFiniteInt = (value: unknown, defaultValue: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.floor(parsed) : defaultValue;
  };
  const toFiniteNumber = (value: unknown, defaultValue: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : defaultValue;
  };

  return {
    apiBaseUrl: String(next.apiBaseUrl ?? fallback.apiBaseUrl),
    apiKey: String(next.apiKey ?? fallback.apiKey),
    model: String(next.model ?? fallback.model),
    chunkSize: toFiniteInt(next.chunkSize, fallback.chunkSize),
    concurrency: toFiniteInt(next.concurrency, fallback.concurrency),
    temperature: toFiniteNumber(next.temperature, fallback.temperature),
    topP: toFiniteNumber(next.topP, fallback.topP),
    promptTemplate: String(next.promptTemplate ?? fallback.promptTemplate)
  };
}

function normalizeRun(run: any) {
  if (!run) return null;

  return {
    id: run.id,
    bookId: run.bookId ?? run.book_id,
    status: run.status,
    totalChunks: run.totalChunks ?? run.total_chunks ?? 0,
    processedChunks: run.processedChunks ?? run.processed_chunks ?? 0,
    failedChunks: run.failedChunks ?? run.failed_chunks ?? 0,
    activeWorkers: run.activeWorkers ?? run.active_workers ?? 0,
    lastError: run.lastError ?? run.last_error ?? null,
    model: run.model,
    chunkSize: run.chunkSize ?? run.chunk_size ?? 0,
    concurrency: run.concurrency,
    temperature: run.temperature,
    promptSnapshot: run.promptSnapshot ?? run.prompt_snapshot ?? '',
    startedAt: run.startedAt ?? run.started_at ?? null,
    finishedAt: run.finishedAt ?? run.finished_at ?? null
  };
}

function getExtractionPayload(db: ReturnType<typeof createDb>, bookId: string) {
  const run = normalizeRun(getLatestRunByBookId(db, bookId) ?? null);
  const candidates = run ? listCandidatesByRun(db, run.id) : [];
  const stats = getCandidateStats(db);

  return {
    run,
    candidates,
    stats: {
      total: stats.total ?? 0,
      pending: stats.pending ?? 0,
      approved: stats.approved ?? 0,
      rejected: stats.rejected ?? 0
    }
  };
}

export const GET: RequestHandler = async ({ url }) => {
  const bookId = url.searchParams.get('bookId');
  if (!bookId) {
    return json({ error: 'bookId 必填。' }, { status: 400 });
  }

  const db = createDb();
  const wantsStream =
    url.searchParams.get('stream') === '1' || url.searchParams.get('stream') === 'true';
  const payload = getExtractionPayload(db, bookId);

  if (!wantsStream) {
    return json(payload);
  }

  const runId = payload.run?.id;
  const encoder = new TextEncoder();
  let streamUnsubscribe = () => {};

  return new Response(
    new ReadableStream({
      start(controller) {
        let unsubscribe = () => {};
        streamUnsubscribe = unsubscribe;
        let closed = false;
        const close = () => {
          if (closed) return;
          closed = true;
          unsubscribe();
          streamUnsubscribe = () => {};
          try {
            controller.close();
          } catch {}
        };
        const send = (data: unknown) => {
          if (closed) return false;

          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            return true;
          } catch {
            close();
            return false;
          }
        };

        if (!send(payload)) return;

        if (!runId || !['queued', 'running'].includes(String(payload.run?.status || ''))) {
          close();
          return;
        }

        unsubscribe = subscribeToExtraction(runId, (run) => {
          streamUnsubscribe = unsubscribe;
          const nextDb = createDb();
          const nextPayload = getExtractionPayload(nextDb, bookId);
          const ok = send({
            ...nextPayload,
            run: normalizeRun(run)
          });

          if (!ok || !['queued', 'running'].includes(run.status)) {
            close();
          }
        });

        if (!closed) {
          try {
            controller.enqueue(encoder.encode(': connected\n\n'));
          } catch {
            close();
          }
        }
      },
      cancel() {
        streamUnsubscribe();
        streamUnsubscribe = () => {};
      }
    }),
    {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
      }
    }
  );
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    const requestPayload = (await request.json()) as {
      bookId?: string;
      config?: Partial<ExtractionConfig>;
    };
    const bookId = String(requestPayload.bookId || '').trim();
    logInfo('api/extract', 'Received extraction request.', { bookId });
    if (!bookId) {
      logError('api/extract', 'Rejected extraction request because bookId is missing.');
      return json({ error: 'bookId 必填。' }, { status: 400 });
    }
    const config = normalizeRequestConfig(requestPayload.config);
    if (!config.apiBaseUrl.trim() || !config.apiKey.trim() || !config.model.trim()) {
      return json({ error: '缺少提取配置，请先在当前浏览器配置提供商。' }, { status: 400 });
    }

    const db = createDb();
    const book = getBookById(db, bookId);
    if (!book) {
      logError('api/extract', 'Extraction request references a missing book.', { bookId });
      return json({ error: '未找到对应书目。' }, { status: 404 });
    }

    const latestRun = normalizeRun(getLatestRunByBookId(db, book.id) ?? null);
    if (latestRun && ['queued', 'running'].includes(latestRun.status)) {
      return json(
        {
          error: '当前书目已有提取任务在运行。',
          run: latestRun
        },
        { status: 409 }
      );
    }

    logInfo('api/extract', 'Loaded extraction config for run.', {
      bookId: book.id,
      model: config.model,
      apiBaseUrl: config.apiBaseUrl,
      chunkSize: config.chunkSize,
      concurrency: config.concurrency,
      temperature: config.temperature,
      topP: config.topP,
      promptTemplateLength: config.promptTemplate?.length ?? 0
    });
    const run = startExtractionJob({
      bookId: book.id,
      rawText: book.rawText,
      meta: book.meta,
      config
    });

    logInfo('api/extract', 'Extraction job started.', {
      bookId: book.id,
      runId: run.id,
      status: run.status,
      totalChunks: run.totalChunks
    });

    const nextDb = createDb();
    const responsePayload = getExtractionPayload(nextDb, book.id);
    return json({ ...responsePayload, run }, { status: 202 });
  } catch (error) {
    logError('api/extract', 'POST /api/extract failed.', { error });
    return json(
      {
        error: error instanceof Error ? error.message : '提取失败。'
      },
      { status: 500 }
    );
  }
};

export const PATCH: RequestHandler = async ({ request }) => {
  try {
    const payload = (await request.json()) as { bookId?: string; runId?: string };
    const db = createDb();
    const bookId = String(payload.bookId || '').trim();
    const requestedRunId = String(payload.runId || '').trim();
    const latestRun = bookId ? getLatestRunByBookId(db, bookId) : null;
    const run = requestedRunId && latestRun?.id === requestedRunId ? latestRun : latestRun;

    if (!run) {
      return json({ error: '当前没有可停止的提取任务。' }, { status: 404 });
    }

    if (!['queued', 'running'].includes(String(run.status))) {
      return json({ error: '当前批次不在运行中。' }, { status: 400 });
    }

    requestRunStop(run.id);
    updateRunStatus(db, run.id, {
      status: 'stopped',
      lastError: getRunStopMessage(),
      activeWorkers: 0,
      finishedAt: new Date().toISOString()
    });

    logInfo('api/extract', 'Stop requested for extraction run.', {
      bookId: run.bookId,
      runId: run.id
    });

    return json({
      run: normalizeRun({
        ...run,
        status: 'stopped',
        activeWorkers: 0,
        lastError: getRunStopMessage(),
        finishedAt: new Date().toISOString()
      })
    });
  } catch (error) {
    logError('api/extract', 'PATCH /api/extract failed.', { error });
    return json(
      {
        error: error instanceof Error ? error.message : '停止提取失败。'
      },
      { status: 500 }
    );
  }
};
