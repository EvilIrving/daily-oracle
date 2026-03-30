import { json } from '@sveltejs/kit';
import { getStoredConfig } from '$lib/server/config';
import {
  createDb,
  getBookById,
  getLatestRunByBookId,
  listApprovedCandidatesByRun,
  markCandidatesCommitted
} from '$lib/server/db';
import { commitApprovedCandidates } from '$lib/server/supabase';

export async function POST({ request }) {
  const payload = (await request.json()) as { bookId?: string; runId?: string };
  const bookId = String(payload.bookId || '').trim();
  const runId = String(payload.runId || '').trim();

  if (!bookId || !runId) {
    return json({ error: 'bookId 和 runId 必填。' }, { status: 400 });
  }

  const db = createDb();
  const book = getBookById(db, bookId);
  if (!book) {
    return json({ error: '未找到对应书目。' }, { status: 404 });
  }

  const latestRun = getLatestRunByBookId(db, bookId);
  if (!latestRun || latestRun.id !== runId) {
    return json({ error: 'runId 无效或不是当前批次。' }, { status: 400 });
  }

  const approvedCandidates = listApprovedCandidatesByRun(db, runId);
  if (!approvedCandidates.length) {
    return json({ error: '当前没有已通过候选可入库。' }, { status: 400 });
  }

  try {
    const result = await commitApprovedCandidates({
      runId,
      candidates: approvedCandidates,
      modelConfig: getStoredConfig(),
      bookTitle: book.meta.title,
      bookAuthor: book.meta.author,
      bookYear: book.meta.year,
      bookGenre: book.meta.genre,
      sourceLang: book.meta.language
    });

    markCandidatesCommitted(
      db,
      approvedCandidates.map((candidate) => candidate.id)
    );

    return json(result);
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : 'Supabase 提交失败。' },
      { status: 500 }
    );
  }
}
