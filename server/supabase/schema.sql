-- ============================================================
-- Daily Quote App — Supabase Schema
-- 存储正式书目、已审核名句、每日宜忌缓存
-- 无用户体系：用户数据全部存本地 SwiftData + CloudKit
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm"; -- 全文模糊搜索

-- ============================================================
-- 1. 书目：正式书籍元数据
-- ============================================================

create type book_lang as enum ('zh', 'en', 'translated', 'other');

create table books (
  id            uuid primary key default uuid_generate_v4(),

  -- 核心书目信息
  title         text not null,
  author        text,
  year          smallint,
  genre         text,
  lang          book_lang not null default 'other',

  -- 扩展元数据
  source_label  text,           -- 原始 txt 元数据头中的语言或来源描述
  douban_score  numeric(3,1),
  notes         text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index idx_books_title_author_year
  on books (title, coalesce(author, ''), coalesce(year, 0));

create index idx_books_created_at on books (created_at desc);

-- ============================================================
-- 2. 语料库：已审核名句
-- ============================================================

create type quote_mood as enum (
  'calm', 'sad', 'anxious', 'happy',
  'hopeful', 'tender', 'contemplative', 'angry'
);

create table quotes (
  id            uuid primary key default uuid_generate_v4(),

  -- 关联书目
  book_id       uuid not null references books(id) on delete restrict,

  -- 核心内容
  text          text not null,

  -- 分类标签
  mood          quote_mood[] not null default '{}',
  themes        text[] not null default '{}',

  -- 审核信息
  reviewed_at   timestamptz not null default now(),

  -- 软删除
  is_active     boolean not null default true,

  -- 时间戳
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_quotes_book_id on quotes (book_id);
create index idx_quotes_active on quotes (is_active);
create index idx_quotes_mood on quotes using gin (mood);
create index idx_quotes_themes on quotes using gin (themes);
create index idx_quotes_text_trgm on quotes using gin (text gin_trgm_ops);

-- updated_at 自动更新
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger books_updated_at
  before update on books
  for each row execute function update_updated_at();

create trigger quotes_updated_at
  before update on quotes
  for each row execute function update_updated_at();

-- ============================================================
-- 3. 宜忌记录（生成式，按日期缓存）
-- ============================================================

create table almanac (
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

create index idx_almanac_date on almanac (date desc);

-- ============================================================
-- 4. Row Level Security
-- ============================================================

alter table books enable row level security;
alter table quotes enable row level security;
alter table almanac enable row level security;

-- books: 公开只读
create policy "books_public_read"
  on books for select
  using (true);

-- books: 仅 service_role 可写
create policy "books_service_write"
  on books for all
  using (auth.role() = 'service_role');

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
  on almanac for select
  using (true);

-- almanac: Edge Function 可写（service_role）
create policy "almanac_service_write"
  on almanac for all
  using (auth.role() = 'service_role');

-- ============================================================
-- 5. 便捷视图
-- ============================================================

-- 按心情随机取一条，并附带书目信息
create or replace view v_quote_by_mood as
select
  q.id,
  q.text,
  q.mood,
  q.themes,
  b.id as book_id,
  b.title,
  b.author,
  b.year,
  b.genre,
  b.lang
from quotes q
join books b on b.id = q.book_id
where q.is_active = true
order by random();

-- 库存统计
create or replace view v_corpus_stats as
select
  count(*) filter (where q.is_active) as total_active,
  count(*) filter (where b.lang = 'zh' and q.is_active) as lang_zh,
  count(*) filter (where b.lang = 'en' and q.is_active) as lang_en,
  count(*) filter (where b.lang = 'translated' and q.is_active) as lang_translated
from quotes q
join books b on b.id = q.book_id;
