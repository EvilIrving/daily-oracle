import { describe, expect, it } from 'vitest';
import { verifyQuoteExistsInBook } from './quote-verifier';

describe('verifyQuoteExistsInBook', () => {
  it('accepts quotes that exist in the parsed body after normalization', () => {
    const result = verifyQuoteExistsInBook(
      '"title": "围城"\n---\n“人总是在接近幸福时倍感幸福，在幸福进行时却患得患失。”',
      '人总是在接近幸福时倍感幸福，在幸福进行时却患得患失'
    );

    expect(result).toEqual(
      expect.objectContaining({
        valid: true
      })
    );
  });

  it('rejects quotes that do not exist in the parsed body', () => {
    const result = verifyQuoteExistsInBook(
      '"title": "围城"\n---\n人总是在接近幸福时倍感幸福，在幸福进行时却患得患失。',
      '从此故乡只有冬夏，再无春秋。'
    );

    expect(result).toEqual(
      expect.objectContaining({
        valid: false,
        reason: '原始正文中未找到这句原文，疑似 AI 编造或改写过度，不能收录。'
      })
    );
  });

  it('rejects when the parsed body is empty', () => {
    const result = verifyQuoteExistsInBook('"title": "空书"\n---\n', '任意一句');

    expect(result).toEqual(
      expect.objectContaining({
        valid: false,
        reason: '原始正文为空，无法校验名句是否真实存在。'
      })
    );
  });

  it('uses the stored body directly when the book text no longer contains the metadata separator', () => {
    const result = verifyQuoteExistsInBook(
      '满天都是星星，好像一场冻结了的大雨。',
      '满天都是星星，好像一场冻结了的大雨。'
    );

    expect(result).toEqual(
      expect.objectContaining({
        valid: true
      })
    );
  });
});
