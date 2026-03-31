import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27.0'
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
    const { weather, temperature, moodHistory, anniversaries } = await req.json()

    // Fetch user's recent mood history (last 7 days)
    const { data: recentLogs } = await supabase
      .from('user_daily_logs')
      .select('date, mood, quote_id')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(7)

    // Fetch user's anniversaries
    const { data: userAnniversaries } = await supabase
      .from('anniversaries')
      .select('name, date')
      .eq('user_id', user.id)

    // Build prompt for LLM
    const today = new Date().toISOString().split('T')[0]
    const prompt = buildAlmanacPrompt({
      date: today,
      weather,
      temperature,
      moodHistory: recentLogs || [],
      anniversaries: userAnniversaries || [],
    })

    // Call LLM via Anthropic SDK
    const anthropic = new Anthropic({
      apiKey: Deno.env.get('ANTHROPIC_API_KEY') ?? '',
      baseURL: Deno.env.get('ANTHROPIC_BASE_URL') || undefined,
    })

    const model = Deno.env.get('MODEL') || 'claude-opus-4-6'

    const response = await anthropic.messages.create({
      model,
      max_tokens: 512,
      temperature: 0.7,
      messages: [{ role: 'user', content: prompt }],
    })

    const content = response.content[0].type === 'text' ? response.content[0].text : ''

    // Parse 宜/忌 from response (expecting format: "宜：XXX\n忌：XXX")
    const { yi, ji } = parseYiJi(content)

    if (!yi || !ji) {
      throw new Error('Failed to parse 宜忌 from LLM response')
    }

    // Save to almanac_entries
    const { data: entry, error: saveError } = await supabase
      .from('almanac_entries')
      .insert({
        date: today,
        yi,
        ji,
        signals: {
          weather,
          temperature,
          mood_count: recentLogs?.length || 0,
          anniversary_count: userAnniversaries?.length || 0,
        },
        model_used: model,
      })
      .select()
      .single()

    if (saveError) {
      // Check if already exists for today (concurrent request)
      const { data: existing } = await supabase
        .from('almanac_entries')
        .select('id, yi, ji')
        .eq('date', today)
        .single()

      if (existing) {
        return new Response(JSON.stringify({ almanac: existing }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      throw saveError
    }

    return new Response(JSON.stringify({ almanac: entry }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('generate-almanac error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

function buildAlmanacPrompt(ctx: {
  date: string
  weather?: string
  temperature?: string
  moodHistory: Array<{ date: string; mood?: string | null }>
  anniversaries: Array<{ name: string; date: string }>
}): string {
  const lines = [
    '你是一位中国传统黄历生成器。请根据以下信息，生成今日"宜"和"忌"各一条。',
    '',
    `日期：${ctx.date}`,
  ]

  if (ctx.weather) {
    lines.push(`天气：${ctx.weather}`)
  }
  if (ctx.temperature) {
    lines.push(`温度：${ctx.temperature}°C`)
  }

  if (ctx.moodHistory.length > 0) {
    const moodSummary = ctx.moodHistory
      .map(l => `${l.date}: ${l.mood || '未记录'}`)
      .join('\n')
    lines.push('', '近 7 日心情记录：', moodSummary)
  }

  if (ctx.anniversaries.length > 0) {
    const anniversaryList = ctx.anniversaries
      .map(a => `${a.name} (${a.date})`)
      .join('\n')
    lines.push('', '临近纪念日：', anniversaryList)
  }

  lines.push(
    '',
    '要求：',
    '- 宜：一条适合今日做的积极事项（20 字以内）',
    '- 忌：一条今日应避免的消极事项（20 字以内）',
    '- 结合天气、心情、纪念日等上下文，让内容更有温度',
    '- 不要解释，直接输出格式：',
    '宜：XXX',
    '忌：XXX',
  )

  return lines.join('\n')
}

function parseYiJi(content: string): { yi?: string; ji?: string } {
  const yiMatch = content.match(/宜 [:：]\s*(.+?)(?:\n|$)/)
  const jiMatch = content.match(/忌 [:：]\s*(.+?)(?:\n|$)/)

  return {
    yi: yiMatch?.[1]?.trim(),
    ji: jiMatch?.[1]?.trim(),
  }
}
