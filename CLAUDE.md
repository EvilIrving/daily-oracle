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

- `docs/architecture.md` 是项目架构设计文档，每次开发前都要仔细阅读，有任何变动需要更新它，保持是最新的/与代码是一致的。
- `designs/` 是UI 参考， 用来生成界面（后台系统 or  app），不要修改设计文件。
- `schema.sql` 是数据库 schema，每次开发前都要仔细阅读。

## 前端项目开发

- 使用 SvelteKit 开发管理后台，pnpm 管理依赖，不要使用 yarn 或 npm。
- tailwindcss 使用 v3 版本，通过 tailwind.config.js 配置。
- 避免通过 pnpm dev 启动服务器。

## macOS 软件开发

- 在开发过程中避免使用 xcode build，仅在开发完成后使用 xcode build 进行打包。
