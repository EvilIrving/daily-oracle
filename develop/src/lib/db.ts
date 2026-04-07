import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';

const DB_PATH = join(process.cwd(), 'data', 'workshop.db');
const SCHEMA_PATH = join(process.cwd(), 'src', 'lib', 'schema.sql');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // 初始化表结构
  const schema = readFileSync(SCHEMA_PATH, 'utf-8');
  db.exec(schema);

  return db;
}

// 书籍相关操作
export interface Book {
  id: string;
  file_name: string;
  title: string | null;
  author: string | null;
  year: number | null;
  language: string | null;
  genre: string | null;
  body: string;
  created_at: number;
}

export function insertBook(book: Omit<Book, 'created_at'>): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO books (id, file_name, title, author, year, language, genre, body, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(book.id, book.file_name, book.title, book.author, book.year,
           book.language, book.genre, book.body, Date.now());
}

export function getBooks(): Book[] {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM books ORDER BY created_at DESC');
  return stmt.all() as Book[];
}

export function getBookById(id: string): Book | undefined {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM books WHERE id = ?');
  return stmt.get(id) as Book | undefined;
}

export function deleteBook(id: string): void {
  const db = getDb();
  const stmt = db.prepare('DELETE FROM books WHERE id = ?');
  stmt.run(id);
}

// 提取批次相关操作
export interface ExtractionRun {
  id: string;
  book_id: string;
  status: string;
  total_chunks: number;
  processed_chunks: number;
  failed_chunks: number;
  config_json: string;
  created_at: number;
  updated_at: number;
}

export function insertExtractionRun(run: Omit<ExtractionRun, 'created_at' | 'updated_at'>): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO extraction_runs (id, book_id, status, total_chunks, processed_chunks, failed_chunks, config_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const now = Date.now();
  stmt.run(run.id, run.book_id, run.status, run.total_chunks, run.processed_chunks,
           run.failed_chunks, run.config_json, now, now);
}

export function getExtractionRun(id: string): ExtractionRun | undefined {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM extraction_runs WHERE id = ?');
  return stmt.get(id) as ExtractionRun | undefined;
}

export function updateExtractionRunStatus(id: string, status: string, processedChunks: number, failedChunks: number): void {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE extraction_runs
    SET status = ?, processed_chunks = ?, failed_chunks = ?, updated_at = ?
    WHERE id = ?
  `);
  stmt.run(status, processedChunks, failedChunks, Date.now(), id);
}

export function getExtractionRunsByBookId(bookId: string): ExtractionRun[] {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM extraction_runs WHERE book_id = ? ORDER BY created_at DESC');
  return stmt.all(bookId) as ExtractionRun[];
}

// 候选句相关操作
export interface Candidate {
  id: string;
  run_id: string;
  book_id: string;
  text: string;
  normalized_text: string;
  source_chunk_index: number;
  created_at: number;
}

export function insertCandidate(candidate: Omit<Candidate, 'created_at'>): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO candidates (id, run_id, book_id, text, normalized_text, source_chunk_index, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(candidate.id, candidate.run_id, candidate.book_id, candidate.text,
           candidate.normalized_text, candidate.source_chunk_index, Date.now());
}

export function getCandidatesByRunId(runId: string): Candidate[] {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM candidates WHERE run_id = ? ORDER BY created_at DESC');
  return stmt.all(runId) as Candidate[];
}

export function getCandidatesByBookId(bookId: string): Candidate[] {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM candidates WHERE book_id = ? ORDER BY created_at DESC');
  return stmt.all(bookId) as Candidate[];
}

export function getCandidateById(id: string): Candidate | undefined {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM candidates WHERE id = ?');
  return stmt.get(id) as Candidate | undefined;
}

export function deleteCandidate(id: string): void {
  const db = getDb();
  const stmt = db.prepare('DELETE FROM candidates WHERE id = ?');
  stmt.run(id);
}

// 精筛批次相关操作
export interface ReviewRun {
  id: string;
  extraction_run_id: string;
  mode: string;
  status: string;
  total_items: number;
  processed_items: number;
  config_json: string;
  created_at: number;
  updated_at: number;
}

export function insertReviewRun(run: Omit<ReviewRun, 'created_at' | 'updated_at'>): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO review_runs (id, extraction_run_id, mode, status, total_items, processed_items, config_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const now = Date.now();
  stmt.run(run.id, run.extraction_run_id, run.mode, run.status, run.total_items,
           run.processed_items, run.config_json, now, now);
}

export function getReviewRun(id: string): ReviewRun | undefined {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM review_runs WHERE id = ?');
  return stmt.get(id) as ReviewRun | undefined;
}

export function updateReviewRunProgress(id: string, processedItems: number): void {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE review_runs
    SET processed_items = ?, updated_at = ?
    WHERE id = ?
  `);
  stmt.run(processedItems, Date.now(), id);
}

