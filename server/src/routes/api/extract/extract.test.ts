import { beforeEach, describe, expect, it, vi } from 'vitest';

const createDb = vi.fn();
const getBookById = vi.fn();
const getCandidateStats = vi.fn();
const getLatestRunByBookId = vi.fn();
const listCandidatesByRun = vi.fn();
const resetInterruptedRuns = vi.fn();
const getStoredConfig = vi.fn();
const runExtraction = vi.fn();

vi.mock('$lib/server/db', () => ({
  createDb,
  getBookById,
  getCandidateStats,
  getLatestRunByBookId,
  listCandidatesByRun,
  resetInterruptedRuns
}));

vi.mock('$lib/server/config', () => ({
  getStoredConfig
}));

vi.mock('$lib/server/extractor', () => ({
  runExtraction
}));

describe('/api/extract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns latest run on GET', async () => {
    createDb.mockReturnValue({});
    getLatestRunByBookId.mockReturnValue({ id: 'run-1', status: 'done' });
    listCandidatesByRun.mockReturnValue([{ id: 'candidate-1' }]);
    getCandidateStats.mockReturnValue({ total: 1, pending: 1, approved: 0, rejected: 0 });

    const { GET } = await import('./+server');
    const response = await GET({
      url: new URL('http://localhost/api/extract?bookId=book-1')
    } as Parameters<typeof GET>[0]);

    await expect(response.json()).resolves.toEqual({
      run: { id: 'run-1', status: 'done' },
      candidates: [{ id: 'candidate-1' }],
      stats: { total: 1, pending: 1, approved: 0, rejected: 0 }
    });
  });

  it('runs extraction on POST', async () => {
    createDb.mockReturnValue({});
    getBookById.mockReturnValue({
      id: 'book-1',
      rawText: '正文',
      meta: { title: '示例书', author: '作者', year: 2024, language: '中文', genre: '小说' }
    });
    getStoredConfig.mockReturnValue({ model: 'glm' });
    runExtraction.mockResolvedValue({ id: 'run-1', status: 'done' });
    listCandidatesByRun.mockReturnValue([{ id: 'candidate-1' }]);
    getCandidateStats.mockReturnValue({ total: 1, pending: 1, approved: 0, rejected: 0 });

    const { POST } = await import('./+server');
    const response = await POST({
      request: new Request('http://localhost/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId: 'book-1' })
      })
    } as Parameters<typeof POST>[0]);

    expect(runExtraction).toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      run: { id: 'run-1', status: 'done' },
      candidates: [{ id: 'candidate-1' }],
      stats: { total: 1, pending: 1, approved: 0, rejected: 0 }
    });
  });
});
