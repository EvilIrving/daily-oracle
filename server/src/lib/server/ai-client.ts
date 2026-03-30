import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import type { BookMeta, ExtractionConfig, ExtractedQuotePayload, TextChunk } from '../types';
import { logError, logInfo } from './logger';
import { parseAiJsonArray } from './parser';

const WORKSPACE_ROOT =
  path.basename(process.cwd()) === 'server' ? path.dirname(process.cwd()) : process.cwd();
const PROMPT_PATH = path.join(WORKSPACE_ROOT, 'docs/prompt-oracle.md');
const NON_STREAMING_MAX_TOKENS_LIMIT = 21333;
const DEFAULT_REQUEST_MAX_TOKENS = 4096;
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
  const client = new Anthropic({
    apiKey: input.config.apiKey,
    baseURL: input.config.apiBaseUrl || undefined
  });

  const systemPrompt = (input.config.promptTemplate || loadPromptTemplate()).trim();
  const userContent = buildChunkUserPrompt(input.meta, input.chunk, input.totalChunks);
  const safeMaxTokens = resolveRequestMaxTokens(input.config.maxTokens);
  if (safeMaxTokens !== input.config.maxTokens) {
    logInfo('ai-client', 'Adjusted maxTokens for non-streaming request.', {
      requestedMaxTokens: input.config.maxTokens,
      effectiveMaxTokens: safeMaxTokens,
      limit: NON_STREAMING_MAX_TOKENS_LIMIT
    });
  }
  logInfo('ai-client', 'Prepared AI request payload for chunk.', {
    chunkIndex: input.chunk.index,
    totalChunks: input.totalChunks,
    model: input.config.model,
    apiBaseUrl: input.config.apiBaseUrl,
    temperature: input.config.temperature,
    maxTokens: safeMaxTokens,
    chunkLength: input.chunk.text.length,
    meta: input.meta,
    systemPromptLength: systemPrompt.length,
    prompt: userContent
  });

  const responseText = await requestWithRetry(async () => {
    logInfo('ai-client', 'Sending AI request for chunk.', {
      chunkIndex: input.chunk.index,
      totalChunks: input.totalChunks,
      model: input.config.model,
      apiBaseUrl: input.config.apiBaseUrl,
      requestTimeoutMs: REQUEST_TIMEOUT_MS
    });

    const { signal, clear } = createTimeoutSignal(input.signal, REQUEST_TIMEOUT_MS);
    try {
      const response = await client.messages.create(
        {
          model: input.config.model,
          max_tokens: safeMaxTokens,
          temperature: input.config.temperature,
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

  logInfo('ai-client', 'Received AI response for chunk.', {
    chunkIndex: input.chunk.index,
    totalChunks: input.totalChunks,
    responseText
  });

  const parsed = parseAiJsonArray(responseText);
  logInfo('ai-client', 'Parsed AI response into quote payloads.', {
    chunkIndex: input.chunk.index,
    totalChunks: input.totalChunks,
    parsedCount: parsed.length,
    parsed
  });

  return parsed;
}

function buildChunkUserPrompt(meta: BookMeta, chunk: TextChunk, totalChunks: number): string {
  const sourceLines = [
    meta.title && `"title": "${meta.title}"`,
    meta.author && `"author": "${meta.author}"`,
    meta.year && `"year": ${meta.year}`,
    meta.language && `"language": "${meta.language}"`,
    meta.genre && `"genre": "${meta.genre}"`
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

export function resolveRequestMaxTokens(value: number): number {
  const parsed = Number.isFinite(value) ? Math.floor(value) : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_REQUEST_MAX_TOKENS;
  }

  return Math.min(parsed, NON_STREAMING_MAX_TOKENS_LIMIT);
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
