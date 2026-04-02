import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import type {
  BookMeta,
  BookRecord,
  ExtractionConfig,
  ExtractionRun,
  QuoteCandidate,
  QuoteCandidateRecord,
  ReviewStatus
} from '../types';

const WORKSPACE_ROOT =
  path.basename(process.cwd()) === 'server' ? path.dirname(process.cwd()) : process.cwd();
const DATA_DIR = path.join(WORKSPACE_ROOT, 'server/data');
const DB_PATH = path.join(DATA_DIR, 'queue.db');

export function createDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  initializeDbSchema(db);
  return db;
}

export function initializeDbSchema(db: Database.Database) {
  db.exec(`
    create table if not exists books (
      id text primary key,
      file_name text not null,
      supabase_book_id text,
      title text not null,
      author text,
      year integer,
      language text,
      genre text,
      raw_text text not null,
      created_at text not null,
      updated_at text not null
    );

    create table if not exists extraction_runs (
      id text primary key,
      book_id text not null references books(id) on delete cascade,
      status text not null,
      total_chunks integer not null default 0,
      processed_chunks integer not null default 0,
      failed_chunks integer not null default 0,
      active_workers integer not null default 0,
      last_error text,
      model text not null,
      chunk_size integer not null,
      concurrency integer not null,
      temperature real not null,
      prompt_snapshot text not null,
      started_at text,
      finished_at text
    );

    create table if not exists quote_candidates (
      id text primary key,
      run_id text not null references extraction_runs(id) on delete cascade,
      book_id text not null references books(id) on delete cascade,
      text text not null,
      text_cn text,
      lang text not null,
      author text,
      work text,
      year integer,
      genre text,
      moods_json text not null,
      themes_json text not null,
      source_book text,
      chunk_index integer not null,
      normalized_text text not null,
      review_status text not null default 'pending',
      reviewed_at text,
      committed_at text,
      created_at text not null
    );

    create unique index if not exists idx_quote_candidates_unique
      on quote_candidates (book_id, normalized_text);

    create table if not exists review_log (
      id text primary key,
      candidate_id text not null,
      book_id text not null,
      book_title text,
      run_id text,
      text text not null,
      text_cn text,
      lang text,
      author text,
      work text,
      year integer,
      genre text,
      moods_json text,
      themes_json text,
      chunk_index integer,
      decision text not null,
      decided_at text not null,
      created_at text not null
    );

    create index if not exists idx_review_log_book_id
      on review_log (book_id);

  `);

  const columns = db.prepare(`pragma table_info(books)`).all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === 'supabase_book_id')) {
    db.exec(`alter table books add column supabase_book_id text;`);
  }

  const candidateColumns = db.prepare(`pragma table_info(quote_candidates)`).all() as Array<{
    name: string;
  }>;
  if (!candidateColumns.some((column) => column.name === 'text_cn')) {
    db.exec(`alter table quote_candidates add column text_cn text;`);
  }

  const reviewLogColumns = db.prepare(`pragma table_info(review_log)`).all() as Array<{
    name: string;
  }>;
  if (!reviewLogColumns.some((column) => column.name === 'text_cn')) {
    db.exec(`alter table review_log add column text_cn text;`);
  }
}

export function upsertBook(
  db: Database.Database,
  input: { id: string; fileName: string; supabaseBookId: string | null; meta: BookMeta; rawText: string }
): BookRecord {
  const now = new Date().toISOString();
  db.prepare(`
    insert into books (id, file_name, supabase_book_id, title, author, year, language, genre, raw_text, created_at, updated_at)
    values (@id, @fileName, @supabaseBookId, @title, @author, @year, @language, @genre, @rawText, @createdAt, @updatedAt)
    on conflict(id) do update set
      file_name = excluded.file_name,
      supabase_book_id = excluded.supabase_book_id,
      title = excluded.title,
      author = excluded.author,
      year = excluded.year,
      language = excluded.language,
      genre = excluded.genre,
      raw_text = excluded.raw_text,
      updated_at = excluded.updated_at
  `).run({
    id: input.id,
    fileName: input.fileName,
    supabaseBookId: input.supabaseBookId,
    title: input.meta.title,
    author: input.meta.author,
    year: input.meta.year,
    language: input.meta.language,
    genre: input.meta.genre,
    rawText: input.rawText,
    createdAt: now,
    updatedAt: now
  });

  return {
    id: input.id,
    fileName: input.fileName,
    supabaseBookId: input.supabaseBookId,
    meta: input.meta,
    rawText: input.rawText,
    createdAt: now,
    updatedAt: now
  };
}

