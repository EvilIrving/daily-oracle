import type { BookMeta, ParsedBook, ExtractedQuote } from './types';

type BookMetaKey = 'title' | 'author' | 'year' | 'language' | 'genre';

export function parseTxtWithMeta(rawText: string, fallbackTitle = ''): ParsedBook {
  const lines = String(rawText || '')
    .replace(/\r\n?/g, '\n')
    .split('\n');
  const meta: BookMeta = {
    title: fallbackTitle,
    author: null,
    year: null,
    language: null,
    genre: null
  };

  const headerLines: string[] = [];
  const bodyLines: string[] = [];
  let inBody = false;

  for (const line of lines) {
    const normalizedLine = sanitizeTxtLine(line);
    const trimmed = normalizedLine.trim();

    if (!inBody && isBodySeparator(trimmed)) {
      inBody = true;
      const inlineBody = extractInlineBodyAfterSeparator(trimmed);
      if (inlineBody) {
        bodyLines.push(inlineBody);
      }
      continue;
    }

    if (!inBody) {
      headerLines.push(normalizedLine);

      const match = trimmed.match(/^\s*(title|author|year|language|genre)\s*:\s*(.*)$/i);
      if (!match) continue;

      const key = match[1].trim().toLowerCase() as BookMetaKey;
      const value = parseMetaValue(match[2].trim());

      if (key === 'year') {
        const parsedYear = Number.parseInt(value || '', 10);
        meta.year = Number.isFinite(parsedYear) ? parsedYear : null;
      } else if (key === 'title') {
        meta.title = value || fallbackTitle;
      } else {
        meta[key] = value || null;
      }
      continue;
    }

    bodyLines.push(normalizedLine);
  }

  return {
    meta,
    body: bodyLines.join('\n').trim(),
    header: headerLines.join('\n').trim()
  };
}

function sanitizeTxtLine(line: string): string {
  return String(line || '').replace(/[\uFEFF\u200B\u200C\u200D\u2060]/g, '');
}

function isBodySeparator(line: string): boolean {
  return /^[\s\-—－─_]{3,}(?:\s+.*)?$/.test(line);
}

function extractInlineBodyAfterSeparator(line: string): string {
  const match = line.match(/^[\s\-—－─_]{3,}\s+(.+)$/);
  return match?.[1]?.trim() || '';
}

function parseMetaValue(rawValue: string): string | null {
  const t = rawValue.trim();
  return t === '' ? null : t;
}

// 数据清洗：去除多余换行和空格，保留纯文本
export function cleanText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')           // 统一换行符
    .replace(/[ \t]+/g, ' ')            // 多个空格/制表符合并为一个
    .replace(/\n{3,}/g, '\n\n')         // 多个空行合并为两个
    .trim();
}

export function stripThinkingAndFences(raw: string): string {
  return String(raw || '')
    .replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, '')
    .replace(/```json|```/gi, '')
    .trim();
}

export function parseAiExtractedJson(raw: string): ExtractedQuote[] {
  const cleaned = stripThinkingAndFences(raw);
  const match = cleaned.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
  if (!match) {
    return [];
  }

  try {
    const parsed = JSON.parse(match[0]);
    const items = Array.isArray(parsed) ? parsed : [parsed];

    return items
      .map((item) => sanitizeExtractedQuote(item))
      .filter((item): item is ExtractedQuote => item !== null);
  } catch {
    return [];
  }
}

function sanitizeExtractedQuote(input: unknown): ExtractedQuote | null {
  if (!input || typeof input !== 'object') return null;

  const item = input as Record<string, unknown>;
  const text = String(item.text || '').trim();

  if (!text) {
    return null;
  }

  return { text };
}

// 归一化文本，用于去重
export function normalizeText(text: string): string {
  return String(text || '')
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')  // 去除零宽字符
    .replace(/\s+/g, '')                     // 去除所有空白
    .replace(/[\p{P}\p{S}]+/gu, '')          // 去除标点和符号
    .trim()
    .toLowerCase();
}

// 精筛结果解析
export function parseAiReviewDecision(raw: string): 'approved' | 'rejected' | null {
  const cleaned = stripThinkingAndFences(raw).toUpperCase().trim();
  if (cleaned === 'YES' || cleaned === 'APPROVED') return 'approved';
  if (cleaned === 'NO' || cleaned === 'REJECTED') return 'rejected';
  return null;
}

// 批量精筛结果解析（chunk-by-chunk 模式）
export function parseAiReviewDecisions(raw: string, count: number): ('approved' | 'rejected')[] {
  const cleaned = stripThinkingAndFences(raw);
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) {
    return [];
  }

  try {
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .slice(0, count)
      .map((item) => {
        const val = String(item).toUpperCase().trim();
        if (val === 'YES' || val === 'APPROVED') return 'approved';
        if (val === 'NO' || val === 'REJECTED') return 'rejected';
        return null;
      })
      .filter((v): v is 'approved' | 'rejected' => v !== null);
  } catch {
    return [];
  }
}
