# Claude 使用规范

保持 CLAUDE.md 文件内容和 AGENTS.md 保持一致。

Every time Claude makes a mistake → you add a rule
Every time you repeat yourself → you add a workflow
Every time something breaks → you add a guardrail

## 输出格式要求

当要求使用 plaintext 格式时：

```plaintext
<输出内容>
```

- 不添加任何开头语、结束语或客套话
- 保持简洁明了

sessionlog.md 是调用 /session-log skill 生成，基于 session 有价值的部分对话内容的记录。

## 项目文档

- `docs/PRD.md` 是项目需求文档，每次开发前都要仔细阅读。
- `schema.sql` 是数据库 schema，每次开发前都要仔细阅读。

## 数据库

数据库使用 Supabase。核心表：

| 表 | 说明 |
|---|---|
| `sources` | 上传的文本来源（书籍/歌词/文章） |
| `source_segments` | 解析后的切片，处理中间态 |
| `oracle_quotes` | 谕句库，上传流程产出，经审核后入库 |
| `daily_dos` | 宜库，generate-tips.js 独立脚本产出 |
| `daily_donts` | 忌库，generate-tips.js 独立脚本产出 |
| `devices` | 匿名设备表（Phase 2 去重用） |
| `delivery_logs` | 内容投放记录（Phase 2 分发去重用） |

审核状态统一三态：`pending_review` / `approved` / `rejected`

settings 配置由前端 localStorage 管理，不入库。

## 内容生产流程

- **谕句**：上传文本 → 解析切片 → AI 初筛 → oracle_quotes（pending_review）→ 人工审核
- **宜/忌**：`node generate-tips.js [数量]` → daily_dos / daily_donts（pending_review）→ 人工审核

generate-tips.js 依赖环境变量：`API_KEY`、`BASE_URL`、`MODEL`、`TIPS_PROMPT`（可选）

## 前端项目开发

- 使用 SvelteKit 开发管理后台，pnpm 管理依赖，不要使用 yarn 或 npm。
- tailwindcss 使用 v3 版本，通过 tailwind.config.js 配置。
- 避免通过 pnpm dev 启动服务器。

## macOS 软件开发

- 在开发过程中避免使用 xcode build，仅在开发完成后使用 xcode build 进行打包。
