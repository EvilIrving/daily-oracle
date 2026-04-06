# 本地工作台

## 职责

语料生产、AI 提取、SQLite 待审队列、人工审核、写入 Supabase。

## 技术栈

- pnpm 管理 JS 依赖
- SvelteKit + TailwindCSS v3
- @anthropic-ai/sdk（通过 baseURL 兼容各提供商）
- better-sqlite3（本地待审队列）
- @supabase/supabase-js（service secret key 写入）

## 代码写作规范

- TypeScript 严格模式，类型定义集中在 `lib/types.ts`
- Svelte 5 runes（$state, $derived, $effect）
- 单一职责：server/ 目录只放核心服务，composables/ 放可复用状态逻辑
- 测试文件与被测文件同目录，*.test.ts 命名，使用 Vitest

## 样式规范

- TailwindCSS v3 utility-first
- 不写自定义 CSS，样式全部走 class
- 响应式断点：sm(640px), md(768px), lg(1024px), xl(1280px)

## 目录组织

- src/lib/server/ - 核心服务（AI 客户端、Extractor、Parser、Chunker、DB、Supabase）
- src/lib/components/ - Svelte 组件（QuoteCard、NotificationViewport、tabs/*、extract/*）
- src/lib/composables/ - 组合式函数（useMappers、useProviderConfig）
- src/routes/api/ - API 路由（extract、review、books、library、almanac、review-log）

## 开发约定

- 代码修改后执行 `pnpm check`
- AI 配置只存 localStorage，无配置不能提取
- SQLite 只存缓存，正式数据通过 service secret key 写 Supabase
