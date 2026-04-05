import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import Anthropic from '@anthropic-ai/sdk';
import { chunkTextByParagraph } from '$lib/server/chunker';
import { logInfo, logError } from '$lib/server/logger';

const DEFAULT_EXTRACT_PROMPT = `你是一个文学语料库编辑，任务是从用户提供的书籍文本中提取适合「每日名句」产品使用的原文句子。

Task：
从提供的书籍文本中，提取所有最具洞见、语言精炼、启发性强或深刻概括核心观点的金句。数量不做任何限制，完全取决于文本中实际金句的质量——如果很少就少提取，如果很多就多提取，但必须是真正值得的。

Rules:

- 每句必须是书中**原文**，不允许任何篡改
- 句子的字数在45字以内
- 只提取真正优秀的句子，避免普通/平庸陈述 or 对话，但无须与书的主题有关。
- 提取适合发朋友圈/社交媒体的短金句，不要提取长篇大论的句子。
- 非情节描写、场景或景物描写的句子， 不能是口水话或者普通对话
- 也不能是励志空话、鸡汤结论

Steps:
找出符合要求的句子，并思考为什么选:

若是则否掉:

- 它是普通对话吗？
- 它是口水话吗？
- 它是情节/场景描写吗？
- 它是绝对真理吗？
- 它是鸡汤吗？
- 它是空话吗？
- 它是司空见惯的吗？
- 脱离了书的背景，还好读吗？

若是则取用:

- 它是长度小于 45 个字符吗？
- 它适合发朋友圈/Facebook/Instagram吗？

输出格式

[{text:"原文，中文或英文保持原语言，其他语言输出中文译文"},...]`;

const DEFAULT_REVIEW_PROMPT = `你是一个严格的文学编辑。判断下面这条候选句子是否适合用作「每日名句」产品。

判断标准（全部满足才通过）：
- 语言精炼，有独到洞见，启发性强，或深刻概括核心观点
- 是书中原文，非概括总结，非普通对话
- 字数在 45 字以内
- 适合发朋友圈/Facebook/Instagram
- 脱离书的背景仍然好读、有意义

以下情况直接拒绝：
- 普通对话或口水话
- 纯情节/场景/动作/景物描写
- 励志空话、鸡汤结论
- 绝对真理式表述
- 司空见惯、缺乏洞见

输出格式（只输出这一行，不加其他内容）：
通过：理由一句话
不通过：理由一句话`;

