import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  createDb,
  listBooks,
  getBookById,
  deleteBookById,
  clearPromptLabResultsByBookId,
  listPromptLabResultsByBookId,
  insertPromptLabResult,
  type PromptLabResult
} from '$lib/server/db';
import { logError, logInfo } from '$lib/server/logger';

function formatFileSize(size: number): string {
  if (size < 1024) return `${size}B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}KB`;
  return `${(size / (1024 * 1024)).toFixed(1)}MB`;
}

export const GET: RequestHandler = async ({ url }) => {
  const db = createDb();

  // 获取单书详情（含 raw_text）
  const bookId = url.searchParams.get('bookId');
  if (bookId) {
    const book = getBookById(db, bookId);
    if (!book) {
      return json({ error: '未找到对应书目。' }, { status: 404 });
    }
    return json({
      book: {
        id: book.id,
        file_name: book.fileName,
        title: book.meta.title,
        author: book.meta.author,
        year: book.meta.year,
        language: book.meta.language,
        genre: book.meta.genre,
        body_length: book.rawText.length,
        size_label: formatFileSize(book.rawText.length)
      },
      rawText: book.rawText
    });
  }

  // 获取书籍列表
  const books = listBooks(db).map((book) => ({
    id: book.id,
    file_name: book.fileName,
    title: book.meta.title,
    author: book.meta.author,
    year: book.meta.year,
    language: book.meta.language,
    genre: book.meta.genre,
    body_length: book.rawText.length,
    created_at: book.createdAt,
    updated_at: book.updatedAt
  }));

  return json({ books });
};

export const POST: RequestHandler = async ({ request }) => {
  const payload = (await request.json()) as {
    action?: string;
    bookId?: string;
  };

  // 获取书籍结果
  if (payload.action === 'get_results' && payload.bookId) {
    const db = createDb();
    const book = getBookById(db, payload.bookId);
    if (!book) {
      return json({ error: '未找到对应书目。' }, { status: 404 });
    }
    const results = listPromptLabResultsByBookId(db, payload.bookId);
    return json({
      book: {
        id: book.id,
        title: book.meta.title,
        author: book.meta.author
      },
      results: results.map(r => ({
        candidateText: r.candidateText,
        reviewRaw: r.reviewRaw,
        reviewPassed: r.reviewPassed,
        chunkIndex: r.chunkIndex
      }))
    });
  }

  return json({ error: '不支持的操作。' }, { status: 400 });
};

export const PATCH: RequestHandler = async ({ request }) => {
  const payload = (await request.json()) as {
    bookId?: string;
    action?: string;
    results?: Array<{
      candidateText: string;
      reviewRaw: string | null;
      reviewPassed: boolean | null;
      chunkIndex: number;
    }>;
  };

  const bookId = String(payload.bookId || '').trim();
  if (!bookId) {
    return json({ error: 'bookId 必填。' }, { status: 400 });
  }

  if (payload.action === 'clear_results') {
    clearPromptLabResultsByBookId(createDb(), bookId);

    const db = createDb();
    const book = getBookById(db, bookId);
    if (!book) {
      return json({ error: '未找到对应书目。' }, { status: 404 });
    }
    return json({
      ok: true,
      book: {
        id: book.id,
        fileName: book.fileName,
        title: book.meta.title,
        author: book.meta.author,
        year: book.meta.year,
        language: book.meta.language,
        genre: book.meta.genre,
        bodyLength: book.rawText.length
      }
    });
  }

  if (payload.action === 'save_results') {
    const db = createDb();
    const book = getBookById(db, bookId);
    if (!book) {
      return json({ error: '未找到对应书目。' }, { status: 404 });
    }

    // 先清空旧结果
    clearPromptLabResultsByBookId(db, bookId);

    // 插入新结果
    const results: PromptLabResult[] = [];
    for (const r of payload.results || []) {
      const result = insertPromptLabResult(db, {
        bookId,
        candidateText: r.candidateText,
        reviewRaw: r.reviewRaw,
        reviewPassed: r.reviewPassed,
        chunkIndex: r.chunkIndex
      });
      results.push(result);
    }

    return json({
      ok: true,
      savedCount: results.length,
      bookId
    });
  }

  return json({ error: '不支持的操作。' }, { status: 400 });
};

export const DELETE: RequestHandler = async ({ url }) => {
  const bookId = String(url.searchParams.get('bookId') || '').trim();
  if (!bookId) {
    return json({ error: 'bookId 必填。' }, { status: 400 });
  }

  const db = createDb();
  const book = getBookById(db, bookId);
  if (!book) {
    return json({ error: '未找到对应书目。' }, { status: 404 });
  }

  deleteBookById(db, bookId);

  return json({ ok: true, bookId });
};
