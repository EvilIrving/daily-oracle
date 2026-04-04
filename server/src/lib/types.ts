export type QuoteLang = 'zh' | 'en' | 'translated';

export type QuoteMood =
  | 'calm'
  | 'happy'
  | 'sad'
  | 'anxious'
  | 'angry'
  | 'resilient'
  | 'romantic'
  | 'philosophical';

export type TaskStatus = 'idle' | 'queued' | 'running' | 'partial' | 'done' | 'error' | 'stopped';

export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'committed';

export type BookMeta = {
  title: string;
  author: string | null;
  year: number | null;
  language: string | null;
  genre: string | null;
};

export type ParsedBook = {
  meta: BookMeta;
  body: string;
  header: string;
};

export type TextChunk = {
  index: number;
  text: string;
  charCount: number;
};

export type ExtractionConfig = {
  apiBaseUrl: string;
  apiKey: string;
  model: string;
  chunkSize: number;
  concurrency: number;
  temperature: number;
  topP: number;
  promptTemplate: string;
};

export type ExtractedQuotePayload = {
  text: string;
  textCn: string | null;
  language: string | null;
  originalLanguage: string | null;
  why: string | null;
  location: string | null;
  moods: string[];
  themes: string[];
};

export type QuoteCandidate = {
  text: string;
  textCn: string | null;
  lang: QuoteLang;
  originalLanguage: string | null;
  why: string | null;
  location: string | null;
  author: string | null;
  work: string | null;
  year: number | null;
  genre: string | null;
  moods: string[];
  themes: string[];
  sourceBook: string | null;
  chunkIndex: number;
  normalizedText: string;
  reviewStatus: ReviewStatus;
};

export type BookRecord = {
  id: string;
  fileName: string;
  supabaseBookId: string | null;
  meta: BookMeta;
  rawText: string;
  createdAt: string;
  updatedAt: string;
};

export type ExtractionRun = {
  id: string;
  bookId: string;
  status: TaskStatus;
  totalChunks: number;
  processedChunks: number;
  failedChunks: number;
  activeWorkers: number;
  lastError: string | null;
  model: string;
  chunkSize: number;
  concurrency: number;
  temperature: number;
  promptSnapshot: string;
  startedAt: string | null;
  finishedAt: string | null;
};

export type QuoteCandidateRecord = QuoteCandidate & {
  id: string;
  runId: string;
  bookId: string;
  reviewedAt: string | null;
  committedAt: string | null;
  createdAt: string;
};
