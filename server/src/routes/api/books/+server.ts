import crypto from 'node:crypto';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { clearExtractionDataByBookId, createDb, deleteBookById, findBookByMeta, getBookById, getLatestRunByBookId, listBooks, upsertBook } from '$lib/server/db';
import { logError, logInfo } from '$lib/server/logger';
import { parseTxtWithMeta } from '$lib/server/parser';
import { deleteSupabaseBook, ensureSupabaseBookDeletable, upsertSupabaseBook } from '$lib/server/supabase';
import type { TaskStatus } from '$lib/types';

function getBookStatus(db: ReturnType<typeof createDb>, bookId: string): TaskStatus {
  const run = getLatestRunByBookId(db, bookId) as any;
  if (!run) return 'idle';
  return run.status as TaskStatus;
}

export const GET: RequestHandler = async () => {
  const db = createDb();
  const books = listBooks(db).map((book) => {
    const status = getBookStatus(db, book.id);
    return {
      id: book.id,
      file_name: book.fileName,
      title: book.meta.title,
      author: book.meta.author,
      year: book.meta.year,
          language: book.meta.language,
          genre: book.meta.genre,
          supabase_book_id: book.supabaseBookId,
          body_length: book.rawText.length,
          created_at: book.createdAt,
          updated_at: book.updatedAt,
      status
    };
  });

  return json({ books });
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    const payload = (await request.json()) as {
      fileName?: string;
      rawText?: string;
    };

    const fileName = String(payload.fileName || '').trim();
    const rawText = String(payload.rawText || '');

    logInfo('api/books', 'Received book upload request.', {
      fileName,
      rawTextLength: rawText.length
    });

    if (!fileName || !rawText.trim()) {
      logError('api/books', 'Rejected book upload because required fields are missing.', {
        fileName,
        rawTextLength: rawText.length
      });
      return json({ error: 'fileName 和 rawText 必填。' }, { status: 400 });
    }

    const parsed = parseTxtWithMeta(rawText, fileName.replace(/\.txt$/i, ''));
    logInfo('api/books', 'Parsed txt metadata and body.', {
      fileName,
      meta: parsed.meta,
      header: parsed.header,
      bodyLength: parsed.body.length,
      bodyPreview: parsed.body.slice(0, 500)
    });

    const db = createDb();
    const existingBook = findBookByMeta(db, {
      title: parsed.meta.title,
      author: parsed.meta.author,
      year: parsed.meta.year
    });
    if (existingBook) {
      logInfo('api/books', 'Rejected duplicate book upload.', {
        fileName,
        title: parsed.meta.title,
        author: parsed.meta.author,
        year: parsed.meta.year,
        existingBookId: existingBook.id,
        existingSupabaseBookId: existingBook.supabaseBookId
      });
      return json({ error: '该书已上传。' }, { status: 409 });
    }

    const supabaseBook = await upsertSupabaseBook({
      title: parsed.meta.title,
      author: parsed.meta.author,
      year: parsed.meta.year,
      genre: parsed.meta.genre,
      language: parsed.meta.language
    });
    const record = upsertBook(db, {
      id: crypto.randomUUID(),
      fileName,
      supabaseBookId: supabaseBook.id,
      meta: parsed.meta,
      rawText: parsed.body
    });

    logInfo('api/books', 'Stored uploaded book in local workspace queue.', {
      bookId: record.id,
      fileName: record.fileName,
      meta: record.meta,
      bodyLength: parsed.body.length
    });

    return json({
      book: {
        id: record.id,
        fileName: record.fileName,
        title: record.meta.title,
        author: record.meta.author,
        year: record.meta.year,
        language: record.meta.language,
        genre: record.meta.genre,
        supabaseBookId: record.supabaseBookId,
        bodyLength: parsed.body.length
      }
    });
  } catch (error) {
    logError('api/books', 'POST /api/books failed.', { error });
    return json(
      {
        error: error instanceof Error ? error.message : (error as any)?.message || '上传书籍失败。'
      },
      { status: 500 }
    );
  }
};

export const PATCH: RequestHandler = async ({ request }) => {
  const payload = (await request.json()) as {
    bookId?: string;
    action?: string;
  };

  const bookId = String(payload.bookId || '').trim();
  if (!bookId) {
    return json({ error: 'bookId 必填。' }, { status: 400 });
  }

  if (payload.action !== 'clear_results') {
    return json({ error: '不支持的 books 操作。' }, { status: 400 });
  }

  const db = createDb();
  const book = getBookById(db, bookId);
  if (!book) {
    return json({ error: '未找到对应书目。' }, { status: 404 });
  }

  clearExtractionDataByBookId(db, bookId);

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

  if (book.supabaseBookId) {
    await ensureSupabaseBookDeletable(book.supabaseBookId);
    await deleteSupabaseBook(book.supabaseBookId);
  }

  const result = deleteBookById(db, bookId);
  if (!result.changes) {
    return json({ error: '未找到对应书目。' }, { status: 404 });
  }

  return json({ ok: true, bookId });
};
