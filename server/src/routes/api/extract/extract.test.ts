import { beforeEach, describe, expect, it, vi } from 'vitest';

const createDb = vi.fn();
const getBookById = vi.fn();
const getCandidateStats = vi.fn();
const getLatestRunByBookId = vi.fn();
const listCandidatesByRun = vi.fn();
const updateRunStatus = vi.fn();
const requestRunStop = vi.fn();
const getRunStopMessage = vi.fn(() => '提取已停止。');
const startExtractionJob = vi.fn();

vi.mock('$lib/server/db', () => ({
  createDb,
  getBookById,
  getCandidateStats,
  getLatestRunByBookId,
  listCandidatesByRun,
  updateRunStatus
}));

vi.mock('$lib/server/extraction-control', () => ({
  requestRunStop,
  getRunStopMessage
}));

vi.mock('$lib/server/extraction-jobs', () => ({
  startExtractionJob,
  subscribeToExtraction: vi.fn()
}));

describe('/api/extract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns latest run on GET', async () => {
    createDb.mockReturnValue({});
    getLatestRunByBookId.mockReturnValue({ id: 'run-1', status: 'done', total_chunks: 1 });
    listCandidatesByRun.mockReturnValue([{ id: 'candidate-1' }]);
    getCandidateStats.mockReturnValue({ total: 1, pending: 1, approved: 0, rejected: 0 });

    const { GET } = await import('./+server');
    const response = await GET({
      url: new URL('http://localhost/api/extract?bookId=book-1')
    } as Parameters<typeof GET>[0]);

    await expect(response.json()).resolves.toEqual({
      run: expect.objectContaining({ id: 'run-1', status: 'done', totalChunks: 1 }),
      candidates: [{ id: 'candidate-1' }],
      stats: { total: 1, pending: 1, approved: 0, rejected: 0 }
    });
  });

  it('starts extraction in background on POST', async () => {
    createDb.mockReturnValue({});
    getBookById.mockReturnValue({
      id: 'book-1',
      rawText: '正文',
      meta: { title: '示例书', author: '作者', year: 2024, language: 'zh', genre: '小说' }
    });
    getLatestRunByBookId.mockReturnValue(null);
    startExtractionJob.mockReturnValue({
      id: 'run-1',
      bookId: 'book-1',
      status: 'queued',
      totalChunks: 3,
      processedChunks: 0,
      failedChunks: 0,
      activeWorkers: 0,
      lastError: null,
      model: 'glm',
      chunkSize: 3000,
      concurrency: 3,
      temperature: 0.3,
      promptSnapshot: '',
      startedAt: '2024-01-01T00:00:00.000Z',
      finishedAt: null
    });
    listCandidatesByRun.mockReturnValue([]);
    getCandidateStats.mockReturnValue({ total: 0, pending: 0, approved: 0, rejected: 0 });

    const { POST } = await import('./+server');
    const response = await POST({
      request: new Request('http://localhost/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId: 'book-1',
          config: {
            apiBaseUrl: 'https://example.com',
            apiKey: 'key',
            model: 'glm'
          }
        })
      })
    } as Parameters<typeof POST>[0]);

    expect(startExtractionJob).toHaveBeenCalled();
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      run: expect.objectContaining({
        id: 'run-1',
        status: 'queued',
        totalChunks: 3
      }),
      candidates: [],
      stats: { total: 0, pending: 0, approved: 0, rejected: 0 }
    });
  });

  it('stops the latest running extraction on PATCH', async () => {
    createDb.mockReturnValue({});
    getLatestRunByBookId.mockReturnValue({
      id: 'run-1',
      bookId: 'book-1',
      status: 'running',
      activeWorkers: 2
    });

    const { PATCH } = await import('./+server');
    const response = await PATCH({
      request: new Request('http://localhost/api/extract', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId: 'book-1', runId: 'run-1' })
      })
    } as Parameters<typeof PATCH>[0]);

    expect(requestRunStop).toHaveBeenCalledWith('run-1');
    expect(updateRunStatus).toHaveBeenCalledWith(
      {},
      'run-1',
      expect.objectContaining({
        status: 'stopped',
        activeWorkers: 0,
        lastError: '提取已停止。'
      })
    );
    await expect(response.json()).resolves.toEqual({
      run: expect.objectContaining({
        id: 'run-1',
        status: 'stopped',
        activeWorkers: 0,
        lastError: '提取已停止。'
      })
    });
  });
});
