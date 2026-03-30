import { json } from '@sveltejs/kit';
import { listSupabaseAlmanac } from '$lib/server/supabase';

export async function GET() {
  try {
    const entries = await listSupabaseAlmanac();
    return json({
      today: entries[0] ?? null,
      history: entries.slice(1)
    });
  } catch (error) {
    return json(
      {
        error: error instanceof Error ? error.message : '读取 Supabase 宜忌失败。',
        today: null,
        history: []
      },
      { status: 500 }
    );
  }
}
