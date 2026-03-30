import type { TextChunk } from '../types';

export function chunkTextByParagraph(rawText: string, chunkSize: number): TextChunk[] {
  const cleanText = String(rawText || '').trim();
  const safeChunkSize = Math.max(500, chunkSize);

  if (!cleanText) return [];

  const paragraphs = cleanText
    .split(/\n\s*\n/)
    .map((item) => item.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let buffer = '';

  for (const paragraph of paragraphs) {
    if (paragraph.length > safeChunkSize) {
      if (buffer.trim()) {
        chunks.push(buffer.trim());
        buffer = '';
      }
      chunks.push(...splitLongParagraph(paragraph, safeChunkSize));
      continue;
    }

    const next = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
    if (next.length > safeChunkSize && buffer.trim()) {
      chunks.push(buffer.trim());
      buffer = paragraph;
    } else {
      buffer = next;
    }
  }

  if (buffer.trim()) {
    chunks.push(buffer.trim());
  }

  return chunks.map((text, index) => ({
    index,
    text,
    charCount: text.length
  }));
}

function splitLongParagraph(paragraph: string, chunkSize: number): string[] {
  const sentences = paragraph.match(/[^。！？!?；;\n]+[。！？!?；;]?/g) ?? [paragraph];
  const chunks: string[] = [];
  let buffer = '';

  for (const sentence of sentences) {
    const next = `${buffer}${sentence}`;
    if (next.length > chunkSize && buffer.trim()) {
      chunks.push(buffer.trim());
      buffer = sentence;
    } else {
      buffer = next;
    }
  }

  if (buffer.trim()) {
    chunks.push(buffer.trim());
  }

  return chunks.flatMap((text) => splitHardLimit(text, chunkSize));
}

function splitHardLimit(text: string, chunkSize: number): string[] {
  if (text.length <= chunkSize) return [text];

  const result: string[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    result.push(text.slice(cursor, cursor + chunkSize).trim());
    cursor += chunkSize;
  }
  return result.filter(Boolean);
}
