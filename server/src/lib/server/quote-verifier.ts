import { normalizeQuoteText, parseTxtWithMeta } from './parser';

export type QuoteVerificationResult =
  | {
      valid: true;
      normalizedQuote: string;
      normalizedBody: string;
    }
  | {
      valid: false;
      normalizedQuote: string;
      normalizedBody: string;
      reason: string;
    };

export function verifyQuoteExistsInBook(rawText: string, quoteText: string, fallbackTitle = ''): QuoteVerificationResult {
  const parsedBook = parseTxtWithMeta(rawText, fallbackTitle);
  const sourceBody =
    parsedBook.body || (!containsBodySeparator(rawText) ? String(rawText || '').trim() : '');
  const normalizedQuote = normalizeQuoteText(quoteText);
  const normalizedBody = normalizeQuoteText(sourceBody);

  if (!normalizedQuote) {
    return {
      valid: false,
      normalizedQuote,
      normalizedBody,
      reason: '候选名句为空，无法校验原文。'
    };
  }

  if (!normalizedBody) {
    return {
      valid: false,
      normalizedQuote,
      normalizedBody,
      reason: '原始正文为空，无法校验名句是否真实存在。'
    };
  }

  if (!normalizedBody.includes(normalizedQuote)) {
    return {
      valid: false,
      normalizedQuote,
      normalizedBody,
      reason: '原始正文中未找到这句原文，疑似 AI 编造或改写过度，不能收录。'
    };
  }

  return {
    valid: true,
    normalizedQuote,
    normalizedBody
  };
}

function containsBodySeparator(rawText: string): boolean {
  return String(rawText || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .some((line) => /^[\s\-—－─_]{3,}(?:\s+.*)?$/.test(line.trim()));
}
