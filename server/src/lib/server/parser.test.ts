import { describe, expect, it } from 'vitest';
import { buildQuoteCandidates, normalizeQuoteText, parseAiJsonArray, parseTxtWithMeta, sanitizeQuoteMoods } from './parser';

describe('parseTxtWithMeta', () => {
  it('parses json-style metadata header and body after separator', () => {
    const parsed = parseTxtWithMeta(
      `"title": "一九八四",
"author": "乔治·奥威尔",
"year": 1984,
"language": "中文",
"genre": "小说"

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
      `"title": "围城"

---

正文`,
      'fallback'
    );

    expect(parsed.meta.title).toBe('围城');
    expect(parsed.meta.author).toBeNull();
    expect(parsed.meta.year).toBeNull();
    expect(parsed.body).toBe('正文');
  });

  it('accepts separator lines with unicode dashes and invisible chars', () => {
    const parsed = parseTxtWithMeta(
      `\uFEFF"title": "局外人",
"author": "加缪"

\u200B———————

今天，妈妈死了。也许是在昨天，我不知道。`,
      'fallback'
    );

    expect(parsed.meta.title).toBe('局外人');
    expect(parsed.meta.author).toBe('加缪');
    expect(parsed.body).toContain('今天，妈妈死了');
  });

  it('keeps inline body content after the separator', () => {
    const parsed = parseTxtWithMeta(
      `"title": "变形记"
--- 一天早晨，格里高尔从不安的梦中醒来。`,
      'fallback'
    );

    expect(parsed.meta.title).toBe('变形记');
    expect(parsed.body).toBe('一天早晨，格里高尔从不安的梦中醒来。');
  });

  it('accepts braces and null values in metadata header', () => {
    const parsed = parseTxtWithMeta(
      `{
"title": "扶桑",
"author": "严歌苓",
"year": 1998,
"language": "中文",
"genre": "小说"
}
---
正文`,
      'fallback'
    );

    expect(parsed.meta.title).toBe('扶桑');
    expect(parsed.meta.author).toBe('严歌苓');
    expect(parsed.meta.year).toBe(1998);
    expect(parsed.meta.language).toBe('中文');
    expect(parsed.meta.genre).toBe('小说');
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

  it('keeps quotes when moods and themes are missing', () => {
    const parsed = parseAiJsonArray(`
[
  {
    "text": "战争就是和平，自由就是奴役，无知就是力量。"
  }
]
`);

    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.text).toContain('战争就是和平');
    expect(parsed[0]?.moods).toEqual([]);
    expect(parsed[0]?.themes).toEqual([]);
  });

  it('drops items only when text is missing', () => {
    const parsed = parseAiJsonArray(`
[
  {
    "moods": ["sad"],
    "themes": ["孤独"]
  }
]
`);

    expect(parsed).toEqual([]);
  });

  it('drops moods outside the schema enum', () => {
    const parsed = parseAiJsonArray(`
[
  {
    "text": "人是为了活着本身而活着，而不是为了活着之外的任何事物而活着。",
    "moods": ["sad", "melancholy", "哲思"],
    "themes": ["生存"]
  }
]
`);

    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.moods).toEqual(['sad']);
  });
});

describe('sanitizeQuoteMoods', () => {
  it('keeps only schema-supported mood enums', () => {
    expect(sanitizeQuoteMoods(['calm', 'melancholy', 'happy', '', null])).toEqual(['calm', 'happy']);
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
