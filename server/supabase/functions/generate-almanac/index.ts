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
    const { lat, lon } = await req.json()
    const latitude = parseCoordinate(lat, 'lat')
    const longitude = parseCoordinate(lon, 'lon')

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

    // Fetch weather on the server side so the app only passes coordinates.
    const weather = await fetchCurrentWeather(latitude, longitude)

    // Build prompt for LLM
    const today = new Date().toISOString().split('T')[0]
    const prompt = buildAlmanacPrompt({
      date: today,
      weather: weather.text,
      temperature: weather.temp,
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
          weather: weather.text,
          temperature: weather.temp,
          weather_icon: weather.icon,
          weather_raw: weather.raw,
          location: {
            lat: latitude,
            lon: longitude,
          },
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

    return new Response(JSON.stringify({ almanac: entry, weather }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('generate-almanac error:', error)
    return new Response(JSON.stringify({ error: getErrorMessage(error) }), {
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

function parseCoordinate(value: unknown, field: 'lat' | 'lon'): number {
  const parsed = typeof value === 'number' ? value : Number(value)

  if (!Number.isFinite(parsed)) {
    throw new Error(`Missing or invalid ${field}`)
  }

  if (field === 'lat' && (parsed < -90 || parsed > 90)) {
    throw new Error('lat must be between -90 and 90')
  }

  if (field === 'lon' && (parsed < -180 || parsed > 180)) {
    throw new Error('lon must be between -180 and 180')
  }

  return parsed
}

type CurrentWeather = {
  text: string
  temp: string
  icon: string
  raw: Record<string, unknown>
}

async function fetchCurrentWeather(lat: number, lon: number): Promise<CurrentWeather> {
  const apiHost = Deno.env.get('QWEATHER_API_HOST')
  const projectId = Deno.env.get('QWEATHER_PROJECT_ID')
  const keyId = Deno.env.get('QWEATHER_KEY_ID')
  const privateKey = Deno.env.get('QWEATHER_PRIVATE_KEY')

  if (!apiHost || !projectId || !keyId || !privateKey) {
    throw new Error('Missing QWeather configuration')
  }

  const jwt = await signQWeatherJWT({
    projectId,
    keyId,
    privateKeyPem: privateKey,
  })

  const weatherRes = await fetch(
    `https://${apiHost}/v7/weather/now?location=${lon},${lat}`,
    {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    },
  )

  if (!weatherRes.ok) {
    const errorText = await weatherRes.text()
    throw new Error(`QWeather request failed: ${weatherRes.status} ${errorText}`)
  }

  const weatherJson = await weatherRes.json()
  const now = weatherJson?.now

  if (!now?.text || !now?.temp || !now?.icon) {
    throw new Error('QWeather response missing required fields')
  }

  return {
    text: String(now.text),
    temp: String(now.temp),
    icon: String(now.icon),
    raw: weatherJson,
  }
}

async function signQWeatherJWT(config: {
  projectId: string
  keyId: string
  privateKeyPem: string
}): Promise<string> {
  const encoder = new TextEncoder()
  const iat = Math.floor(Date.now() / 1000) - 30
  const exp = iat + 900

  const header = {
    alg: 'EdDSA',
    kid: config.keyId,
  }

  const payload = {
    sub: config.projectId,
    iat,
    exp,
  }

  const encodedHeader = base64UrlEncode(encoder.encode(JSON.stringify(header)))
  const encodedPayload = base64UrlEncode(encoder.encode(JSON.stringify(payload)))
  const signingInput = `${encodedHeader}.${encodedPayload}`

  const cryptoKey = await importPKCS8Ed25519Key(config.privateKeyPem)
  const signature = await crypto.subtle.sign(
    'Ed25519',
    cryptoKey,
    encoder.encode(signingInput),
  )

  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`
}

async function importPKCS8Ed25519Key(privateKeyPem: string): Promise<CryptoKey> {
  const pemBody = privateKeyPem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '')

  const binary = Uint8Array.from(atob(pemBody), char => char.charCodeAt(0))

  return crypto.subtle.importKey(
    'pkcs8',
    binary,
    'Ed25519',
    false,
    ['sign'],
  )
}

function base64UrlEncode(input: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...input))
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}
