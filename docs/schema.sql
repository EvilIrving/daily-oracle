-- ============================================================
-- Daily Quote App — Supabase Schema
-- 仅存储已通过人工审核的数据
-- 无用户体系：用户数据全部存本地 SwiftData + CloudKit
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm"; -- 全文模糊搜索

-- ============================================================
-- 1. 语料库：已审核名句
-- ============================================================

create type quote_lang as enum ('zh', 'en', 'translated');

create type quote_mood as enum (
  'calm', 'happy', 'sad', 'anxious',
  'angry', 'resilient', 'romantic', 'philosophical'
);

create table quotes (
  id            uuid primary key default uuid_generate_v4(),

  -- 核心内容
  text          text not null,
  lang          quote_lang not null,
  author        text,
  work          text,
  year          smallint,

  -- 分类标签
  genre         text,                                -- 体裁（单值，从 txt 元数据头解析）
  mood          quote_mood[]  not null default '{}', -- 情绪（数组，AI 输出）
  themes        text[]        not null default '{}', -- 语义主题词（数组，AI 输出）

  -- 来源追踪
  source_book   text,     -- 原始书名（可能与 work 不同）
  batch_id      uuid,     -- 关联到 extraction_batches

  -- 审核信息
  reviewed_at   timestamptz not null default now(),

  -- 软删除
  is_active     boolean not null default true,

  -- 时间戳
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 索引
create index idx_quotes_lang      on quotes (lang);
create index idx_quotes_active    on quotes (is_active);
create index idx_quotes_mood      on quotes using gin (mood);
create index idx_quotes_themes    on quotes using gin (themes);
create index idx_quotes_text_trgm on quotes using gin (text gin_trgm_ops);

-- updated_at 自动更新
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger quotes_updated_at
  before update on quotes
  for each row execute function update_updated_at();

-- ============================================================
-- 2. 提取批次记录（元数据，不存原始文本）
-- ============================================================

create type batch_status as enum ('done', 'partial');

create table extraction_batches (
  id              uuid primary key default uuid_generate_v4(),

  -- 书目信息
  book_title      text not null,
  book_author     text,
  book_year       smallint,
  book_genre      text,           -- 体裁（单值）
  source_lang     text,           -- 原文语言，如 'zh', 'en', 'ja'
  douban_score    numeric(3,1),   -- 豆瓣评分

  -- 提取统计
  total_chunks    int not null default 0,
  done_chunks     int not null default 0,
  failed_chunks   int not null default 0,
  extracted_count int not null default 0,  -- AI 输出候选数
  accepted_count  int not null default 0,  -- 人工通过数
  rejected_count  int not null default 0,

  -- 模型配置快照
  model_config    jsonb not null default '{}',

  status          batch_status not null default 'done',
  created_at      timestamptz not null default now()
);

create index idx_batches_created on extraction_batches (created_at desc);

-- ============================================================
-- 3. 宜忌记录（生成式，按日期缓存）
-- ============================================================

create table almanac_entries (
  id          uuid primary key default uuid_generate_v4(),

  date        date not null unique,  -- 每天唯一

  yi          text not null,   -- 宜
  ji          text not null,   -- 忌

  -- 生成时的上下文信号
  signals     jsonb not null default '{}',

  -- 生成模型
  model_used  text,

  -- 人工修改
  edited      boolean not null default false,

  created_at  timestamptz not null default now()
);

create index idx_almanac_date on almanac_entries (date desc);

-- ============================================================
-- 4. Row Level Security
-- ============================================================

alter table quotes             enable row level security;
alter table extraction_batches enable row level security;
alter table almanac_entries    enable row level security;

-- quotes: 公开只读
create policy "quotes_public_read"
  on quotes for select
  using (is_active = true);

-- quotes: 仅 service_role 可写
create policy "quotes_service_write"
  on quotes for all
  using (auth.role() = 'service_role');

-- almanac: 公开只读
create policy "almanac_public_read"
  on almanac_entries for select
  using (true);

-- almanac: Edge Function 可写（service_role）
create policy "almanac_service_write"
  on almanac_entries for all
  using (auth.role() = 'service_role');

-- extraction_batches: 仅 service_role
create policy "batches_service_only"
  on extraction_batches for all
  using (auth.role() = 'service_role');

-- ============================================================
-- 5. 便捷视图
-- ============================================================

-- 按心情随机取一条
create or replace view v_quote_by_mood as
select
  id, text, lang, author, work, year,
  genre, mood, themes
from quotes
where is_active = true
order by random();

-- 库存统计
create or replace view v_corpus_stats as
select
  count(*) filter (where is_active)                       as total_active,
  count(*) filter (where lang = 'zh' and is_active)       as lang_zh,
  count(*) filter (where lang = 'en' and is_active)       as lang_en,
  count(*) filter (where lang = 'translated' and is_active) as lang_translated
from quotes;
