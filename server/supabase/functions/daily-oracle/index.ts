import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// --- Types ---

interface RequestBody {
  /** 宜忌生成的完整提示词（含系统风格定义 + 用户信号），由 App 侧自由组装 */
  prompt: string;
  geo?: { lng: number; lat: number };
  weather?: { temperature: number; condition: string; wind?: number };
  profile: { lang: string; region: string; pro: boolean };
  preferences: {
    mood?: string;
    mood_history?: string[];
    anniversary?: { name: string; month: number; day: number };
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

function pickQuoteFromCandidates(rows: QuoteRow[], mood?: string): Quote {
  if (!rows.length) {
    throw new Error("quotes 表中没有可用的已发布名句");
  }
  // 如果提供了 mood，优先选择匹配的候选
  const scored = rows.map((q) => {
    let score = Math.random() * 3;
    if (mood && q.mood?.includes(mood)) score += 5;
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
    const userPrompt = body.prompt?.trim();
    if (!userPrompt) {
      throw new Error("Missing prompt field");
    }

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

    const candidates = await loadQuoteCandidates(supabase, mood);
    const selectedQuote = pickQuoteFromCandidates(candidates, mood);

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

      // Edge Function 完全透明透传：App 传来的 prompt 直接作为 user message
      const llmRes = await fetch(`${anthropicBaseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey
        },
        body: JSON.stringify({
          model,
          max_tokens: 1000,
          messages: [{ role: "user", content: userPrompt }],
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
            prompt: userPrompt,
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
