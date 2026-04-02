import { beforeEach, describe, expect, it, vi } from 'vitest';

const createDb = vi.fn();
const clearExtractionDataByBookId = vi.fn();
const deleteBookById = vi.fn();
const findBookByMeta = vi.fn();
const getBookById = vi.fn();
const getLatestRunByBookId = vi.fn();
const listBooks = vi.fn();
const upsertBook = vi.fn();
const parseTxtWithMeta = vi.fn();
const upsertSupabaseBook = vi.fn();
const ensureSupabaseBookDeletable = vi.fn();
const deleteSupabaseBook = vi.fn();

vi.mock('$lib/server/db', () => ({
  createDb,
  clearExtractionDataByBookId,
  deleteBookById,
  findBookByMeta,
  getBookById,
  getLatestRunByBookId,
  listBooks,
  upsertBook
}));

vi.mock('$lib/server/parser', () => ({
  parseTxtWithMeta
}));

vi.mock('$lib/server/supabase', () => ({
  upsertSupabaseBook,
  ensureSupabaseBookDeletable,
  deleteSupabaseBook
}));

describe('/api/books', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns persisted books on GET', async () => {
    createDb.mockReturnValue({});
    getLatestRunByBookId.mockReturnValue(undefined);
    listBooks.mockReturnValue([
      {
        id: 'book-1',
        fileName: 'demo.txt',
        meta: {
          title: '示例书',
          author: '作者',
          year: 2024,
          language: 'zh',
          genre: '小说'
        },
        supabaseBookId: 'sb-book-1',
        rawText: '正文',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z'
      }
    ]);

    const { GET } = await import('./+server');
    const response = await GET({} as Parameters<typeof GET>[0]);
    const payload = await response.json();

    expect(payload).toEqual({
      books: [
        {
          id: 'book-1',
          file_name: 'demo.txt',
          title: '示例书',
          author: '作者',
          year: 2024,
          language: 'zh',
          genre: '小说',
          supabase_book_id: 'sb-book-1',
          body_length: 2,
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-02T00:00:00.000Z',
          status: 'idle'
        }
      ]
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
    findBookByMeta.mockReturnValue(null);
    parseTxtWithMeta.mockReturnValue({
      meta: {
        title: '一九八四',
        author: '奥威尔',
        year: 1984,
        language: 'zh',
        genre: '小说'
      },
      body: '正文内容',
      header: '元数据头'
    });
    createDb.mockReturnValue({});
    upsertSupabaseBook.mockResolvedValue({ id: 'sb-book-1' });
    upsertBook.mockReturnValue({
      id: 'book-1',
      fileName: '1984.txt',
      supabaseBookId: 'sb-book-1',
      meta: {
        title: '一九八四',
        author: '奥威尔',
        year: 1984,
        language: 'zh',
        genre: '小说'
      }
    });

    const { POST } = await import('./+server');
    const response = await POST({
      request: new Request('http://localhost/api/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: '1984.txt', rawText: 'title: 一九八四\n---\n正文内容' })
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
        language: 'zh',
        genre: '小说',
        supabaseBookId: 'sb-book-1',
        bodyLength: 4
      }
    });
    expect(parseTxtWithMeta).toHaveBeenCalledWith('title: 一九八四\n---\n正文内容', '1984');
    expect(findBookByMeta).toHaveBeenCalledWith({}, {
      title: '一九八四',
      author: '奥威尔',
      year: 1984
    });
    expect(upsertSupabaseBook).toHaveBeenCalledWith({
      title: '一九八四',
      author: '奥威尔',
      year: 1984,
      genre: '小说',
      language: 'zh'
    });
    expect(upsertBook).toHaveBeenCalled();
  });

  it('rejects duplicate uploads before writing to Supabase', async () => {
    findBookByMeta.mockReturnValue({
      id: 'book-dup',
      fileName: 'existing.txt',
      supabaseBookId: 'sb-book-dup',
      meta: {
        title: '一九八四',
        author: '奥威尔',
        year: 1984,
        language: 'zh',
        genre: '小说'
      },
      rawText: '正文内容',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z'
    });
    parseTxtWithMeta.mockReturnValue({
      meta: {
        title: '一九八四',
        author: '奥威尔',
        year: 1984,
        language: 'zh',
        genre: '小说'
      },
      body: '正文内容',
      header: '元数据头'
    });
    createDb.mockReturnValue({});

    const { POST } = await import('./+server');
    const response = await POST({
      request: new Request('http://localhost/api/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: '1984.txt', rawText: 'title: 一九八四\n---\n正文内容' })
      })
    } as Parameters<typeof POST>[0]);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: '该书已上传。'
    });
    expect(upsertSupabaseBook).not.toHaveBeenCalled();
    expect(upsertBook).not.toHaveBeenCalled();
  });

  it('clears extraction results for a book on PATCH', async () => {
    createDb.mockReturnValue({});
    getBookById.mockReturnValue({
      id: 'book-1',
      fileName: '1984.txt',
      meta: {
        title: '一九八四',
        author: '奥威尔',
        year: 1984,
        language: 'zh',
        genre: '小说'
      },
      rawText: '正文内容'
    });

    const { PATCH } = await import('./+server');
    const response = await PATCH({
      request: new Request('http://localhost/api/books', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId: 'book-1', action: 'clear_results' })
      })
    } as Parameters<typeof PATCH>[0]);

    expect(clearExtractionDataByBookId).toHaveBeenCalledWith({}, 'book-1');
    await expect(response.json()).resolves.toEqual({
      ok: true,
      book: {
        id: 'book-1',
        fileName: '1984.txt',
        title: '一九八四',
        author: '奥威尔',
        year: 1984,
        language: 'zh',
        genre: '小说',
        bodyLength: 4
      }
    });
  });

  it('deletes a book on DELETE', async () => {
    createDb.mockReturnValue({});
    getBookById.mockReturnValue({
      id: 'book-1',
      fileName: '1984.txt',
      supabaseBookId: 'sb-book-1',
      meta: {
        title: '一九八四',
        author: '奥威尔',
        year: 1984,
        language: 'zh',
        genre: '小说'
      },
      rawText: '正文内容'
    });
    deleteBookById.mockReturnValue({ changes: 1 });

    const { DELETE } = await import('./+server');
    const response = await DELETE({
      url: new URL('http://localhost/api/books?bookId=book-1')
    } as Parameters<typeof DELETE>[0]);

    expect(ensureSupabaseBookDeletable).toHaveBeenCalledWith('sb-book-1');
    expect(deleteSupabaseBook).toHaveBeenCalledWith('sb-book-1');
    expect(deleteBookById).toHaveBeenCalledWith({}, 'book-1');
    await expect(response.json()).resolves.toEqual({
      ok: true,
      bookId: 'book-1'
    });
  });
});