export function listBooks(db: Database.Database): BookRecord[] {
  const rows = db.prepare(`
    select *
    from books
    order by updated_at desc
  `).all() as Array<{
    id: string;
    file_name: string;
    supabase_book_id: string | null;
    title: string;
    author: string | null;
    year: number | null;
    language: string | null;
    genre: string | null;
    raw_text: string;
    created_at: string;
    updated_at: string;
  }>;

  return rows.map(mapBookRow);
}

export function findBookByMeta(
  db: Database.Database,
  meta: Pick<BookMeta, 'title' | 'author' | 'year'>
): BookRecord | null {
  const row = db.prepare(`
    select *
    from books
    where title = ?
      and (
        (author is null and ? is null)
        or author = ?
      )
      and (
        (year is null and ? is null)
        or year = ?
      )
    order by updated_at desc
    limit 1
  `).get(meta.title, meta.author, meta.author, meta.year, meta.year) as
    | {
        id: string;
        file_name: string;
        supabase_book_id: string | null;
        title: string;
        author: string | null;
        year: number | null;
        language: string | null;
        genre: string | null;
        raw_text: string;
        created_at: string;
        updated_at: string;
      }
    | undefined;

  return row ? mapBookRow(row) : null;
}

export function clearExtractionDataByBookId(db: Database.Database, bookId: string) {
  return db.prepare(`
    delete from extraction_runs
    where book_id = ?
  `).run(bookId);
}

export function deleteBookById(db: Database.Database, bookId: string) {
  return db.prepare(`
    delete from books
    where id = ?
  `).run(bookId);
}

export function createExtractionRun(
  db: Database.Database,
  input: { id: string; bookId: string; config: ExtractionConfig; totalChunks: number }
): ExtractionRun {
  const startedAt = new Date().toISOString();
  db.prepare(`
    insert into extraction_runs (
      id, book_id, status, total_chunks, processed_chunks, failed_chunks, active_workers, last_error,
      model, chunk_size, concurrency, temperature, prompt_snapshot, started_at, finished_at
    ) values (
      @id, @bookId, 'queued', @totalChunks, 0, 0, 0, null,
      @model, @chunkSize, @concurrency, @temperature, @promptSnapshot, @startedAt, null
    )
  `).run({
    id: input.id,
    bookId: input.bookId,
    totalChunks: input.totalChunks,
    model: input.config.model,
    chunkSize: input.config.chunkSize,
    concurrency: input.config.concurrency,
    temperature: input.config.temperature,
    promptSnapshot: input.config.promptTemplate,
    startedAt
  });

  return {
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
    startedAt,
    finishedAt: null
  };
}

export function updateRunStatus(
  db: Database.Database,
  runId: string,
  patch: Partial<ExtractionRun>
) {
  const current = db.prepare(`select * from extraction_runs where id = ?`).get(runId) as Record<string, unknown> | undefined;
  if (!current) return;

  db.prepare(`
    update extraction_runs
    set
      status = @status,
      processed_chunks = @processedChunks,
      failed_chunks = @failedChunks,
      active_workers = @activeWorkers,
      last_error = @lastError,
      finished_at = @finishedAt
    where id = @runId
  `).run({
    runId,
    status: patch.status ?? current.status,
    processedChunks: patch.processedChunks ?? current.processed_chunks,
    failedChunks: patch.failedChunks ?? current.failed_chunks,
    activeWorkers: patch.activeWorkers ?? current.active_workers,
    lastError: patch.lastError ?? current.last_error,
    finishedAt: patch.finishedAt ?? current.finished_at
  });
}

