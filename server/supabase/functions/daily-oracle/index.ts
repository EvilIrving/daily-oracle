import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const PROMPT_YI = `今天的输入信号：
- 日期：{{month}} {{weekday}}
- 节气：{{solar_term}}
- 天气：{{condition}}，{{temperature}}℃
- 用户过去 7 天心情记录：{{mood_history}}
- 用户过去 7 天句子类型：{{genre_history}}

请生成今日宜忌各一条。

风格要求：
- 写具体的动作或状态，不写抽象建议（"宜散步"不够，"宜走一段没走过的路"才对）
- 不说教，不励志，语气像朋友随口说的，不像格言
- 宜和忌要有内在张力，像是同一个人今天的两面

正面示例：
在自然光下读几页纸质书
把休息当成需要被证明才能拥有的东西

出门走一段不常走的路，看陌生的窗口
用沉默代替真正想说的话

反面示例（排除）：
保持积极心态 ← 空话
不要生气 ← 说教

宜嫁娶 ← 古代的宜忌
忌出行 ← 古代的宜忌

严格按以下 JSON 格式输出，不加任何解释，不带"宜："或"忌："前缀：
{"yi": "...", "ji": "..."}`;

// --- Types ---

interface RequestBody {
  geo: { lng: number; lat: number };
  weather: { temperature: number; condition: string; wind?: number };
  profile: { lang: string; region: string; pro: boolean };
  preferences: {
    mood?: string;
    mood_history?: string[];
    genre_history?: string[];
  };
}

interface Quote {
  id: string;
  text: string;
  author: string | null;
  work: string | null;
  year: number | null;
  mood: string[];
  themes: string[];
}

interface Almanac {
  yi: string;
  ji: string;
}

type QuoteRow = {
  id: string;
  text: string;
  mood: string[];
  themes: string[];
  book: { title: string | null; author: string | null; year: number | null; genre: string | null };
};

// --- Helpers ---

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function weekday(lang: string): string {
  const d = new Date();
  const weekdays_zh = ["日", "一", "二", "三", "四", "五", "六"];
  const weekdays_en = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return lang === "zh" ? `星期${weekdays_zh[d.getDay()]}` : weekdays_en[d.getDay()];
}

function monthName(lang: string): string {
  const d = new Date();
  if (lang === "zh") return `${d.getMonth() + 1}月`;
  return d.toLocaleString("en", { month: "long" });
}

/** Map weather condition to theme keywords for scoring */
function weatherToThemes(condition: string, temperature: number): string[] {
  const themes: string[] = [];
  const c = condition.toLowerCase();
  if (c.includes("雨") || c.includes("rain")) themes.push("雨");
  if (c.includes("雪") || c.includes("snow")) themes.push("雪", "冬");
  if (c.includes("风") || c.includes("wind")) themes.push("风");
  if (c.includes("晴") || c.includes("sunny") || c.includes("clear")) themes.push("晴");
  if (c.includes("阴") || c.includes("cloud") || c.includes("overcast")) themes.push("阴");
  if (temperature <= 5) themes.push("冬");
  else if (temperature >= 30) themes.push("夏");
  return themes;
}

