import crypto from 'node:crypto';
import { json } from '@sveltejs/kit';
import { clearExtractionDataByBookId, createDb, deleteBookById, getBookById, listBooks, upsertBook } from '$lib/server/db';
import { parseTxtWithMeta } from '$lib/server/parser';

export async function GET() {
  const db = createDb();
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
}

export async function POST({ request }) {
  const payload = (await request.json()) as {
    fileName?: string;
    rawText?: string;
  };

  const fileName = String(payload.fileName || '').trim();
  const rawText = String(payload.rawText || '');

  if (!fileName || !rawText.trim()) {
    return json({ error: 'fileName 和 rawText 必填。' }, { status: 400 });
  }

  const parsed = parseTxtWithMeta(rawText, fileName.replace(/\.txt$/i, ''));
  const db = createDb();
  const record = upsertBook(db, {
    id: crypto.randomUUID(),
    fileName,
    meta: parsed.meta,
    rawText: parsed.body
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
      bodyLength: parsed.body.length
    }
  });
}

export async function PATCH({ request }) {
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
}

export async function DELETE({ url }) {
  const bookId = String(url.searchParams.get('bookId') || '').trim();
  if (!bookId) {
    return json({ error: 'bookId 必填。' }, { status: 400 });
  }

  const db = createDb();
  const result = deleteBookById(db, bookId);
  if (!result.changes) {
    return json({ error: '未找到对应书目。' }, { status: 404 });
  }

  return json({ ok: true, bookId });
}
