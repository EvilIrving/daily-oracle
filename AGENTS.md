# 项目协作规范

保持 [AGENTS.md](./AGENTS.md) 和 [CLAUDE.md](./CLAUDE.md) 内容一致。任何一方更新，另一方必须同步更新。

Every time Model makes a mistake -> you add a rule
Every time you repeat yourself -> you add a workflow
Every time something breaks -> you add a guardrail

## 输出格式要求

当要求使用 plaintext 格式时：

```plaintext
<输出内容>
```

普通问题控制在 10 句以内，直接回答，不扩展
少用黑话和行话，少分段少列表，保持自然
无须使用礼貌用语

## 项目记忆

- `sessionlog.md` 只记录对后续工作有价值的信息，不记录一次性过程噪音。
- 如果本文件规则已经和代码、文档或实际流程不一致，修代码或修文档后顺手修正本文件。

## 事实源

- [docs/architecture.md](./docs/architecture.md)：架构设计唯一事实源，开发前先读。
- [server/supabase/schema.sql](./server/supabase/schema.sql)：数据库 schema 事实源。
- [docs/prompt-oracle.md](./docs/prompt-oracle.md)：提取分析 prompt。
- [docs/prompt-yi.md](./docs/prompt-yi.md)：生成宜忌 prompt，硬编码在 Edge Function 内。

## 项目结构

三层完全解耦，唯一契约是 schema 和 Edge Function 接口格式：

- `server/`：本地工作台（语料生产、AI 提取、SQLite 待审队列、人工审核、写入 Supabase）
- Supabase：数据持久化 + Edge Function `daily-oracle`
- `daily-oracle/`：Apple App 展示层（iOS / iPadOS / macOS），用户数据全部存本地

## 关键业务不变量

- 名句和宜忌内容先经本地人工审核，再写入 Supabase。
- 审核动作是终态：`收` 立即入库并移出待审清单，`弃` 立即删除。
- 书籍上传前先按 `title + author + year` 判重；重复书目直接拒绝导入，避免多个本地记录共享同一个 `supabase_book_id`。
- App 侧用 publishable key；service secret key 只用于本地工作台和 Edge Function。Supabase 已于 2026-03 废弃 legacy key（anon/service_role），`.env` 中使用 `PUBLISHABLE_KEY` 和 `SERVICE_SECRET_KEY`。
- 涉及字段命名、状态枚举、表结构的改动时，同时检查本地工作台、Supabase 和 iOS App 三层一致性。

## 开发流程

1. 先读 `docs/architecture.md`，确认目标和边界。
2. 改动完成后，同步更新受影响的架构文档、schema 文档和本文件。

## 开发约束

- pnpm 管理 JS 依赖
- SvelteKit + TailwindCSS v3（Local 工作台）
- 代码修改后执行 `pnpm check`

## Apple App 开发约束

- App 目录为 `daily-oracle/`，SwiftUI + SwiftData + WidgetKit，支持 iOS / iPadOS / macOS。
- Deployment Target：iOS/iPadOS 17.6、macOS 14.0；引入更高版本 API 前先调整最低版本。
- 三端共用同一 App target；平台差异集中在视图层最外层用 `#if os()` 处理。
- 测试框架使用 Swift Testing（`import Testing`）。
- 本地存储使用 SwiftData，store URL 指向 App Group container，供主 App 与 Widget 共享。
- 不使用 Supabase Auth；内购使用 StoreKit 2 纯客户端验证。
- 少用 `xcodebuild` 做频繁验证，主要用于最终打包或收尾检查。

## 实施规则

- 文档同步：更新协作规则时，同时修改 AGENTS.md 和 CLAUDE.md。
- 事实核对：以 `docs/architecture.md`、相关代码和用户提供的原文为准。
- 元数据来源：`lang`、`author`、`work`、`year`、`genre` 等字段统一来自 txt 元数据头，不由 AI 生成。
- 环境安全：敏感密钥只放安全配置，不进入仓库；SvelteKit 服务端配置通过 `$env/dynamic/private` 访问。