export function insertCandidates(
  db: Database.Database,
  runId: string,
  bookId: string,
  candidates: QuoteCandidate[]
) {
  const statement = db.prepare(`
    insert or ignore into quote_candidates (
      id, run_id, book_id, text, text_cn, lang, author, work, year, genre, moods_json, themes_json, source_book,
      chunk_index, normalized_text, review_status, reviewed_at, committed_at, created_at
    ) values (
      @id, @runId, @bookId, @text, @textCn, @lang, @author, @work, @year, @genre, @moodsJson, @themesJson, @sourceBook,
      @chunkIndex, @normalizedText, @reviewStatus, null, null, @createdAt
    )
  `);

  const transaction = db.transaction((items: QuoteCandidate[]) => {
    for (const candidate of items) {
      statement.run({
        id: crypto.randomUUID(),
        runId,
        bookId,
        text: candidate.text,
        textCn: candidate.textCn,
        lang: candidate.lang,
        author: candidate.author,
        work: candidate.work,
        year: candidate.year,
        genre: candidate.genre,
        moodsJson: JSON.stringify(candidate.moods),
        themesJson: JSON.stringify(candidate.themes),
        sourceBook: candidate.sourceBook,
        chunkIndex: candidate.chunkIndex,
        normalizedText: candidate.normalizedText,
        reviewStatus: candidate.reviewStatus,
        createdAt: new Date().toISOString()
      });
    }
  });

  transaction(candidates);
}

export function updateCandidateReviewStatus(
  db: Database.Database,
  candidateId: string,
  status: Exclude<ReviewStatus, 'committed'>
) {
  db.prepare(`
    update quote_candidates
    set review_status = ?, reviewed_at = ?
    where id = ?
  `).run(status, new Date().toISOString(), candidateId);
}

export function deleteCandidateById(db: Database.Database, candidateId: string) {
  db.prepare(`
    delete from quote_candidates
    where id = ?
  `).run(candidateId);
}

export function markCandidatesCommitted(db: Database.Database, candidateIds: string[]) {
  if (!candidateIds.length) return;

  const statement = db.prepare(`
    update quote_candidates
    set review_status = 'committed', committed_at = ?
    where id = ?
  `);

  const transaction = db.transaction((ids: string[]) => {
    const committedAt = new Date().toISOString();
    for (const id of ids) {
      statement.run(committedAt, id);
    }
  });

  transaction(candidateIds);
}

export function listCandidatesByRun(db: Database.Database, runId: string) {
  const rows = db.prepare(`
    select * from quote_candidates
    where run_id = ?
      and review_status != 'committed'
    order by created_at desc
  `).all(runId);

  return rows.map(mapCandidateRow);
}

export function listPendingCandidates(db: Database.Database) {
  const rows = db.prepare(`
    select * from quote_candidates
    where review_status != 'committed'
    order by created_at desc
  `).all();

  return rows.map(mapCandidateRow);
}

export function listApprovedCandidatesByRun(db: Database.Database, runId: string) {
  const rows = db.prepare(`
    select * from quote_candidates
    where run_id = ? and review_status = 'approved'
    order by created_at asc
  `).all(runId);

  return rows.map(mapCandidateRow);
}

export function getCandidateById(db: Database.Database, candidateId: string) {
  const row = db.prepare(`
    select * from quote_candidates
    where id = ?
  `).get(candidateId);

  return row ? mapCandidateRow(row) : null;
}

export function getBookById(db: Database.Database, bookId: string): BookRecord | null {
  const row = db.prepare(`
    select *
    from books
    where id = ?
  `).get(bookId) as
    | {
        id: string;
        file_name: string;
        supabase_book_id: string | null;
        title: string;
        author: string | null;
        year: number | null;
        language: string | null;
        genre: string | null;
        raw_text: string;
        created_at: string;
        updated_at: string;
      }
    | undefined;

  if (!row) return null;

  return mapBookRow(row);
}

export function getLatestRunByBookId(db: Database.Database, bookId: string) {
  return db.prepare(`
    select *
    from extraction_runs
    where book_id = ?
    order by started_at desc
    limit 1
  `).get(bookId) as ExtractionRun | undefined;
}

export function getCandidateStats(db: Database.Database) {
  return db.prepare(`
    select
      count(*) as total,
      sum(case when review_status = 'pending' then 1 else 0 end) as pending,
      sum(case when review_status = 'approved' then 1 else 0 end) as approved,
      sum(case when review_status = 'rejected' then 1 else 0 end) as rejected
    from quote_candidates
    where review_status != 'committed'
  `).get() as {
    total: number | null;
    pending: number | null;
    approved: number | null;
    rejected: number | null;
  };
}

