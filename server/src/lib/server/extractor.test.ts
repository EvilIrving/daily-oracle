import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExtractionConfig } from '../types';

const extractQuotesForChunk = vi.fn();
const loadPromptTemplate = vi.fn(() => 'prompt-template');
const createExtractionRun = vi.fn();
const insertCandidates = vi.fn();
const updateRunStatus = vi.fn();

vi.mock('./ai-client', () => ({
  extractQuotesForChunk,
  loadPromptTemplate
}));

vi.mock('./db', () => ({
  createExtractionRun,
  insertCandidates,
  updateRunStatus
}));

function createConfig(): ExtractionConfig {
  return {
    apiBaseUrl: 'https://example.com',
    apiKey: 'key',
    model: 'test-model',
    chunkSize: 1000,
    concurrency: 2,
    temperature: 0.2,
    maxTokens: 2048,
    promptTemplate: ''
  };
}

function createBook() {
  return {
    id: 'book-1',
    rawText: '第一段。\n\n第二段。',
    meta: {
      title: '示例书',
      author: '作者',
      year: 2024,
      language: '中文',
      genre: '小说'
    }
  };
}

describe('runExtraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createExtractionRun.mockImplementation((_db, input) => ({
      id: input.id,
      bookId: input.bookId,
      status: 'queued',
      totalChunks: input.totalChunks,
      processedChunks: 0,
      failedChunks: 0,
      activeWorkers: 0,
      lastError: null,
      model: input.config.model,
      chunkSize: input.config.chunkSize,
      concurrency: input.config.concurrency,
      temperature: input.config.temperature,
      promptSnapshot: input.config.promptTemplate,
      startedAt: '2024-01-01T00:00:00.000Z',
      finishedAt: null
    }));
  });

  it('stores extracted candidates and finishes as done', async () => {
    const { runExtraction } = await import('./extractor');
    const db = { name: 'fake-db' } as any;
    const book = createBook();

    extractQuotesForChunk.mockResolvedValueOnce([
      {
        text: '人生海海，山山而川。',
        moods: ['resilient'],
        themes: ['人生']
      }
    ]);

    const states: string[] = [];
    const run = await runExtraction({
      db,
      bookId: book.id,
      rawText: book.rawText,
      meta: book.meta,
      config: createConfig(),
      onProgress: (state) => states.push(state.status)
    });

    expect(run.status).toBe('done');
    expect(run.processedChunks).toBe(1);
    expect(insertCandidates).toHaveBeenCalledWith(db, run.id, book.id, [
      expect.objectContaining({
        text: '人生海海，山山而川。',
        work: '示例书',
        author: '作者',
        reviewStatus: 'pending'
      })
    ]);
    expect(states).toContain('running');
    expect(states.at(-1)).toBe('done');
    expect(loadPromptTemplate).toHaveBeenCalled();
  });

  it('marks run as partial when a chunk extraction fails', async () => {
    const { runExtraction } = await import('./extractor');
    const db = { name: 'fake-db' } as any;
    const book = createBook();
    const longText = '很长的句子。'.repeat(120);

    extractQuotesForChunk
      .mockResolvedValueOnce([
        {
          text: '句子一',
          moods: ['calm'],
          themes: ['自然']
        }
      ])
      .mockRejectedValueOnce(new Error('boom'));

    const run = await runExtraction({
      db,
      bookId: book.id,
      rawText: longText,
      meta: book.meta,
      config: { ...createConfig(), chunkSize: 500 },
      onProgress: () => {}
    });

    expect(run.status).toBe('partial');
    expect(run.failedChunks).toBe(1);
    expect(updateRunStatus).toHaveBeenLastCalledWith(db, run.id, {
      status: 'partial',
      processedChunks: 2,
      failedChunks: 1,
      activeWorkers: 0,
      lastError: 'boom',
      finishedAt: expect.any(String)
    });
  });

  it('fails early when body is empty', async () => {
    const { runExtraction } = await import('./extractor');
    const db = { name: 'fake-db' } as any;

    const run = await runExtraction({
      db,
      bookId: 'book-1',
      rawText: '',
      meta: {
        title: '空书',
        author: null,
        year: null,
        language: null,
        genre: null
      },
      config: createConfig(),
      onProgress: () => {}
    });

    expect(run.status).toBe('error');
    expect(run.lastError).toBe('正文为空，无法切片。');
    expect(extractQuotesForChunk).not.toHaveBeenCalled();
    expect(updateRunStatus).toHaveBeenLastCalledWith(db, run.id, {
      status: 'error',
      lastError: '正文为空，无法切片。',
      finishedAt: expect.any(String)
    });
  });
});
