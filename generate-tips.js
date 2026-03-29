// generate-tips.js
// 用法：node generate-tips.js [数量]
// 示例：node generate-tips.js 100
//
// 依赖环境变量（.env 或 shell export）：
//   SUPABASE_URL        - Supabase 项目 URL
//   SUPABASE_SERVICE_KEY - service_role 密钥（有写权限）
//   API_KEY             - OpenAI 兼容接口 Key
//   BASE_URL            - 接口 Base URL（默认 https://api.openai.com/v1）
//   MODEL               - 模型 ID（默认 gpt-4o）
//   TIPS_PROMPT         - 自定义提示词（可选，不填使用内置默认值）

import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const SUPABASE_URL        = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const API_KEY             = process.env.API_KEY
const BASE_URL            = process.env.BASE_URL || 'https://api.openai.com/v1'
const MODEL               = process.env.MODEL    || 'gpt-4o'

const DEFAULT_TIPS_PROMPT = `你是一个生活方式内容创作者。

请生成 {{count}} 条每日宜忌，宜和忌各半。

要求：
1. 必须有具体场景、动作或感官细节，禁止空话
2. 禁止这类废话：宜运动、忌熬夜、宜早睡、忌暴饮暴食
3. 合格示例：
   宜：散步时不戴耳机，听风听人声
   宜：把想说的话写下来，哪怕之后不发
   忌：将未完成的事列在脑子里反刍
   忌：在饿的时候做任何重要决定
4. 长度：10-25 字
5. emotion 可多选，可为空：calm / happy / sad / anxious / angry / resilient / romantic / philosophical

只输出 JSON 数组，不要任何解释：
[
  { "type": "do",   "text": "宜的内容", "emotion": ["calm"] },
  { "type": "dont", "text": "忌的内容", "emotion": [] }
]`

const TIPS_PROMPT = process.env.TIPS_PROMPT || DEFAULT_TIPS_PROMPT

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('缺少 SUPABASE_URL 或 SUPABASE_SERVICE_KEY 环境变量')
  process.exit(1)
}

if (!API_KEY) {
  console.error('缺少 API_KEY 环境变量')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const client = new OpenAI({ apiKey: API_KEY, baseURL: BASE_URL })

async function generateBatch(count) {
  const prompt = TIPS_PROMPT.replace('{{count}}', count)

  const res = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.9,
  })

  const raw = res.choices[0].message.content.trim()
  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('模型未返回合法 JSON：' + raw.slice(0, 200))

  return JSON.parse(match[0])
}

async function main() {
  const total     = parseInt(process.argv[2] || '40')
  const batchSize = 20
  const batches   = Math.ceil(total / batchSize)

  console.log(`目标生成 ${total} 条，分 ${batches} 批请求\n`)

  let totalInserted = 0

  for (let i = 0; i < batches; i++) {
    const count = Math.min(batchSize, total - i * batchSize)
    console.log(`第 ${i + 1}/${batches} 批，请求 ${count} 条...`)

    try {
      const tips = await generateBatch(count)
      console.log(`  模型返回 ${tips.length} 条`)

      const valid = tips.filter(t =>
        t.type && ['do', 'dont'].includes(t.type) &&
        t.text && t.text.length >= 5 && t.text.length <= 60
      )

      if (valid.length < tips.length) {
        console.log(`  过滤掉 ${tips.length - valid.length} 条格式不合法`)
      }

      const dos   = valid.filter(t => t.type === 'do').map(t => ({
        text:        t.text.trim(),
        emotion:     Array.isArray(t.emotion) ? t.emotion : [],
        weather_fit: [],
        place_fit:   [],
        status:      'pending_review',
      }))

      const donts = valid.filter(t => t.type === 'dont').map(t => ({
        text:        t.text.trim(),
        emotion:     Array.isArray(t.emotion) ? t.emotion : [],
        weather_fit: [],
        place_fit:   [],
        status:      'pending_review',
      }))

      let batchInserted = 0

      if (dos.length > 0) {
        const { data, error } = await supabase.from('daily_dos').insert(dos).select('id')
        if (error) console.error(`  写入 daily_dos 失败：`, error.message)
        else batchInserted += data.length
      }

      if (donts.length > 0) {
        const { data, error } = await supabase.from('daily_donts').insert(donts).select('id')
        if (error) console.error(`  写入 daily_donts 失败：`, error.message)
        else batchInserted += data.length
      }

      totalInserted += batchInserted
      console.log(`  写入 ${batchInserted} 条 ✓`)

    } catch (err) {
      console.error(`  第 ${i + 1} 批失败：`, err.message)
    }

    if (i < batches - 1) {
      await new Promise(r => setTimeout(r, 1000))
    }
  }

  console.log(`\n完成。共写入 ${totalInserted} 条，请前往宜忌审核页面审核。`)
}

main().catch(console.error)
