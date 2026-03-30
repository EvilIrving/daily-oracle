import { beforeEach, describe, expect, it, vi } from 'vitest';

const listSupabaseAlmanac = vi.fn();

vi.mock('$lib/server/supabase', () => ({
  listSupabaseAlmanac
}));

describe('/api/almanac', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns latest item as today and the rest as history', async () => {
    listSupabaseAlmanac.mockResolvedValue([
      { id: 'a-2', date: '2026-03-30', yi: '宜静', ji: '忌躁', signals: {} },
      { id: 'a-1', date: '2026-03-29', yi: '宜读', ji: '忌急', signals: {} }
    ]);

    const { GET } = await import('./+server');
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      today: { id: 'a-2', date: '2026-03-30', yi: '宜静', ji: '忌躁', signals: {} },
      history: [{ id: 'a-1', date: '2026-03-29', yi: '宜读', ji: '忌急', signals: {} }]
    });
  });

  it('returns fallback payload on supabase read failure', async () => {
    listSupabaseAlmanac.mockRejectedValue(new Error('缺少环境变量：PUBLISHABLE_KEY'));

    const { GET } = await import('./+server');
    const response = await GET();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: '缺少环境变量：PUBLISHABLE_KEY',
      today: null,
      history: []
    });
  });
});
