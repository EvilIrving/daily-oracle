import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import type { BookMeta, ExtractionConfig, ExtractedQuotePayload, TextChunk } from '../types';
import { logError, logInfo } from './logger';
import { parseAiJsonArray } from './parser';

const WORKSPACE_ROOT =
  path.basename(process.cwd()) === 'server' ? path.dirname(process.cwd()) : process.cwd();
const PROMPT_PATH = path.join(WORKSPACE_ROOT, 'docs/prompts/extract.md');
/** 非流式输出上限（与提供商文档核对；不在 UI 暴露）。 */
const REQUEST_MAX_TOKENS = 4096;
const REQUEST_TIMEOUT_MS = 120_000;

export function loadPromptTemplate(): string {
  return fs.readFileSync(PROMPT_PATH, 'utf8').trim();
}

export async function extractQuotesForChunk(input: {
  config: ExtractionConfig;
  chunk: TextChunk;
  meta: BookMeta;
  totalChunks: number;
  signal?: AbortSignal;
}): Promise<ExtractedQuotePayload[]> {
  const baseURL = input.config.apiBaseUrl.trim() || undefined;
  const useBearerAuth = baseURL != null && baseURL.toLowerCase().includes('longcat');
  const client = new Anthropic({
    baseURL,
    ...(useBearerAuth
      ? { apiKey: null, authToken: input.config.apiKey }
      : { apiKey: input.config.apiKey, authToken: null })
  });

  const systemPrompt = (input.config.promptTemplate || loadPromptTemplate()).trim();
  const userContent = buildChunkUserPrompt(input.meta, input.chunk, input.totalChunks);
  const safeTopP = resolveTopP(input.config.topP);
  const chunkTag = `[${input.chunk.index + 1}/${input.totalChunks}]`;
  logInfo('ai-client', `${chunkTag} → ${input.config.model} (${input.chunk.text.length} chars, temp=${input.config.temperature})`);

  const t0 = Date.now();
  const responseText = await requestWithRetry(async () => {
    const { signal, clear } = createTimeoutSignal(input.signal, REQUEST_TIMEOUT_MS);
    try {
      const response = await client.messages.create(
        {
          model: input.config.model,
          max_tokens: REQUEST_MAX_TOKENS,
          temperature: input.config.temperature,
          top_p: safeTopP,
          system: systemPrompt,
          messages: [{ role: 'user', content: userContent }]
        },
        {
          signal
        }
      );

      return response.content
        .map((item) => ('text' in item ? item.text : ''))
        .join('\n')
        .trim();
    } finally {
      clear();
    }
  });

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const parsed = parseAiJsonArray(responseText);
  logInfo('ai-client', `${chunkTag} ← ${parsed.length} quotes (${responseText.length} chars, ${elapsed}s)`);

  return parsed;
}

function buildChunkUserPrompt(meta: BookMeta, chunk: TextChunk, totalChunks: number): string {
  const sourceLines = [
    meta.title && `title: ${meta.title}`,
    meta.author && `author: ${meta.author}`,
    meta.year != null && `year: ${meta.year}`,
    meta.language && `language: ${meta.language}`,
    meta.genre && `genre: ${meta.genre}`
  ].filter(Boolean);

  return `## 来源信息
${sourceLines.join('\n') || '未知'}

## 待处理文本
第 ${chunk.index + 1}/${totalChunks} 段
---
${chunk.text}
---`;
}

async function requestWithRetry<T>(fn: () => Promise<T>, retries = 1): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    logError('ai-client', 'AI request failed.', { retriesLeft: retries, error });
    if (retries <= 0) throw error;
    return requestWithRetry(fn, retries - 1);
  }
}

export function resolveTopP(value: number): number {
  const parsed = Number.isFinite(value) ? value : NaN;
  if (!Number.isFinite(parsed)) return 0.9;
  return Math.max(0, Math.min(1, parsed));
}

function createTimeoutSignal(externalSignal: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new Error(`AI 请求超时（>${Math.floor(timeoutMs / 1000)}s）。`));
  }, timeoutMs);

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort(externalSignal.reason);
    } else {
      const onAbort = () => controller.abort(externalSignal.reason);
      externalSignal.addEventListener('abort', onAbort, { once: true });

      return {
        signal: controller.signal,
        clear: () => {
          clearTimeout(timer);
          externalSignal.removeEventListener('abort', onAbort);
        }
      };
    }
  }

  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer)
  };
}
