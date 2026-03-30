import type { BookMeta, ExtractedQuotePayload, ParsedBook, QuoteCandidate, QuoteMood } from '../types';
import { logError, logInfo } from './logger';

const META_LABELS = new Map<string, keyof BookMeta>([
  ['title', 'title'],
  ['author', 'author'],
  ['year', 'year'],
  ['language', 'language'],
  ['genre', 'genre']
]);

const ALLOWED_MOODS = new Set<QuoteMood>([
  'calm',
  'happy',
  'sad',
  'anxious',
  'angry',
  'resilient',
  'romantic',
  'philosophical'
]);

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
      if (/^[{}]+$/.test(trimmed)) {
        continue;
      }

      const match = trimmed.match(/^"?([A-Za-z_]+)"?\s*:\s*(.+?)(?:,)?$/);
      if (!match) continue;

      const key = META_LABELS.get(match[1].trim().toLowerCase());
      if (!key) continue;
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

  const parsedBook = {
    meta,
    body: bodyLines.join('\n').trim(),
    header: headerLines.join('\n').trim()
  };

  logInfo('parser', 'Parsed txt metadata header.', {
    fallbackTitle,
    meta: parsedBook.meta,
    header: parsedBook.header,
    bodyLength: parsedBook.body.length
  });

  return parsedBook;
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
  const trimmed = rawValue.trim();
  if (!trimmed) return null;

  if (/^null$/i.test(trimmed)) {
    return null;
  }

  const quoted = trimmed.match(/^"(.*)"$/);
  if (quoted) {
    return quoted[1].trim() || null;
  }

  return trimmed;
}

export function stripThinkingAndFences(raw: string): string {
  return String(raw || '')
    .replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, '')
    .replace(/```json|```/gi, '')
    .trim();
}

export function parseAiJsonArray(raw: string): ExtractedQuotePayload[] {
  const cleaned = stripThinkingAndFences(raw);
  const match = cleaned.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
  if (!match) {
    logError('parser', 'AI response did not contain JSON payload.', {
      raw,
      cleaned
    });
    return [];
  }

  try {
    const parsed = JSON.parse(match[0]);
    const items = Array.isArray(parsed) ? parsed : [parsed];
    const sanitized = items
      .map((item) => sanitizeExtractedQuote(item))
      .filter((item): item is ExtractedQuotePayload => item !== null);
    logInfo('parser', 'Sanitized AI JSON payload.', {
      raw,
      cleaned,
      parsedItemCount: items.length,
      sanitizedItemCount: sanitized.length,
      sanitized
    });
    return sanitized;
  } catch {
    logError('parser', 'Failed to parse AI JSON payload.', {
      raw,
      cleaned,
      jsonCandidate: match[0]
    });
    return [];
  }
}

export function buildQuoteCandidates(
  payloads: ExtractedQuotePayload[],
  meta: BookMeta,
  chunkIndex: number
): QuoteCandidate[] {
  return payloads.map((item) => ({
    text: item.text,
    lang: deriveQuoteLang(meta.language, item.text),
    author: meta.author,
    work: meta.title,
    year: meta.year,
    genre: meta.genre,
    moods: item.moods,
    themes: item.themes,
    sourceBook: meta.title,
    chunkIndex,
    normalizedText: normalizeQuoteText(item.text),
    reviewStatus: 'pending'
  }));
}

export function normalizeQuoteText(text: string): string {
  return String(text || '')
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, '')
    .replace(/[\p{P}\p{S}]+/gu, '')
    .trim()
    .toLowerCase();
}

function sanitizeExtractedQuote(input: unknown): ExtractedQuotePayload | null {
  if (!input || typeof input !== 'object') return null;

  const item = input as Record<string, unknown>;
  const text = String(item.text || '').trim();
  const moods = sanitizeQuoteMoods(item.moods);
  const themes = sanitizeThemes(item.themes);

  if (!text) {
    return null;
  }

  return {
    text,
    moods,
    themes
  };
}

function deriveQuoteLang(value: string | null, text: string): 'zh' | 'en' | 'translated' {
  const sourceLanguage = String(value || '').trim().toLowerCase();
  if (/(中文|汉语|漢語|chinese|\bzh\b)/.test(sourceLanguage)) {
    return 'zh';
  }

  if (/(英文|英语|英語|english|\ben\b)/.test(sourceLanguage)) {
    return 'en';
  }

  if (sourceLanguage) {
    return 'translated';
  }

  if (/[\u3400-\u9fff]/.test(text)) {
    return 'zh';
  }

  if (/[A-Za-z]/.test(text)) {
    return 'en';
  }

  return 'translated';
}

export function sanitizeQuoteMoods(value: unknown): QuoteMood[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || '').trim())
    .filter((item): item is QuoteMood => ALLOWED_MOODS.has(item as QuoteMood))
    .slice(0, 8);
}

function sanitizeThemes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 8);
}
