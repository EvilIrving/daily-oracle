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

    // Parse query params
    const url = new URL(req.url)
    const mood = url.searchParams.get('mood')
    const themes = url.searchParams.get('themes')?.split(',')

    // Build query - mood filtering with optional theme scoring
    let query = supabase
      .from('quotes')
      .select('id, text, lang, author, work, year, genre, mood, themes')
      .eq('is_active', true)

    // Filter by mood if provided
    if (mood) {
      query = query.contains('mood', [mood])
    }

    const { data: quotes, error: queryError } = await query.limit(10)

    if (queryError) {
      throw queryError
    }

    if (!quotes || quotes.length === 0) {
      // Fallback: random active quote
      const { data: fallback, error: fallbackError } = await supabase
        .from('quotes')
        .select('id, text, lang, author, work, year, genre, mood, themes')
        .eq('is_active', true)
        .order('random()')
        .limit(1)
        .single()

      if (fallbackError) {
        throw fallbackError
      }

      return new Response(JSON.stringify({ quote: fallback }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Simple theme scoring if themes provided
    let selectedQuote = quotes[0]
    if (themes && themes.length > 0) {
      const scored = quotes.map(q => {
        const score = themes.reduce((acc, t) => {
          return acc + (q.themes?.includes(t) ? 1 : 0)
        }, 0)
        return { quote: q, score }
      })
      scored.sort((a, b) => b.score - a.score)
      selectedQuote = scored[0].score > 0 ? scored[0].quote : quotes[Math.floor(Math.random() * quotes.length)]
    } else {
      selectedQuote = quotes[Math.floor(Math.random() * quotes.length)]
    }

    return new Response(JSON.stringify({ quote: selectedQuote }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('daily-quote error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
