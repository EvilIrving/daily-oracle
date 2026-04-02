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
宜：在自然光下读几页纸质书
忌：把休息当成需要被证明才能拥有的东西

宜：出门走一段不常走的路，看陌生的窗口
忌：用沉默代替真正想说的话

反面示例（排除）：
宜：保持积极心态 ← 空话
忌：不要生气 ← 说教

宜：宜嫁娶 ← 古代的宜忌
忌：忌出行 ← 古代的宜忌

严格按以下 JSON 格式输出，不加任何解释：
{"yi": "宜：...", "ji": "忌：..."}`;

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

/** Build theme scoring SQL fragment */
function buildThemeScoring(themes: string[]): string {
  if (themes.length === 0) return "0";
  return themes
    .map((t, i) => {
      const weight = Math.max(3 - i, 1);
      return `case when themes @> array['${t}'] then ${weight} else 0 end`;
    })
    .join(" + ");
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

// --- Main Handler ---

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")!;
    const anthropicBaseUrl = Deno.env.get("ANTHROPIC_BASE_URL") || "https://api.anthropic.com";
    const model = Deno.env.get("MODEL") || "claude-haiku-4-5-20251001";

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const today = todayString();

    // --- 1. Select quote ---
    const mood = body.preferences.mood;
    const weatherThemes = weatherToThemes(body.weather.condition, body.weather.temperature);
    const themeScoring = buildThemeScoring(weatherThemes);

    let quoteQuery = supabase
      .from("quotes")
      .select("id, text, author, work, year, mood, themes");

    // We can't do custom scoring via supabase-js directly,
    // so fetch candidates filtered by mood and pick randomly with theme preference
    if (mood) {
      quoteQuery = quoteQuery.contains("mood", [mood]);
    }

    const { data: candidates, error: quoteError } = await quoteQuery
      .eq("is_active", true)
      .limit(50);

    if (quoteError) throw quoteError;

    // Score candidates by theme overlap
    let selectedQuote: Quote | null = null;
    if (candidates && candidates.length > 0) {
      const scored = candidates.map((q: Quote) => {
        let score = 0;
        for (const theme of weatherThemes) {
          if (q.themes?.includes(theme)) score += 2;
        }
        // Add randomness to avoid always picking the same one
        score += Math.random() * 3;
        return { ...q, score };
      });
      scored.sort((a: { score: number }, b: { score: number }) => b.score - a.score);
      selectedQuote = scored[0];
    }

    // --- 2. Generate or retrieve almanac ---
    let almanac: Almanac;

    // Check if today's almanac already cached
    const { data: cached } = await supabase
      .from("almanac")
      .select("yi, ji")
      .eq("date", today)
      .single();

    if (cached) {
      almanac = { yi: cached.yi, ji: cached.ji };
    } else {
      // Call LLM to generate
      const prompt = buildPrompt(body);

      const llmRes = await fetch(`${anthropicBaseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 256,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!llmRes.ok) {
        const errText = await llmRes.text();
        throw new Error(`LLM request failed: ${llmRes.status} ${errText}`);
      }

      const llmData = await llmRes.json();
      const raw = llmData.content?.[0]?.text || "";

      // Parse JSON from LLM response
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error(`Failed to parse almanac from LLM: ${raw}`);

      almanac = JSON.parse(jsonMatch[0]);

      // Cache to database
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

    // --- 3. Assemble response ---
    const response = {
      quote: selectedQuote
        ? {
            id: selectedQuote.id,
            text: selectedQuote.text,
            author: selectedQuote.author,
            work: selectedQuote.work,
            year: selectedQuote.year,
            mood: selectedQuote.mood,
            themes: selectedQuote.themes,
          }
        : null,
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
