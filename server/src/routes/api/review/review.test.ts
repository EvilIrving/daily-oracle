import { beforeEach, describe, expect, it, vi } from 'vitest';

const createDb = vi.fn();
const getCandidateById = vi.fn();
const updateCandidateReviewStatus = vi.fn();

vi.mock('$lib/server/db', () => ({
  createDb,
  getCandidateById,
  updateCandidateReviewStatus
}));

describe('/api/review', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('validates status on PATCH', async () => {
    const { PATCH } = await import('./+server');
    const response = await PATCH({
      request: new Request('http://localhost/api/review', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId: 'c-1', status: 'committed' })
      })
    } as Parameters<typeof PATCH>[0]);

    expect(response.status).toBe(400);
  });

  it('updates candidate review status', async () => {
    createDb.mockReturnValue({});
    getCandidateById
      .mockReturnValueOnce({ id: 'c-1', reviewStatus: 'pending' })
      .mockReturnValueOnce({ id: 'c-1', reviewStatus: 'approved' });

    const { PATCH } = await import('./+server');
    const response = await PATCH({
      request: new Request('http://localhost/api/review', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId: 'c-1', status: 'approved' })
      })
    } as Parameters<typeof PATCH>[0]);

    expect(updateCandidateReviewStatus).toHaveBeenCalledWith({}, 'c-1', 'approved');
    await expect(response.json()).resolves.toEqual({
      candidate: { id: 'c-1', reviewStatus: 'approved' }
    });
  });
});
