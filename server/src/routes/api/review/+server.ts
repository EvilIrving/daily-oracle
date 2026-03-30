import { json } from '@sveltejs/kit';
import { createDb, getCandidateById, updateCandidateReviewStatus } from '$lib/server/db';
import type { ReviewStatus } from '$lib/types';

const ALLOWED_STATUS = new Set<ReviewStatus>(['pending', 'approved', 'rejected']);

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

  const nextStatus = status as Exclude<ReviewStatus, 'committed'>;
  updateCandidateReviewStatus(db, candidateId, nextStatus);

  return json({
    candidate: getCandidateById(db, candidateId)
  });
}