export const GET: RequestHandler = async () => {
  return json({ extractPrompt: DEFAULT_EXTRACT_PROMPT, reviewPrompt: DEFAULT_REVIEW_PROMPT });
};

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json().catch(() => null);
  if (!body) return json({ error: '请求体无效。' }, { status: 400 });

  const { action, config } = body;

  if (!config?.apiKey || !config?.model) {
    return json({ error: '缺少 AI 配置（API Key 或模型）。' }, { status: 400 });
  }

  const baseURL = (config.apiBaseUrl ?? '').trim() || undefined;
  const useBearerAuth = baseURL != null && baseURL.toLowerCase().includes('longcat');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = new Anthropic({
    baseURL,
    ...(useBearerAuth
      ? { apiKey: null as unknown as string, authToken: config.apiKey }
      : { apiKey: config.apiKey, authToken: null })
  });

  const callModel = async (
    system: string,
    userContent: string,
    maxTokens: number,
    chunkIndex?: number
  ): Promise<string> => {
    const start = Date.now();
    const chunkTag = chunkIndex != null ? `[chunk ${chunkIndex}]` : '';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);
    try {
      logInfo('prompt-lab', `${chunkTag} calling ${config.model} (${userContent.length} chars)`.trim());

      const response = await client.messages.create(
        {
          model: config.model,
          max_tokens: maxTokens,
          temperature: Number(config.temperature ?? 0.3),
          top_p: Number(config.topP ?? 0.9),
          system,
          messages: [{ role: 'user', content: userContent }]
        },
        { signal: controller.signal }
      );

      const output = response.content
        .map((item) => ('text' in item ? item.text : ''))
        .join('\n')
        .trim();

      const elapsed = ((Date.now() - start) / 1000).toFixed(2);
      logInfo('prompt-lab', `${chunkTag} ${config.model} done (${output.length} chars, ${elapsed}s)`.trim());
      return output;
    } catch (err) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(2);
      const message = err instanceof Error ? err.message : String(err);
      logError('prompt-lab', `${chunkTag} ${config.model} failed after ${elapsed}s: ${message}`.trim());
      throw err;
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    if (action === 'extract') {
      const { text, prompt } = body;
      if (!text?.trim()) return json({ error: '缺少输入文本。' }, { status: 400 });

      const chunks = chunkTextByParagraph(text, 3000);
      const allCandidates: string[] = [];

      logInfo('prompt-lab', 'extract start', { model: config.model, chunks: chunks.length, textLen: text.length });

      // 使用流式响应，每处理完一个块就发送更新
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();

          try {
            for (let i = 0; i < chunks.length; i++) {
              const chunk = chunks[i];
              const raw = await callModel(prompt || '', chunk.text, 4096, i + 1);
              const chunkCandidates = parseCandidates(raw);
              allCandidates.push(...chunkCandidates);

              // 发送进度更新
              logInfo('prompt-lab', `[chunk ${i + 1}] parsed ${chunkCandidates.length} candidates`, {
                candidates: chunkCandidates.slice(0, 5).map((c) => c.slice(0, 50))
              });
              const message = JSON.stringify({
                type: 'progress',
                chunkIndex: i + 1,
                totalChunks: chunks.length,
                raw,
                candidates: chunkCandidates,
                totalCandidates: allCandidates.length
              });
              logInfo('prompt-lab', `[chunk ${i + 1}] sending ${chunkCandidates.length} candidates to frontend`);
              controller.enqueue(encoder.encode(`data: ${message}\n\n`));
            }

            // 发送完成消息
            logInfo('prompt-lab', `extract done, sending ${allCandidates.length} total candidates to frontend`);
            const doneMessage = JSON.stringify({
              type: 'done',
              totalCandidates: allCandidates.length,
              _debug_allCandidates: allCandidates.slice(0, 10).map((c) => c.slice(0, 50))
            });
            controller.enqueue(encoder.encode(`data: ${doneMessage}\n\n`));
          } catch (err) {
            const message = err instanceof Error ? err.message : 'AI 调用失败。';
            logError('prompt-lab', 'stream error', { error: message });
            const errorMessage = JSON.stringify({
              type: 'error',
              error: message
            });
            controller.enqueue(encoder.encode(`data: ${errorMessage}\n\n`));
          } finally {
            controller.close();
          }
        }
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      });
    }

    if (action === 'review') {
      const { candidate, prompt } = body;
      if (!candidate?.trim()) return json({ error: '缺少候选句。' }, { status: 400 });
      logInfo('prompt-lab', 'review start', { model: config.model, candidateLen: candidate.length });
      const raw = await callModel(prompt || '', candidate, 512);
      logInfo('prompt-lab', 'review done');
      return json({ raw });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI 调用失败。';
    logError('prompt-lab', 'request failed', { action, error: message });
    return json({ error: message }, { status: 500 });
  }

  return json({ error: '未知操作。' }, { status: 400 });
};

function parseCandidates(raw: string): string[] {
  const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

  // 调试：打印原始返回内容的前 200 字符
  console.log('[parseCandidates] raw[0:200]:', raw.slice(0, 200));
  console.log('[parseCandidates] cleaned[0:200]:', cleaned.slice(0, 200));

  // 尝试用正则直接提取所有 text:"..." 或 text: "..." 的值
  const textRegex = /text\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/g;
  const texts: string[] = [];
  let match;
  while ((match = textRegex.exec(cleaned)) !== null) {
    const text = match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\'/g, "'").trim();
    if (text) texts.push(text);
  }
  console.log('[parseCandidates] regex matched', texts.length, 'texts');
  if (texts.length > 0) return texts;

  // JSON array: [{text:"..."}, ...]
  const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    try {
      const arr = JSON.parse(jsonMatch[0]);
      if (Array.isArray(arr)) {
        const parsed = arr
          .map((item) => (typeof item === 'object' && item !== null ? item.text : item))
          .filter((t) => typeof t === 'string' && t.trim())
          .map((t) => t.trim());
        if (parsed.length > 0) return parsed;
      }
    } catch {
      // fall through to text-based parsing
    }
  }

  // Numbered list: "1. ...\n2. ..."
  if (/^\d+\./m.test(cleaned)) {
    return cleaned
      .split(/\n(?=\d+\.)/)
      .map((s) => s.replace(/^\d+\.\s*/, '').trim())
      .filter(Boolean);
  }

  // Dash/bullet list: "- ...\n- ..."
  if (/^[-—•]\s/m.test(cleaned)) {
    return cleaned
      .split(/\n(?=[-—•]\s)/)
      .map((s) => s.replace(/^[-—•]\s*/, '').trim())
      .filter(Boolean);
  }

  // Empty-line separated
  return cleaned
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);
}
