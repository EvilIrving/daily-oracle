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

## 约束文件设计范式

项目采用分层约束文档设计：

| 层级 | 文件 | 职责 |
|------|------|------|
| 顶层 | `/CLAUDE.md` | 项目级约定：架构解耦说明、事实源、业务不变量 |
| 子项目 | `server/CLAUDE.md` | 工作台顶层约束：技术栈、代码规范、样式规范 |
| 子项目 | `daily-oracle/CLAUDE.md` | Apple App 顶层约束：iOS 架构、技术方案、代码规范 |
| 模块层 | `*/CLAUDE.md` | 模块具体约束：文件清单、职责边界、特殊约定 |

- CLAUDE.md 定义"是什么"和"怎么做"（架构、规范、约定）
- AGENTS.md 定义"做什么"和"进度"（任务、计划、Phase）
- 子目录 CLAUDE.md 基于实际文件内容定制，包含文件清单和具体约束
- 当前目录有更新时，随之更新本目录下的 CLAUDE.md 和 AGENTS.md

没有想好或者决定的事情写入 `arguments.md`,最新的放上面。
会话中有值得记录的决策或者修改的内容比较复杂，涉及多个模块内容，修复了不宜修复或经常发生的bug，使用 skill /session-log 记录。
