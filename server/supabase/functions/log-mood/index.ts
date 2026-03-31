import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: req.headers.get('Authorization')! } },
      }
    )

    // Get user from auth
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Parse request body
    const { mood, quoteId, almanacId } = await req.json()
    const today = new Date().toISOString().split('T')[0]

    // Validate mood against enum
    const validMoods = ['calm', 'happy', 'sad', 'anxious', 'angry', 'resilient', 'romantic', 'philosophical']
    if (mood && !validMoods.includes(mood)) {
      return new Response(JSON.stringify({ error: `Invalid mood: ${mood}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Upsert today's log
    const { data: log, error: upsertError } = await supabase
      .from('user_daily_logs')
      .upsert({
        user_id: user.id,
        date: today,
        mood: mood || null,
        quote_id: quoteId || null,
        almanac_id: almanacId || null,
      })
      .select()
      .single()

    if (upsertError) {
      throw upsertError
    }

    return new Response(JSON.stringify({ log }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('log-mood error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
