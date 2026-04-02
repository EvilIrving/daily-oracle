import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  createDb,
  getBookById,
  getLatestRunByBookId,
  listApprovedCandidatesByRun,
  markCandidatesCommitted
} from '$lib/server/db';
import { commitApprovedCandidates } from '$lib/server/supabase';

export const POST: RequestHandler = async ({ request }) => {
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
  if (!book.supabaseBookId) {
    return json({ error: '该书尚未绑定 Supabase 正式书目。' }, { status: 409 });
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
      candidates: approvedCandidates,
      supabaseBookId: book.supabaseBookId
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
};
