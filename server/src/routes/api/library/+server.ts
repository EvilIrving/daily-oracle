import { json } from '@sveltejs/kit';
import { createDb, getCandidateStats } from '$lib/server/db';
import { listSupabaseQuotes } from '$lib/server/supabase';

export async function GET() {
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
}
