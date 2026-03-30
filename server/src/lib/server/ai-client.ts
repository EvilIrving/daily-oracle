import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import type { BookMeta, ExtractionConfig, ExtractedQuotePayload, TextChunk } from '../types';
import { parseAiJsonArray } from './parser';

const WORKSPACE_ROOT =
  path.basename(process.cwd()) === 'server' ? path.dirname(process.cwd()) : process.cwd();
const PROMPT_PATH = path.join(WORKSPACE_ROOT, 'docs/prompt-oracle.md');

export function loadPromptTemplate(): string {
  return fs.readFileSync(PROMPT_PATH, 'utf8').trim();
}

export async function extractQuotesForChunk(input: {
  config: ExtractionConfig;
  chunk: TextChunk;
  meta: BookMeta;
  totalChunks: number;
}): Promise<ExtractedQuotePayload[]> {
  const client = new Anthropic({
    apiKey: input.config.apiKey,
    baseURL: input.config.apiBaseUrl || undefined
  });

  const userContent = buildChunkPrompt(
    input.meta,
    input.chunk,
    input.totalChunks,
    input.config.promptTemplate || loadPromptTemplate()
  );
  const responseText = await requestWithRetry(async () => {
    const response = await client.messages.create({
      model: input.config.model,
      max_tokens: input.config.maxTokens,
      temperature: input.config.temperature,
      messages: [{ role: 'user', content: userContent }]
    });

    return response.content
      .map((item) => ('text' in item ? item.text : ''))
      .join('\n')
      .trim();
  });

  return parseAiJsonArray(responseText);
}

function buildChunkPrompt(
  meta: BookMeta,
  chunk: TextChunk,
  totalChunks: number,
  promptTemplate: string
): string {
  const sourceLines = [
    meta.title && `书名：${meta.title}`,
    meta.author && `作者：${meta.author}`,
    meta.year && `年份：${meta.year}`,
    meta.language && `语言：${meta.language}`,
    meta.genre && `体裁：${meta.genre}`
  ].filter(Boolean);

  return `${promptTemplate}

## 来源信息
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
    if (retries <= 0) throw error;
    return requestWithRetry(fn, retries - 1);
  }
}
