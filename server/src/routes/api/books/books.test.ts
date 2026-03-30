import { beforeEach, describe, expect, it, vi } from 'vitest';

const createDb = vi.fn();
const upsertBook = vi.fn();
const parseTxtWithMeta = vi.fn();

vi.mock('$lib/server/db', () => ({
  createDb,
  upsertBook
}));

vi.mock('$lib/server/parser', () => ({
  parseTxtWithMeta
}));

describe('/api/books', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns persisted books on GET', async () => {
    createDb.mockReturnValue({
      prepare: vi.fn(() => ({
        all: vi.fn(() => [{ id: 'book-1', title: '示例书' }])
      }))
    });

    const { GET } = await import('./+server');
    const response = await GET();
    const payload = await response.json();

    expect(payload).toEqual({
      books: [{ id: 'book-1', title: '示例书' }]
    });
  });

  it('validates required payload on POST', async () => {
    const { POST } = await import('./+server');
    const response = await POST({
      request: new Request('http://localhost/api/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: '', rawText: '' })
      })
    } as Parameters<typeof POST>[0]);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'fileName 和 rawText 必填。'
    });
  });

  it('parses txt metadata and returns stored book summary', async () => {
    parseTxtWithMeta.mockReturnValue({
      meta: {
        title: '一九八四',
        author: '奥威尔',
        year: 1984,
        language: '中文',
        genre: '小说'
      },
      body: '正文内容',
      header: '元数据头'
    });
    createDb.mockReturnValue({});
    upsertBook.mockReturnValue({
      id: 'book-1',
      fileName: '1984.txt',
      meta: {
        title: '一九八四',
        author: '奥威尔',
        year: 1984,
        language: '中文',
        genre: '小说'
      }
    });

    const { POST } = await import('./+server');
    const response = await POST({
      request: new Request('http://localhost/api/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: '1984.txt', rawText: '书名：一九八四\n---\n正文内容' })
      })
    } as Parameters<typeof POST>[0]);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      book: {
        id: 'book-1',
        fileName: '1984.txt',
        title: '一九八四',
        author: '奥威尔',
        year: 1984,
        language: '中文',
        genre: '小说',
        bodyLength: 4
      }
    });
    expect(parseTxtWithMeta).toHaveBeenCalledWith('书名：一九八四\n---\n正文内容', '1984');
    expect(upsertBook).toHaveBeenCalled();
  });
});
