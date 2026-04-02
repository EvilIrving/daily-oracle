import { beforeEach, describe, expect, it, vi } from 'vitest';

const createDb = vi.fn();
const deleteCandidateById = vi.fn();
const getBookById = vi.fn();
const getCandidateById = vi.fn();
const insertReviewLog = vi.fn();
const markCandidatesCommitted = vi.fn();
const updateCandidateReviewStatus = vi.fn();
const commitApprovedCandidates = vi.fn();
const verifyQuoteExistsInBook = vi.fn();

vi.mock('$lib/server/db', () => ({
  createDb,
  deleteCandidateById,
  getBookById,
  getCandidateById,
  insertReviewLog,
  markCandidatesCommitted,
  updateCandidateReviewStatus
}));

vi.mock('$lib/server/supabase', () => ({
  commitApprovedCandidates
}));

vi.mock('$lib/server/quote-verifier', () => ({
  verifyQuoteExistsInBook
}));

describe('/api/review', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyQuoteExistsInBook.mockReturnValue({ valid: true });
  });

  it('validates status on PATCH', async () => {
    const { PATCH } = await import('./+server');
    const response = await PATCH({
      request: new Request('http://localhost/api/review', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId: 'c-1', status: 'pending' })
      })
    } as Parameters<typeof PATCH>[0]);

    expect(response.status).toBe(400);
  });

  it('rejects and removes candidate immediately', async () => {
    createDb.mockReturnValue({});
    getCandidateById.mockReturnValue({ id: 'c-1', bookId: 'b-1', runId: 'r-1', reviewStatus: 'pending' });

    const { PATCH } = await import('./+server');
    const response = await PATCH({
      request: new Request('http://localhost/api/review', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId: 'c-1', status: 'rejected' })
      })
    } as Parameters<typeof PATCH>[0]);

    expect(updateCandidateReviewStatus).toHaveBeenCalledWith({}, 'c-1', 'rejected');
    expect(deleteCandidateById).toHaveBeenCalledWith({}, 'c-1');
    await expect(response.json()).resolves.toEqual({
      candidateId: 'c-1',
      action: 'rejected'
    });
  });

  it('commits approved candidate immediately', async () => {
    createDb.mockReturnValue({});
    const candidate = {
      id: 'c-1',
      runId: 'r-1',
      bookId: 'b-1',
      text: '示例名句',
      lang: 'zh',
      author: '作者',
      work: '作品',
      year: 2024,
      genre: '小说',
      moods: ['calm'],
      themes: ['time'],
      sourceBook: '作品',
      chunkIndex: 0,
      normalizedText: '示例名句',
      reviewStatus: 'pending',
      reviewedAt: null,
      committedAt: null,
      createdAt: '2026-03-30T00:00:00.000Z'
    };
    getCandidateById.mockReturnValue(candidate);
    getBookById.mockReturnValue({
      id: 'b-1',
      fileName: 'book.txt',
      meta: {
        title: '作品',
        author: '作者',
        year: 2024,
        language: 'zh',
        genre: '小说'
      },
      supabaseBookId: 'sb-book-1',
      rawText: '正文',
      createdAt: '2026-03-30T00:00:00.000Z',
      updatedAt: '2026-03-30T00:00:00.000Z'
    });
    commitApprovedCandidates.mockResolvedValue({ insertedCount: 1 });

    const { PATCH } = await import('./+server');
    const response = await PATCH({
      request: new Request('http://localhost/api/review', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId: 'c-1', status: 'approved' })
      })
    } as Parameters<typeof PATCH>[0]);

    expect(updateCandidateReviewStatus).toHaveBeenCalledWith({}, 'c-1', 'approved');
    expect(verifyQuoteExistsInBook).toHaveBeenCalledWith('正文', '示例名句', '作品');
    expect(commitApprovedCandidates).toHaveBeenCalledWith({
      candidates: [expect.objectContaining({ id: 'c-1', reviewStatus: 'approved' })],
      supabaseBookId: 'sb-book-1'
    });
    expect(markCandidatesCommitted).toHaveBeenCalledWith({}, ['c-1']);
    await expect(response.json()).resolves.toEqual({
      candidateId: 'c-1',
      action: 'approved',
      insertedCount: 1
    });
  });

  it('rejects approval when quote is not found in source text', async () => {
    createDb.mockReturnValue({});
    getCandidateById.mockReturnValue({
      id: 'c-1',
      runId: 'r-1',
      bookId: 'b-1',
      text: '不存在的句子',
      reviewStatus: 'pending'
    });
    getBookById.mockReturnValue({
      id: 'b-1',
      fileName: 'book.txt',
      meta: {
        title: '作品',
        author: '作者',
        year: 2024,
        language: 'zh',
        genre: '小说'
      },
      supabaseBookId: 'sb-book-1',
      rawText: '正文',
      createdAt: '2026-03-30T00:00:00.000Z',
      updatedAt: '2026-03-30T00:00:00.000Z'
    });
    verifyQuoteExistsInBook.mockReturnValue({
      valid: false,
      normalizedQuote: '不存在的句子',
      normalizedBody: '正文',
      reason: '原始正文中未找到这句原文，疑似 AI 编造或改写过度，不能收录。'
    });

    const { PATCH } = await import('./+server');
    const response = await PATCH({
      request: new Request('http://localhost/api/review', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId: 'c-1', status: 'approved' })
      })
    } as Parameters<typeof PATCH>[0]);

    expect(updateCandidateReviewStatus).not.toHaveBeenCalledWith({}, 'c-1', 'approved');
    expect(commitApprovedCandidates).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      error: '原始正文中未找到这句原文，疑似 AI 编造或改写过度，不能收录。'
    });
    expect(response.status).toBe(409);
  });
});
