# server

## 职责

这里只放核心服务层代码：AI 客户端、数据库访问、Extractor、Parser、Chunker、Supabase 客户端。

## 文件清单

- ai-client.ts - Anthropic SDK 封装（支持 baseURL 兼容）
- chunker.ts - 文本按段落切片
- parser.ts - txt 元数据解析 + AI JSON 输出解析 + mood 过滤
- db.ts - SQLite 操作（local_books/runs/candidates/review_log）
- supabase.ts - Supabase service secret key 写入客户端
- extractor.ts - 后台并发提取执行器
- extraction-jobs.ts - 任务调度 + 进度订阅发布
- extraction-control.ts - 运行中任务的中止控制（AbortController）
- quote-verifier.ts - 收录前原文存在性校验
- logger.ts - 结构化日志（info/error）
- env.ts - 环境变量读取封装

## 测试文件

- ai-client.test.ts
- chunker.test.ts
- parser.test.ts
- extractor.test.ts
- quote-verifier.test.ts

## 约束

- 每个服务职责单一、接口清晰、可独立测试
- 不要把 UI 状态或路由逻辑塞进来
- 涉及数据库表结构、字段命名改动时，同步核对 docs/architecture.md 和 supabase/schema.sql
- 测试文件与被测文件同目录，*.test.ts 命名，使用 Vitest
- 当前目录有更新时，随之更新本目录下的 CLAUDE.md 和 AGENTS.md，保持两者一致。
