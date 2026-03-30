import { json } from '@sveltejs/kit';
import { getStoredConfig } from '$lib/server/config';
import {
  createDb,
  deleteCandidateById,
  getBookById,
  getCandidateById,
  markCandidatesCommitted,
  updateCandidateReviewStatus
} from '$lib/server/db';
import { logError } from '$lib/server/logger';
import { verifyQuoteExistsInBook } from '$lib/server/quote-verifier';
import { commitApprovedCandidates } from '$lib/server/supabase';
import type { ReviewStatus } from '$lib/types';

const ALLOWED_STATUS = new Set<ReviewStatus>(['approved', 'rejected']);

export async function PATCH({ request }) {
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

  if (status === 'rejected') {
    updateCandidateReviewStatus(db, candidateId, 'rejected');
    deleteCandidateById(db, candidateId);

    return json({
      candidateId,
      action: 'rejected'
    });
  }

  const book = getBookById(db, candidate.bookId);
  if (!book) {
    return json({ error: '未找到候选所属书目。' }, { status: 404 });
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
      runId: candidate.runId,
      candidates: [{ ...candidate, reviewStatus: 'approved', reviewedAt: new Date().toISOString() }],
      modelConfig: getStoredConfig(),
      bookTitle: book.meta.title,
      bookAuthor: book.meta.author,
      bookYear: book.meta.year,
      bookGenre: book.meta.genre,
      sourceLang: book.meta.language
    });

    markCandidatesCommitted(db, [candidateId]);

    return json({
      candidateId,
      action: 'approved',
      insertedCount: result.insertedCount,
      batchId: result.batchId
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
}
