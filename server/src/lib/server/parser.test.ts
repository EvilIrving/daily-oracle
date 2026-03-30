import { describe, expect, it } from 'vitest';
import { buildQuoteCandidates, normalizeQuoteText, parseAiJsonArray, parseTxtWithMeta } from './parser';

describe('parseTxtWithMeta', () => {
  it('parses metadata header and body after separator', () => {
    const parsed = parseTxtWithMeta(
      `书名：一九八四
作者：乔治·奥威尔
年份：1984
语言：中文
体裁：小说

-------------

战争即和平。
自由即奴役。`,
      'fallback'
    );

    expect(parsed.meta.title).toBe('一九八四');
    expect(parsed.meta.author).toBe('乔治·奥威尔');
    expect(parsed.meta.year).toBe(1984);
    expect(parsed.meta.language).toBe('中文');
    expect(parsed.meta.genre).toBe('小说');
    expect(parsed.body).toContain('战争即和平');
  });

  it('falls back gracefully when fields are missing', () => {
    const parsed = parseTxtWithMeta(
      `书名：围城

---

正文`,
      'fallback'
    );

    expect(parsed.meta.title).toBe('围城');
    expect(parsed.meta.author).toBeNull();
    expect(parsed.meta.year).toBeNull();
    expect(parsed.body).toBe('正文');
  });
});

describe('parseAiJsonArray', () => {
  it('removes thinking tags and code fences', () => {
    const parsed = parseAiJsonArray(`
<think>hidden</think>
\`\`\`json
[
  {
    "text": "此情可待成追忆，只是当时已惘然。",
    "moods": ["sad"],
    "themes": ["回忆", "离别"]
  }
]
\`\`\`
`);

    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.text).toContain('此情可待成追忆');
  });

  it('accepts a single JSON object response', () => {
    const parsed = parseAiJsonArray(`
{
  "text": "此情可待成追忆，只是当时已惘然。",
  "moods": ["sad"],
  "themes": ["回忆", "离别"]
}
`);

    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.themes).toEqual(['回忆', '离别']);
  });
});

describe('buildQuoteCandidates', () => {
  it('always uses txt metadata and derives lang from txt language', () => {
    const candidates = buildQuoteCandidates(
      [
        {
          text: '此情可待成追忆，只是当时已惘然。',
          moods: ['sad'],
          themes: ['回忆', '离别']
        }
      ],
      {
        title: '锦瑟',
        author: '李商隐',
        year: 812,
        language: '中文',
        genre: '诗'
      },
      0
    );

    expect(candidates[0]?.author).toBe('李商隐');
    expect(candidates[0]?.work).toBe('锦瑟');
    expect(candidates[0]?.year).toBe(812);
    expect(candidates[0]?.lang).toBe('zh');
  });

  it('marks non-zh-en sources as translated', () => {
    const candidates = buildQuoteCandidates(
      [
        {
          text: '所有幸福的家庭都是相似的。',
          moods: ['philosophical'],
          themes: ['家庭']
        }
      ],
      {
        title: '安娜·卡列尼娜',
        author: '托尔斯泰',
        year: 1878,
        language: '俄文',
        genre: '小说'
      },
      0
    );

    expect(candidates[0]?.lang).toBe('translated');
  });

  it('infers zh when language metadata is missing', () => {
    const candidates = buildQuoteCandidates(
      [
        {
          text: '人总是在接近幸福时倍感幸福，在幸福进行时却患得患失。',
          moods: ['philosophical'],
          themes: ['幸福', '失去']
        }
      ],
      {
        title: '围城',
        author: '钱钟书',
        year: 1947,
        language: null,
        genre: '小说'
      },
      0
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.lang).toBe('zh');
  });
});

describe('normalizeQuoteText', () => {
  it('normalizes whitespace and punctuation for dedupe', () => {
    expect(normalizeQuoteText('“此情可待成追忆，只是当时已惘然。”')).toBe('此情可待成追忆只是当时已惘然');
  });
});