function pickQuoteFromCandidates(rows: QuoteRow[], weatherThemes: string[]): Quote {
  if (!rows.length) {
    throw new Error("quotes 表中没有可用的已发布名句");
  }
  const scored = rows.map((q) => {
    let score = 0;
    for (const theme of weatherThemes) {
      if (q.themes?.includes(theme)) score += 2;
    }
    score += Math.random() * 3;
    return { q, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const top = scored[0].q;
  const b = top.book;
  return {
    id: top.id,
    text: top.text,
    author: b?.author ?? null,
    work: b?.title ?? null,
    year: b?.year ?? null,
    mood: top.mood,
    themes: top.themes,
  };
}

function buildPrompt(body: RequestBody): string {
  const lang = body.profile.lang || "zh";
  let prompt = PROMPT_YI;
  prompt = prompt.replace("{{month}}", monthName(lang));
  prompt = prompt.replace("{{weekday}}", weekday(lang));
  prompt = prompt.replace("{{solar_term}}", "null"); // TODO: solar term lookup
  prompt = prompt.replace("{{condition}}", body.weather.condition);
  prompt = prompt.replace("{{temperature}}", String(body.weather.temperature));
  prompt = prompt.replace(
    "{{mood_history}}",
    JSON.stringify(body.preferences.mood_history || [])
  );
  prompt = prompt.replace(
    "{{genre_history}}",
    JSON.stringify(body.preferences.genre_history || [])
  );
  return prompt;
}

async function loadQuoteCandidates(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  mood: string | undefined
): Promise<QuoteRow[]> {
  let q = supabase
    .from("quotes")
    .select("id, text, mood, themes, book:books!inner(title, author, year, genre)")
    .eq("is_active", true)
    .limit(50);

  if (mood) {
    q = q.contains("mood", [mood]);
  }

  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as QuoteRow[];

  if (rows.length === 0 && mood) {
    const { data: fallback, error: err2 } = await supabase
      .from("quotes")
      .select("id, text, mood, themes, book:books!inner(title, author, year, genre)")
      .eq("is_active", true)
      .limit(50);
    if (err2) throw err2;
    return (fallback ?? []) as QuoteRow[];
  }

  return rows;
}

// --- Main Handler ---

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    // 与本地工作台一致：使用新版 `SERVICE_SECRET_KEY`（sb_secret_…），不再使用 legacy 的 service_role 名。
    const serviceSecretKey = Deno.env.get("SERVICE_SECRET_KEY");
    if (!serviceSecretKey) {
      throw new Error("Missing SERVICE_SECRET_KEY");
    }

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    const anthropicBaseUrl = Deno.env.get("ANTHROPIC_BASE_URL") || "https://api.moonshot.cn/anthropic";
    const model = Deno.env.get("MODEL") || "kimi-k2.5";

    const supabase = createClient(supabaseUrl, serviceSecretKey);
    const today = todayString();

    const mood = body.preferences.mood;
    const weatherThemes = weatherToThemes(body.weather.condition, body.weather.temperature);

    const candidates = await loadQuoteCandidates(supabase, mood);
    const selectedQuote = pickQuoteFromCandidates(candidates, weatherThemes);

    let almanac: Almanac;

    const { data: cached, error: cacheErr } = await supabase
      .from("almanac")
      .select("yi, ji")
      .eq("date", today)
      .maybeSingle();

    if (cacheErr) throw cacheErr;

    if (cached?.yi && cached?.ji) {
      almanac = { yi: cached.yi, ji: cached.ji };
    } else {
      if (!anthropicKey) {
        throw new Error("ANTHROPIC_API_KEY is required when no almanac cache exists for today");
      }

      const prompt = buildPrompt(body);

      const llmRes = await fetch(`${anthropicBaseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey
        },
        body: JSON.stringify({
          model,
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!llmRes.ok) {
        const errText = await llmRes.text();
        throw new Error(`LLM request failed: ${llmRes.status} ${errText}`);
      }

      const llmData = await llmRes.json();
      const raw = llmData.content?.[0]?.text || "";

      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error(`Failed to parse almanac from LLM: ${raw}`);

      almanac = JSON.parse(jsonMatch[0]) as Almanac;
      if (!almanac.yi?.trim() || !almanac.ji?.trim()) {
        throw new Error("LLM returned empty yi/ji");
      }

      await supabase.from("almanac").upsert(
        {
          date: today,
          yi: almanac.yi,
          ji: almanac.ji,
          signals: {
            weather: body.weather,
            mood_history: body.preferences.mood_history,
            genre_history: body.preferences.genre_history,
          },
          model_used: model,
        },
        { onConflict: "date" }
      );
    }

    const response = {
      quote: {
        id: selectedQuote.id,
        text: selectedQuote.text,
        author: selectedQuote.author,
        work: selectedQuote.work,
        year: selectedQuote.year,
      },
      almanac,
      date: today,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("daily-oracle error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
