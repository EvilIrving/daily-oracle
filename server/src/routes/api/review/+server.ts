import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  createDb,
  deleteCandidateById,
  getBookById,
  getCandidateById,
  insertReviewLog,
  markCandidatesCommitted,
  updateCandidateReviewStatus
} from '$lib/server/db';
import { logError } from '$lib/server/logger';
import { verifyQuoteExistsInBook } from '$lib/server/quote-verifier';
import { commitApprovedCandidates } from '$lib/server/supabase';
import type { ReviewStatus } from '$lib/types';

const ALLOWED_STATUS = new Set<ReviewStatus>(['approved', 'rejected']);

export const PATCH: RequestHandler = async ({ request }) => {
  const payload = (await request.json()) as {
    candidateId?: string;
    status?: ReviewStatus;
  };

  const candidateId = String(payload.candidateId || '').trim();
  const status = payload.status;

  if (!candidateId || !status || !ALLOWED_STATUS.has(status)) {
    return json({ error: 'candidateId 和合法 status 必填。' }, { status: 400 });
  }

  const db = createDb();
  const candidate = getCandidateById(db, candidateId);
  if (!candidate) {
    return json({ error: '未找到候选。' }, { status: 404 });
  }

  const book = getBookById(db, candidate.bookId);

  if (status === 'rejected') {
    insertReviewLog(db, candidate, 'rejected', book?.meta.title ?? null);
    updateCandidateReviewStatus(db, candidateId, 'rejected');
    deleteCandidateById(db, candidateId);

    return json({
      candidateId,
      action: 'rejected'
    });
  }
  if (!book) {
    return json({ error: '未找到候选所属书目。' }, { status: 404 });
  }
  if (!book.supabaseBookId) {
    return json({ error: '该书尚未绑定 Supabase 正式书目。' }, { status: 409 });
  }

  const verification = verifyQuoteExistsInBook(book.rawText, candidate.text, book.meta.title);
  if (!verification.valid) {
    logError('review', 'Rejected candidate approval because the quote does not exist in source text.', {
      candidateId,
      runId: candidate.runId,
      bookId: candidate.bookId,
      reason: verification.reason,
      quoteText: candidate.text
    });

    return json(
      {
        error: verification.reason
      },
      { status: 409 }
    );
  }

  updateCandidateReviewStatus(db, candidateId, 'approved');

  try {
    const result = await commitApprovedCandidates({
      candidates: [{ ...candidate, reviewStatus: 'approved', reviewedAt: new Date().toISOString() }],
      supabaseBookId: book.supabaseBookId
    });

    insertReviewLog(db, candidate, 'accepted', book.meta.title);
    markCandidatesCommitted(db, [candidateId]);

    return json({
      candidateId,
      action: 'approved',
      insertedCount: result.insertedCount
    });
  } catch (error) {
    logError('review', 'Failed to commit approved candidate to Supabase.', {
      candidateId,
      runId: candidate.runId,
      bookId: candidate.bookId,
      error
    });
    updateCandidateReviewStatus(db, candidateId, 'pending');

    return json(
      {
        error: error instanceof Error ? error.message : '收录到 Supabase 失败。'
      },
      { status: 500 }
    );
  }
};
