import { createClient } from '@supabase/supabase-js';
import type { QuoteCandidateRecord } from '../types';
import { requireServerEnv } from './env';

export function createSupabaseReadClient() {
  const url = requireServerEnv('SUPABASE_URL');
  const key = requireServerEnv('PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEY');

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export function createSupabaseServiceClient() {
  const url = requireServerEnv('SUPABASE_URL');
  const key = requireServerEnv('SUPABASE_SERVICE_ROLE_KEY', 'SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY');

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
    .select('id, text, author, work, genre, mood, themes, reviewed_at')
    .eq('is_active', true)
    .order('reviewed_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function listSupabaseAlmanac(limit = 30) {
  const client = createSupabaseReadClient();
  const { data, error } = await client
    .from('almanac_entries')
    .select('id, date, yi, ji, signals, created_at')
    .order('date', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function commitApprovedCandidates(input: {
  runId: string;
  candidates: QuoteCandidateRecord[];
  modelConfig: Record<string, unknown>;
  bookTitle: string;
  bookAuthor: string | null;
  bookYear: number | null;
  bookGenre: string | null;
  sourceLang: string | null;
}) {
  if (!input.candidates.length) {
    throw new Error('没有可提交的已通过候选。');
  }

  const client = createSupabaseServiceClient();
  const { data: batch, error: batchError } = await client
    .from('extraction_batches')
    .insert({
      book_title: input.bookTitle,
      book_author: input.bookAuthor,
      book_year: input.bookYear,
      book_genre: input.bookGenre,
      source_lang: input.sourceLang,
      total_chunks: 0,
      done_chunks: 0,
      failed_chunks: 0,
      extracted_count: input.candidates.length,
      accepted_count: input.candidates.length,
      rejected_count: 0,
      model_config: input.modelConfig,
      status: 'done'
    })
    .select('id')
    .single();

  if (batchError || !batch) {
    throw batchError ?? new Error('创建 extraction_batches 失败。');
  }

  const { error: quoteError } = await client.from('quotes').insert(
    input.candidates.map((candidate) => ({
      text: candidate.text,
      lang: candidate.lang,
      author: candidate.author,
      work: candidate.work,
      year: candidate.year,
      genre: candidate.genre,
      mood: candidate.moods,
      themes: candidate.themes,
      source_book: candidate.sourceBook,
      batch_id: batch.id
    }))
  );

  if (quoteError) throw quoteError;

  return { batchId: batch.id, insertedCount: input.candidates.length };
}
