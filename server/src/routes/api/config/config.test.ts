import { beforeEach, describe, expect, it, vi } from 'vitest';

const getStoredConfig = vi.fn();
const saveStoredConfig = vi.fn();

vi.mock('$lib/server/config', () => ({
  getStoredConfig,
  saveStoredConfig
}));

describe('/api/config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns current config on GET', async () => {
    getStoredConfig.mockReturnValue({
      model: 'glm-4.7',
      chunkSize: 3000
    });

    const { GET } = await import('./+server');
    const response = await GET();

    await expect(response.json()).resolves.toEqual({
      config: {
        model: 'glm-4.7',
        chunkSize: 3000
      }
    });
  });

  it('persists config payload on POST', async () => {
    saveStoredConfig.mockReturnValue({
      model: 'qwen',
      chunkSize: 4096
    });

    const { POST } = await import('./+server');
    const response = await POST({
      request: new Request('http://localhost/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'qwen', chunkSize: 4096 })
      })
    } as Parameters<typeof POST>[0]);

    await expect(response.json()).resolves.toEqual({
      config: {
        model: 'qwen',
        chunkSize: 4096
      }
    });
    expect(saveStoredConfig).toHaveBeenCalledWith({ model: 'qwen', chunkSize: 4096 });
  });
});