export function resetInterruptedRuns(db: Database.Database) {
  db.prepare(`
    update extraction_runs
    set status = 'stopped', active_workers = 0, last_error = '页面刷新或服务重启后，未完成任务已停止。'
    where status in ('queued', 'running')
  `).run();
}

export function insertReviewLog(
  db: Database.Database,
  candidate: QuoteCandidateRecord,
  decision: 'accepted' | 'rejected',
  bookTitle: string | null
) {
  db.prepare(`
    insert into review_log (
      id, candidate_id, book_id, book_title, run_id, text, text_cn, lang, author, work, year, genre,
      moods_json, themes_json, chunk_index, decision, decided_at, created_at
    ) values (
      @id, @candidateId, @bookId, @bookTitle, @runId, @text, @textCn, @lang, @author, @work, @year, @genre,
      @moodsJson, @themesJson, @chunkIndex, @decision, @decidedAt, @createdAt
    )
  `).run({
    id: crypto.randomUUID(),
    candidateId: candidate.id,
    bookId: candidate.bookId,
    bookTitle,
    runId: candidate.runId,
    text: candidate.text,
    textCn: candidate.textCn,
    lang: candidate.lang,
    author: candidate.author,
    work: candidate.work,
    year: candidate.year,
    genre: candidate.genre,
    moodsJson: JSON.stringify(candidate.moods),
    themesJson: JSON.stringify(candidate.themes),
    chunkIndex: candidate.chunkIndex,
    decision,
    decidedAt: new Date().toISOString(),
    createdAt: candidate.createdAt
  });
}

export function listReviewLogBooks(db: Database.Database) {
  return db.prepare(`
    select
      book_id,
      book_title,
      count(*) as total,
      sum(case when decision = 'accepted' then 1 else 0 end) as accepted,
      sum(case when decision = 'rejected' then 1 else 0 end) as rejected,
      max(decided_at) as last_decided_at
    from review_log
    group by book_id
    order by last_decided_at desc
  `).all() as Array<{
    book_id: string;
    book_title: string | null;
    total: number;
    accepted: number;
    rejected: number;
    last_decided_at: string;
  }>;
}

export function getReviewLogByBookId(db: Database.Database, bookId: string) {
  return db.prepare(`
    select * from review_log
    where book_id = ?
    order by decided_at desc
  `).all(bookId) as Array<{
    id: string;
    candidate_id: string;
    book_id: string;
    book_title: string | null;
    run_id: string | null;
    text: string;
    text_cn: string | null;
    lang: string | null;
    author: string | null;
    work: string | null;
    year: number | null;
    genre: string | null;
    moods_json: string | null;
    themes_json: string | null;
    chunk_index: number | null;
    decision: string;
    decided_at: string;
    created_at: string;
  }>;
}

function mapCandidateRow(row: any): QuoteCandidateRecord {
  return {
    id: row.id,
    runId: row.run_id,
    bookId: row.book_id,
    text: row.text,
    textCn: row.text_cn,
    lang: row.lang,
    author: row.author,
    work: row.work,
    year: row.year,
    genre: row.genre,
    moods: JSON.parse(row.moods_json),
    themes: JSON.parse(row.themes_json),
    sourceBook: row.source_book,
    chunkIndex: row.chunk_index,
    normalizedText: row.normalized_text,
    reviewStatus: row.review_status,
    reviewedAt: row.reviewed_at,
    committedAt: row.committed_at,
    createdAt: row.created_at
  };
}

function mapBookRow(row: {
  id: string;
  file_name: string;
  supabase_book_id: string | null;
  title: string;
  author: string | null;
  year: number | null;
  language: string | null;
  genre: string | null;
  raw_text: string;
  created_at: string;
  updated_at: string;
}): BookRecord {
  return {
    id: row.id,
    fileName: row.file_name,
    supabaseBookId: row.supabase_book_id,
    meta: {
      title: row.title,
      author: row.author,
      year: row.year,
      language: row.language,
      genre: row.genre
    },
    rawText: row.raw_text,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
