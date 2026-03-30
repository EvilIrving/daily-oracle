import type { BookMeta, ExtractedQuotePayload, ParsedBook, QuoteCandidate, QuoteMood } from '../types';

const META_LABELS = new Map<string, keyof BookMeta>([
  ['书名', 'title'],
  ['作者', 'author'],
  ['年份', 'year'],
  ['语言', 'language'],
  ['体裁', 'genre']
]);

const VALID_MOODS = new Set<QuoteMood>([
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
  const lines = String(rawText || '').replace(/\r\n/g, '\n').split('\n');
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
    const trimmed = line.trim();

    if (!inBody && /^-{3,}$/.test(trimmed)) {
      inBody = true;
      continue;
    }

    if (!inBody) {
      headerLines.push(line);
      const match = trimmed.match(/^([^：:]+)[：:]\s*(.+)$/);
      if (!match) continue;

      const key = META_LABELS.get(match[1].trim());
      if (!key) continue;
      const value = match[2].trim();

      if (key === 'year') {
        const parsedYear = Number.parseInt(value, 10);
        meta.year = Number.isFinite(parsedYear) ? parsedYear : null;
      } else if (key === 'title') {
        meta.title = value || fallbackTitle;
      } else {
        meta[key] = value || null;
      }
      continue;
    }

    bodyLines.push(line);
  }

  return {
    meta,
    body: bodyLines.join('\n').trim(),
    header: headerLines.join('\n').trim()
  };
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
  if (!match) return [];

  try {
    const parsed = JSON.parse(match[0]);
    const items = Array.isArray(parsed) ? parsed : [parsed];
    return items
      .map((item) => sanitizeExtractedQuote(item))
      .filter((item): item is ExtractedQuotePayload => item !== null);
  } catch {
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
    .replace(/\s+/g, '')
    .replace(/[“”"'‘’《》〈〉「」『』,.，。！？!?、；;：:\-—]/g, '')
    .trim()
    .toLowerCase();
}

function sanitizeExtractedQuote(input: unknown): ExtractedQuotePayload | null {
  if (!input || typeof input !== 'object') return null;

  const item = input as Record<string, unknown>;
  const text = String(item.text || '').trim();
  const moods = sanitizeMoods(item.moods);
  const themes = sanitizeThemes(item.themes);

  if (!text || moods.length === 0 || themes.length === 0) {
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

function sanitizeMoods(value: unknown): QuoteMood[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || '').trim())
    .filter((item): item is QuoteMood => VALID_MOODS.has(item as QuoteMood));
}

function sanitizeThemes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 8);
}
