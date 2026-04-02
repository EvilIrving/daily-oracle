import { createClient } from '@supabase/supabase-js';
import type { QuoteCandidateRecord } from '../types';
import { requireServerEnv } from './env';
import { deriveBookLang, sanitizeQuoteMoods } from './parser';

export function createSupabaseReadClient() {
  const url = requireServerEnv('SUPABASE_URL');
  const key = requireServerEnv('PUBLISHABLE_KEY');

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export function createSupabaseServiceClient() {
  const url = requireServerEnv('SUPABASE_URL');
  const key = requireServerEnv('SERVICE_SECRET_KEY');

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export async function listSupabaseQuotes(limit = 100) {
  const client = createSupabaseReadClient();
  const { data, error } = await client
    .from('quotes')
    .select('id, text, mood, themes, reviewed_at, book:books!inner(title, author, year, genre)')
    .eq('is_active', true)
    .order('reviewed_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  type JoinedBook = {
    title: string | null;
    author: string | null;
    year: number | null;
    genre: string | null;
  };

  return (data ?? []).map((row) => {
    const joinedBook = Array.isArray(row.book) ? row.book[0] : (row.book as JoinedBook | null | undefined);

    return {
      id: row.id,
      text: row.text,
      author: joinedBook?.author ?? null,
      work: joinedBook?.title ?? null,
      year: joinedBook?.year ?? null,
      genre: joinedBook?.genre ?? null,
      mood: row.mood ?? [],
      themes: row.themes ?? [],
      reviewed_at: row.reviewed_at
    };
  });
}

export async function deactivateSupabaseQuote(quoteId: string) {
  const client = createSupabaseServiceClient();
  const { data, error } = await client
    .from('quotes')
    .update({ is_active: false })
    .eq('id', quoteId)
    .eq('is_active', true)
    .select('id')
    .single();

  if (error) throw error;
  if (!data) throw new Error('未找到可删除的名句。');

  return data;
}

export async function listSupabaseAlmanac(limit = 30) {
  const client = createSupabaseReadClient();
  const { data, error } = await client
    .from('almanac')
    .select('id, date, yi, ji, signals, created_at')
    .order('date', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function upsertSupabaseBook(input: {
  title: string;
  author: string | null;
  year: number | null;
  genre: string | null;
  language: string | null;
}) {
  const client = createSupabaseServiceClient();
  const language = String(input.language || '').trim();
  const payload = {
    title: input.title,
    author: input.author,
    year: input.year,
    genre: input.genre,
    lang: deriveBookLang(input.language),
    source_label: language || null
  };

  // The unique index uses coalesce(author,'') and coalesce(year,0),
  // so standard upsert onConflict doesn't match. Query-then-insert instead.
  let query = client
    .from('books')
    .select('id')
    .eq('title', payload.title);

  if (payload.author) {
    query = query.eq('author', payload.author);
  } else {
    query = query.is('author', null);
  }
  if (payload.year) {
    query = query.eq('year', payload.year);
  } else {
    query = query.is('year', null);
  }

  const { data: existing } = await query.limit(1).maybeSingle();

  let data: { id: string } | null;
  let error: any;

  if (existing) {
    ({ data, error } = await client
      .from('books')
      .update(payload)
      .eq('id', existing.id)
      .select('id')
      .single());
  } else {
    ({ data, error } = await client
      .from('books')
      .insert(payload)
      .select('id')
      .single());
  }

  if (error || !data) throw error ?? new Error('写入 Supabase books 失败。');
  return data;
}

export async function ensureSupabaseBookDeletable(bookId: string) {
  const client = createSupabaseServiceClient();
  const { count, error } = await client
    .from('quotes')
    .select('id', { head: true, count: 'exact' })
    .eq('book_id', bookId);

  if (error) throw error;
  if ((count ?? 0) > 0) {
    throw new Error('该书已有已审核名句，不能删除。');
  }
}

export async function deleteSupabaseBook(bookId: string) {
  const client = createSupabaseServiceClient();
  const { data, error } = await client.from('books').delete().eq('id', bookId).select('id').single();

  // PGRST116 = 0 rows — already deleted, treat as success
  if (error && error.code !== 'PGRST116') throw error;
  return data ?? null;
}

/** 写入 Supabase `quotes`；书级元数据在 `books`，不重复存（见 server/supabase/schema.sql）。 */
export async function commitApprovedCandidates(input: {
  candidates: QuoteCandidateRecord[];
  supabaseBookId: string;
}) {
  if (!input.candidates.length) {
    throw new Error('没有可提交的已通过候选。');
  }

  const client = createSupabaseServiceClient();

  const { error: quoteError } = await client.from('quotes').insert(
    input.candidates.map((candidate) => ({
      book_id: input.supabaseBookId,
      text: candidate.text,
      mood: sanitizeQuoteMoods(candidate.moods),
      themes: candidate.themes ?? []
    }))
  );

  if (quoteError) throw quoteError;

  return { insertedCount: input.candidates.length };
}
