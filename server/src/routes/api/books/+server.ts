import crypto from 'node:crypto';
import { json } from '@sveltejs/kit';
import { createDb, upsertBook } from '$lib/server/db';
import { parseTxtWithMeta } from '$lib/server/parser';

export async function GET() {
  const db = createDb();
  const books = db
    .prepare(`
      select id, file_name, title, author, year, language, genre, created_at, updated_at
      from books
      order by updated_at desc
    `)
    .all();

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
