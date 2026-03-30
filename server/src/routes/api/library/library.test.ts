import { beforeEach, describe, expect, it, vi } from 'vitest';

const createDb = vi.fn();
const getCandidateStats = vi.fn();
const deactivateSupabaseQuote = vi.fn();
const listSupabaseQuotes = vi.fn();

vi.mock('$lib/server/db', () => ({
  createDb,
  getCandidateStats
}));

vi.mock('$lib/server/supabase', () => ({
  deactivateSupabaseQuote,
  listSupabaseQuotes
}));

describe('/api/library', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns supabase quotes with local pending stats', async () => {
    createDb.mockReturnValue({});
    getCandidateStats.mockReturnValue({ pending: 2 });
    listSupabaseQuotes.mockResolvedValue([
      { id: 'q-1', text: '示例名句', mood: ['calm'], themes: ['time'] }
    ]);

    const { GET } = await import('./+server');
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      quotes: [{ id: 'q-1', text: '示例名句', mood: ['calm'], themes: ['time'] }],
      stats: {
        totalCommitted: 1,
        pending: 2
      }
    });
  });

  it('returns fallback payload on supabase read failure', async () => {
    createDb.mockReturnValue({});
    getCandidateStats.mockReturnValue({ pending: 3 });
    listSupabaseQuotes.mockRejectedValue(new Error('缺少环境变量：SUPABASE_URL'));

    const { GET } = await import('./+server');
    const response = await GET();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: '缺少环境变量：SUPABASE_URL',
      quotes: [],
      stats: {
        totalCommitted: 0,
        pending: 3
      }
    });
  });

  it('deletes a quote from supabase library', async () => {
    deactivateSupabaseQuote.mockResolvedValue({ id: 'q-1' });

    const { DELETE } = await import('./+server');
    const response = await DELETE({
      request: new Request('http://localhost/api/library', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteId: 'q-1' })
      })
    } as Parameters<typeof DELETE>[0]);

    expect(deactivateSupabaseQuote).toHaveBeenCalledWith('q-1');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ quoteId: 'q-1' });
  });
});
