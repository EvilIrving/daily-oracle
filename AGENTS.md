# Codex 使用规范

## 模式行为准则

### Ask/问答模式

- 不得主动修改或编写代码（除非用户明确要求）
- 不添加测试代码
- 不执行 npm/pnpm/yarn dev/build 等命令

### 智能体/Agent 模式

- 可直接操作代码
- 精简分析，直接给出结论

## 输出格式要求

当要求使用 plaintext 格式时：

```plaintext
<输出内容>
```

- 不添加任何开头语、结束语或客套话
- 保持简洁明了


## 
数据库是 supabase


## 前端项目开发

建议使用 svelte 开发前端项目，使用 pnpm 管理依赖，不要使用 yarn 或 npm。
tailwindcss 使用 v3 版本,通过 tailwind.config.js 配置。
避免通过 pnpm dev 启动服务器。

## Macos 软件开发

在开发过程中避免使用 xcode build，仅在开发完成后使用 xcode build 进行打包。

## Flutter 开发
