# 每日名句 — 后台管理系统

## 整体架构

```
本地运行
├── server/          # Node.js 本地服务（解析、拆分、调模型、写库）
└── frontend/        # SvelteKit 管理后台（上传、审核、配置）

云端
└── Supabase         # 只做数据库，存 books / quotes / daily_tips / settings
```

---

## 目录结构

```
server/
├── package.json
├── .env                        # SUPABASE_URL, SUPABASE_SERVICE_KEY
└── src/
    ├── server.js               # Express 入口
    ├── supabase.js             # Supabase client（service_role）
    ├── generate-tips.js        # 独立脚本：批量生成宜忌条目
    ├── routes/
    │   ├── books.js            # POST /books/upload, GET /books
    │   ├── quotes.js           # GET /quotes, PATCH /quotes/:id, DELETE /quotes/:id
    │   ├── tips.js             # GET /tips, PATCH /tips/:id, DELETE /tips/:id
    │   └── settings.js         # GET /settings, PUT /settings
    └── lib/
        ├── parser.js           # epub/txt 解析 → 纯文本
        ├── splitter.js         # 文本拆分 → chunks（按章节或 ~1500 词滑动窗口）
        └── analyzer.js         # 逐 chunk 调模型 → 返回候选 quotes

frontend/
├── package.json
├── tailwind.config.js
├── postcss.config.js
├── svelte.config.js
├── vite.config.js
├── .env                        # PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY
│                               # PUBLIC_SERVER_URL=http://localhost:3000
└── src/
    ├── app.html
    ├── lib/
    │   ├── supabase.js         # Supabase client（anon key）
    │   └── api.js              # 调本地 server 的封装函数
    └── routes/
        ├── +layout.svelte      # 导航栏：上传 / 名句审核 / 宜忌审核 / 设置
        ├── +page.svelte        # 首页 → 重定向到 /review/quotes
        ├── upload/
        │   └── +page.svelte    # 上传图书 + 书籍列表 + 任务进度
        ├── review/
        │   ├── quotes/
        │   │   └── +page.svelte  # 名句审核（待审核列表，inline 通过/删除）
        │   └── tips/
        │       └── +page.svelte  # 宜忌审核（同上）
        └── settings/
            └── +page.svelte    # API Key / Base URL / Model ID / 提示词模板
```

---

## 数据表

| 表 | 说明 |
|---|---|
| `books` | 上传的书籍及处理状态 |
| `quotes` | 从书中提取的名句候选，含审核状态 |
| `daily_tips` | AI 生成的每日宜忌，含审核状态 |
| `settings` | 系统配置 key-value（api_key / base_url / model / 提示词）|

审核状态统一三态：`pending_review` / `approved` / `rejected`

---

## 启动步骤

### 1. Supabase 建表

在 Supabase SQL Editor 里运行 `schema.sql`，完成后拿到：

- Project URL
- service_role key（server 用，有写权限）
- anon key（frontend 用）

### 2. 启动 Server

```bash
cd server
pnpm install
```

创建 `.env`：

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
PORT=3000
```

```bash
pnpm run dev   # 监听 http://localhost:3000
```

### 3. 启动 Frontend

```bash
cd frontend
pnpm install
```

创建 `.env`：

```
PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJ...
PUBLIC_SERVER_URL=http://localhost:3000
```

```bash
pnpm run dev   # 监听 http://localhost:5173
```

---

## 名句生成流程

```
用户在上传页填写书名/作者 → 选择 epub 或 txt 文件 → 点击上传
      ↓
server: parser.js 解析成纯文本
      ↓
server: splitter.js 拆分
        epub → 按章节拆
        txt  → 按 ~1500 词滑动窗口拆，保留段落完整性
      ↓
server: analyzer.js 逐块调 OpenAI 兼容接口（串行，块间隔 500ms）
      ↓
结果写入 quotes 表（status = pending_review）
      ↓
前端「名句审核」页：逐条通过（approved）或删除（rejected）
```

---

## 宜忌生成流程

```
# 独立脚本，手动触发，按需多次运行
node src/generate-tips.js 100
      ↓
调模型批量生成（每批 20 条，批间隔 1s）
      ↓
写入 daily_tips 表（status = pending_review）
      ↓
前端「宜忌审核」页：逐条通过或删除
```

建议每次生成 40-60 条，审核留下 20-30 条，多轮积累。

---

## 审核交互设计

- 无弹窗：删除直接生效，从列表移除
- 状态机：`pending_review` → `approved` 或 `rejected`
- 审核页默认只显示 `pending_review`，可切换查看已通过

---

## 配置项说明

| key | 说明 | 默认值 |
|---|---|---|
| `api_key` | OpenAI 兼容接口的 API Key | 空 |
| `base_url` | 接口 Base URL | `https://api.openai.com/v1` |
| `model` | 模型 ID，手动填写 | `gpt-4o` |
| `prompt_template` | 名句筛选提示词，`{{chunk}}` 为段落占位符 | 内置默认值 |
| `tips_prompt` | 宜忌生成提示词，`{{count}}` 为数量占位符 | 内置默认值 |

保存到 浏览器 localStorage 中。不上传。
