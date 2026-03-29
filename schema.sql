-- =============================================
-- 今日谕句系统 Supabase Schema v3
-- =============================================

-- =============================================
-- 文本来源表（书籍、歌词、文章等）
-- =============================================
create table sources (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  author       text,
  lang         text not null default 'zh',
  type         text not null default 'book'
                 check (type in ('book', 'lyrics', 'article')),
  file_name    text,
  status       text not null default 'pending'
                 check (status in ('pending', 'processing', 'done', 'error')),
  total_quotes int  default 0,
  error_msg    text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- =============================================
-- 文本切片表（解析后的原始段落，处理中间态）
-- =============================================
create table source_segments (
  id          uuid primary key default gen_random_uuid(),
  source_id   uuid references sources(id) on delete cascade,
  content     text not null,
  chunk_index int  not null,
  status      text not null default 'pending'
                check (status in ('pending', 'processed', 'failed')),
  created_at  timestamptz not null default now()
);

-- =============================================
-- 谕句库（上传流程产出，经审核后入库）
-- =============================================
create table oracle_quotes (
  id          uuid primary key default gen_random_uuid(),
  source_id   uuid references sources(id) on delete cascade,
  text        text not null,
  lang        text not null default 'zh',
  author      text,
  work        text,
  source_ref  text,            -- 章节或位置描述
  emotion     text[],          -- calm/happy/sad/anxious/angry/resilient/romantic/philosophical
  weather_fit text[],          -- sunny/cloudy/rainy/snowy/windy 等
  place_fit   text[],          -- home/outdoor/commute/office 等
  weight      int  default 2 check (weight between 1 and 3),
  status      text not null default 'pending_review'
                check (status in ('pending_review', 'approved', 'rejected')),
  created_at  timestamptz not null default now()
);

-- =============================================
-- 宜库（generate-tips.js 独立脚本产出）
-- =============================================
create table daily_dos (
  id          uuid primary key default gen_random_uuid(),
  text        text not null,
  emotion     text[],
  weather_fit text[],
  place_fit   text[],
  status      text not null default 'pending_review'
                check (status in ('pending_review', 'approved', 'rejected')),
  created_at  timestamptz not null default now()
);

-- =============================================
-- 忌库（generate-tips.js 独立脚本产出）
-- =============================================
create table daily_donts (
  id          uuid primary key default gen_random_uuid(),
  text        text not null,
  emotion     text[],
  weather_fit text[],
  place_fit   text[],
  status      text not null default 'pending_review'
                check (status in ('pending_review', 'approved', 'rejected')),
  created_at  timestamptz not null default now()
);

-- =============================================
-- 设备表（匿名设备身份，Phase 2 去重用）
-- =============================================
create table devices (
  id         text primary key,  -- 客户端首次启动时生成
  created_at timestamptz not null default now()
);

-- =============================================
-- 内容投放记录（设备级去重，Phase 2 分发用）
-- =============================================
create table delivery_logs (
  id           uuid primary key default gen_random_uuid(),
  device_id    text references devices(id) on delete cascade,
  content_type text not null check (content_type in ('quote', 'do', 'dont')),
  content_id   uuid not null,  -- 逻辑引用 oracle_quotes/daily_dos/daily_donts
  delivered_at timestamptz not null default now()
);

-- =============================================
-- RLS 配置
-- sources / source_segments：仅后台 service_role 访问，保持关闭
-- oracle_quotes / daily_dos / daily_donts：App anon key 只读已审核内容
-- devices / delivery_logs：App anon key 可操作自己的行
-- =============================================

-- 后台专用表，保持 RLS 关闭
alter table sources         disable row level security;
alter table source_segments disable row level security;

-- 内容表：开启 RLS，anon 只读 approved 内容
alter table oracle_quotes enable row level security;
alter table daily_dos     enable row level security;
alter table daily_donts   enable row level security;

create policy "anon read approved quotes"
  on oracle_quotes for select
  to anon
  using (status = 'approved');

create policy "anon read approved dos"
  on daily_dos for select
  to anon
  using (status = 'approved');

create policy "anon read approved donts"
  on daily_donts for select
  to anon
  using (status = 'approved');

-- 设备表：开启 RLS，anon 通过 x-device-id 请求头隔离
-- 客户端初始化 Supabase 时须设置 global header: { 'x-device-id': deviceId }
alter table devices enable row level security;

create policy "anon insert own device"
  on devices for insert
  to anon
  with check (id = current_setting('request.headers', true)::json->>'x-device-id');

create policy "anon read own device"
  on devices for select
  to anon
  using (id = current_setting('request.headers', true)::json->>'x-device-id');

-- 投放记录表：开启 RLS，anon 只能读写自己设备的记录
alter table delivery_logs enable row level security;

create policy "anon insert own delivery log"
  on delivery_logs for insert
  to anon
  with check (device_id = current_setting('request.headers', true)::json->>'x-device-id');

create policy "anon read own delivery logs"
  on delivery_logs for select
  to anon
  using (device_id = current_setting('request.headers', true)::json->>'x-device-id');

-- =============================================
-- 索引
-- =============================================
create index idx_sources_status          on sources(status);
create index idx_source_segments_source  on source_segments(source_id);
create index idx_source_segments_status  on source_segments(status);
create index idx_oracle_quotes_source    on oracle_quotes(source_id);
create index idx_oracle_quotes_status    on oracle_quotes(status);
create index idx_daily_dos_status        on daily_dos(status);
create index idx_daily_donts_status      on daily_donts(status);
create index idx_delivery_logs_device    on delivery_logs(device_id);
create index idx_delivery_logs_content   on delivery_logs(content_type, content_id);

-- =============================================
-- 自动更新 updated_at（仅 sources 有此字段）
-- =============================================
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger sources_updated_at
  before update on sources
  for each row execute function update_updated_at();
