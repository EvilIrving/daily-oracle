import { describe, expect, it } from 'vitest';
import { resolveRequestMaxTokens } from './ai-client';

describe('resolveRequestMaxTokens', () => {
  it('caps non-streaming max tokens before the SDK timeout guard trips', () => {
    expect(resolveRequestMaxTokens(65536)).toBe(21333);
  });

  it('keeps safe values unchanged', () => {
    expect(resolveRequestMaxTokens(4096)).toBe(4096);
  });

  it('falls back to a sane default for invalid values', () => {
    expect(resolveRequestMaxTokens(0)).toBe(4096);
    expect(resolveRequestMaxTokens(Number.NaN)).toBe(4096);
  });
});
