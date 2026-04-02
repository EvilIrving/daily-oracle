import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDb, getCandidateStats } from '$lib/server/db';
import { deactivateSupabaseQuote, listSupabaseQuotes } from '$lib/server/supabase';

export const GET: RequestHandler = async () => {
  const db = createDb();
  const pendingStats = getCandidateStats(db);

  try {
    const quotes = await listSupabaseQuotes();
    return json({
      quotes,
      stats: {
        totalCommitted: quotes.length,
        pending: pendingStats.pending ?? 0
      }
    });
  } catch (error) {
    return json(
      {
        error: error instanceof Error ? error.message : '读取 Supabase 名句库失败。',
        quotes: [],
        stats: {
          totalCommitted: 0,
          pending: pendingStats.pending ?? 0
        }
      },
      { status: 500 }
    );
  }
};

export const DELETE: RequestHandler = async ({ request }) => {
  const payload = (await request.json()) as { quoteId?: string };
  const quoteId = String(payload.quoteId || '').trim();

  if (!quoteId) {
    return json({ error: 'quoteId 必填。' }, { status: 400 });
  }

  try {
    await deactivateSupabaseQuote(quoteId);
    return json({ quoteId });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : '删除 Supabase 名句失败。' },
      { status: 500 }
    );
  }
};
