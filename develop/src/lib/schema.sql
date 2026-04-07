-- 每日一句工作台数据库 Schema
-- 支持：粗筛 → AI 精筛 → 人工复审 三阶段流程

-- 书籍表
CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  title TEXT,
  author TEXT,
  year INTEGER,
  language TEXT,
  genre TEXT,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_books_created_at ON books(created_at DESC);

-- 粗筛批次
CREATE TABLE IF NOT EXISTS extraction_runs (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  status TEXT NOT NULL, -- idle/running/completed/stopped/error
  total_chunks INTEGER NOT NULL,
  processed_chunks INTEGER NOT NULL DEFAULT 0,
  failed_chunks INTEGER NOT NULL DEFAULT 0,
  config_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_extraction_runs_book_id ON extraction_runs(book_id);
CREATE INDEX IF NOT EXISTS idx_extraction_runs_status ON extraction_runs(status);

-- 粗筛候选
CREATE TABLE IF NOT EXISTS candidates (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES extraction_runs(id) ON DELETE CASCADE,
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  normalized_text TEXT NOT NULL,
  source_chunk_index INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(run_id, normalized_text)
);

CREATE INDEX IF NOT EXISTS idx_candidates_run_id ON candidates(run_id);
CREATE INDEX IF NOT EXISTS idx_candidates_book_id ON candidates(book_id);

-- 精筛批次
CREATE TABLE IF NOT EXISTS review_runs (
  id TEXT PRIMARY KEY,
  extraction_run_id TEXT NOT NULL REFERENCES extraction_runs(id) ON DELETE CASCADE,
  mode TEXT NOT NULL, -- 'one-by-one' | 'chunk-by-chunk'
  status TEXT NOT NULL,
  total_items INTEGER NOT NULL,
  processed_items INTEGER NOT NULL DEFAULT 0,
  config_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_review_runs_extraction_run_id ON review_runs(extraction_run_id);
CREATE INDEX IF NOT EXISTS idx_review_runs_status ON review_runs(status);

-- AI 精筛结果（待人工复审）
CREATE TABLE IF NOT EXISTS ai_reviewed (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  review_run_id TEXT NOT NULL REFERENCES review_runs(id) ON DELETE CASCADE,
  ai_status TEXT NOT NULL, -- 'approved' | 'rejected'
  created_at INTEGER NOT NULL,
  UNIQUE(candidate_id, review_run_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_reviewed_candidate_id ON ai_reviewed(candidate_id);
CREATE INDEX IF NOT EXISTS idx_ai_reviewed_review_run_id ON ai_reviewed(review_run_id);
CREATE INDEX IF NOT EXISTS idx_ai_reviewed_ai_status ON ai_reviewed(ai_status);

-- 人工最终审核
CREATE TABLE IF NOT EXISTS human_reviewed (
  id TEXT PRIMARY KEY,
  ai_reviewed_id TEXT NOT NULL REFERENCES ai_reviewed(id) ON DELETE CASCADE,
  final_status TEXT NOT NULL, -- 'approved' | 'rejected'
  reviewed_at INTEGER NOT NULL,
  UNIQUE(ai_reviewed_id)
);

CREATE INDEX IF NOT EXISTS idx_human_reviewed_ai_reviewed_id ON human_reviewed(ai_reviewed_id);
CREATE INDEX IF NOT EXISTS idx_human_reviewed_final_status ON human_reviewed(final_status);
