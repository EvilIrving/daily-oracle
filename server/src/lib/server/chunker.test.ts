import { describe, expect, it } from 'vitest';
import { chunkTextByParagraph } from './chunker';

describe('chunkTextByParagraph', () => {
  it('keeps paragraphs together when under the chunk size', () => {
    const chunks = chunkTextByParagraph(`第一段。\n\n第二段。`, 1000);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.text).toContain('第一段');
    expect(chunks[0]?.text).toContain('第二段');
  });

  it('splits long paragraphs into multiple chunks', () => {
    const text = '很长的句子。'.repeat(120);
    const chunks = chunkTextByParagraph(text, 80);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]?.charCount).toBeGreaterThan(0);
  });
});