export function updateReviewRunStatus(id: string, status: string): void {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE review_runs
    SET status = ?, updated_at = ?
    WHERE id = ?
  `);
  stmt.run(status, Date.now(), id);
}

export function getReviewRunsByExtractionRunId(extractionRunId: string): ReviewRun[] {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM review_runs WHERE extraction_run_id = ? ORDER BY created_at DESC');
  return stmt.all(extractionRunId) as ReviewRun[];
}

// AI 精筛结果相关操作
export interface AiReviewed {
  id: string;
  candidate_id: string;
  review_run_id: string;
  ai_status: string;
  created_at: number;
}

export function insertAiReviewed(item: Omit<AiReviewed, 'created_at'>): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO ai_reviewed (id, candidate_id, review_run_id, ai_status, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(item.id, item.candidate_id, item.review_run_id, item.ai_status, Date.now());
}

export function getAiReviewedByReviewRunId(reviewRunId: string): AiReviewed[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT ar.* FROM ai_reviewed ar
    JOIN candidates c ON ar.candidate_id = c.id
    WHERE ar.review_run_id = ?
    ORDER BY c.created_at DESC
  `);
  return stmt.all(reviewRunId) as AiReviewed[];
}

export function getAiReviewedByCandidateId(candidateId: string): AiReviewed | undefined {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM ai_reviewed WHERE candidate_id = ? ORDER BY created_at DESC LIMIT 1');
  return stmt.get(candidateId) as AiReviewed | undefined;
}

// 人工审核相关操作
export interface HumanReviewed {
  id: string;
  ai_reviewed_id: string;
  final_status: string;
  reviewed_at: number;
}

export function insertHumanReviewed(item: Omit<HumanReviewed, 'reviewed_at'>): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO human_reviewed (id, ai_reviewed_id, final_status, reviewed_at)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(item.id, item.ai_reviewed_id, item.final_status, Date.now());
}

export function getHumanReviewedByAiReviewedId(aiReviewedId: string): HumanReviewed | undefined {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM human_reviewed WHERE ai_reviewed_id = ?');
  return stmt.get(aiReviewedId) as HumanReviewed | undefined;
}

// 获取待人工复审的列表（已 AI 精筛但未人工审核）
export interface PendingReviewItem {
  id: string; // ai_reviewed.id
  candidate_id: string;
  text: string;
  ai_status: string;
  book_id: string;
  book_title: string | null;
  created_at: number;
}

export function getPendingReviewItems(reviewRunId: string): PendingReviewItem[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT
      ar.id AS id,
      ar.candidate_id,
      c.text,
      ar.ai_status,
      c.book_id,
      b.title AS book_title,
      ar.created_at
    FROM ai_reviewed ar
    JOIN candidates c ON ar.candidate_id = c.id
    JOIN books b ON c.book_id = b.id
    LEFT JOIN human_reviewed hr ON ar.id = hr.ai_reviewed_id
    WHERE ar.review_run_id = ? AND hr.id IS NULL
    ORDER BY c.created_at DESC
  `);
  return stmt.all(reviewRunId) as PendingReviewItem[];
}

// 获取已审核的列表
export interface ReviewedItem {
  id: string; // human_reviewed.id
  candidate_id: string;
  text: string;
  ai_status: string;
  final_status: string;
  reviewed_at: number;
}

export function getReviewedItems(reviewRunId: string): ReviewedItem[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT
      hr.id,
      hr.ai_reviewed_id AS candidate_id,
      c.text,
      ar.ai_status,
      hr.final_status,
      hr.reviewed_at
    FROM human_reviewed hr
    JOIN ai_reviewed ar ON hr.ai_reviewed_id = ar.id
    JOIN candidates c ON ar.candidate_id = c.id
    WHERE ar.review_run_id = ?
    ORDER BY hr.reviewed_at DESC
  `);
  return stmt.all(reviewRunId) as ReviewedItem[];
}
