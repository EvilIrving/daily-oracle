import { json } from '@sveltejs/kit';
import { getStoredConfig } from '$lib/server/config';
import {
  createDb,
  getBookById,
  getCandidateStats,
  getLatestRunByBookId,
  listCandidatesByRun,
  resetInterruptedRuns
} from '$lib/server/db';
import { runExtraction } from '$lib/server/extractor';

export async function GET({ url }) {
  const bookId = url.searchParams.get('bookId');
  if (!bookId) {
    return json({ error: 'bookId 必填。' }, { status: 400 });
  }

  const db = createDb();
  resetInterruptedRuns(db);
  const run = getLatestRunByBookId(db, bookId) ?? null;
  const candidates = run ? listCandidatesByRun(db, run.id) : [];
  const stats = getCandidateStats(db);

  return json({
    run,
    candidates,
    stats: {
      total: stats.total ?? 0,
      pending: stats.pending ?? 0,
      approved: stats.approved ?? 0,
      rejected: stats.rejected ?? 0
    }
  });
}

export async function POST({ request }) {
  const payload = (await request.json()) as { bookId?: string };
  const bookId = String(payload.bookId || '').trim();
  if (!bookId) {
    return json({ error: 'bookId 必填。' }, { status: 400 });
  }

  const db = createDb();
  const book = getBookById(db, bookId);
  if (!book) {
    return json({ error: '未找到对应书目。' }, { status: 404 });
  }

  const config = getStoredConfig();
  const run = await runExtraction({
    db,
    bookId: book.id,
    rawText: book.rawText,
    meta: book.meta,
    config
  });
  const candidates = listCandidatesByRun(db, run.id);
  const stats = getCandidateStats(db);

  return json({
    run,
    candidates,
    stats: {
      total: stats.total ?? 0,
      pending: stats.pending ?? 0,
      approved: stats.approved ?? 0,
      rejected: stats.rejected ?? 0
    }
  });
}
