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
- 反复遇到的错误、修复方式、稳定结论，沉淀到本文件，不只留在 `sessionlog.md`。
- 如果本文件规则已经和代码、文档或实际流程不一致，修代码或修文档后顺手修正本文件。

## 事实源与文档

- [docs/architecture.md](/Users/cain/Documents/code/swift-daily-oracle/docs/architecture.md) 是架构设计唯一事实源。开发前先读；架构或流程变更后同步更新。
- [docs/schema.sql](/Users/cain/Documents/code/swift-daily-oracle/docs/schema.sql) 是数据库 schema 事实源。涉及表结构、字段、RLS、索引时，与架构文档一起更新。
- [docs/env.md](/Users/cain/Documents/code/swift-daily-oracle/docs/env.md) 是环境变量与外部服务配置清单。新增、删除、重命名环境变量时同步更新。
- `docs/` 下的 UI 参考图只用于视觉和交互参考，不当作真实实现。

## 项目结构

- `server/` 是本地工作台，负责 txt 解析、AI 提取、SQLite 待审队列、人工审核和提交到 Supabase。
- iOS App 是展示层和交互层，不承载语料生产和审核逻辑。
- Supabase 负责正式数据持久化、RLS 和 Edge Functions。
- 本地 SQLite 只是待审队列，正式数据以 Supabase 为准。

## 关键业务不变量

- 名句和宜忌内容先经本地人工审核，再写入 Supabase。
- 待审名句的审核动作是终态：`收` 立即入库并移出本地待审清单，`弃` 立即删除本地待审项。
- App 侧用 anon key 调用 Edge Function 和公开只读数据；`service_role` 只用于本地工作台和 Edge Function。
- txt 顶部元数据头的解析规则是稳定契约；修改前同时检查解析器、prompt、入库字段和审核界面。
- 涉及字段命名、状态枚举、表结构的改动时，同时检查本地工作台、Supabase 和 iOS App 三层一致性。

## 开发流程

1. 先阅读 [docs/architecture.md](/Users/cain/Documents/code/swift-daily-oracle/docs/architecture.md)，确认目标和边界。
2. 再阅读相关代码和文档，避免基于旧 README 或旧目录结构做假设。
3. 优先修改真实代码，不在文档里提前承诺未落地的实现。
4. 改动完成后，同步更新受影响的架构文档、schema 文档、环境变量文档和本文件。
5. 在允许范围内完成测试或验证，再进行 build 或交付。

## 前端开发约束

- 管理后台使用 SvelteKit，包管理使用 `pnpm`。
- TailwindCSS 固定使用 v3，通过 `tailwind.config.js` 配置。
- 默认优先使用检查、测试、build 这类不会长期占用会话的命令，而不是 `pnpm dev`。
- 修改页面、接口或状态流时，同时检查路由层、`lib/server`、类型定义和 UI 文案。
- 涉及书籍导入、提取工作台或本地持久化流程时，先对照 [tools/test-book-pipeline.html](/Users/cain/Documents/code/swift-daily-oracle/tools/test-book-pipeline.html) 的现有交互与状态处理，再决定删减或迁移哪些能力。

## Apple App 开发约束（iOS / iPadOS / macOS）

- App 目录为 `daily-oracle/`，使用 SwiftUI + SwiftData + WidgetKit。
- 项目支持 `iOS + iPadOS + macOS` 三个平台，使用原生 SwiftUI 多平台 destination，不使用 Mac Catalyst。
- 开发节奏：先完成 iOS，再适配 iPadOS，最后补充 macOS 差异。
- Deployment Target 统一为 `iOS/iPadOS 17.6`、`macOS 14.0`；引入更高版本 API 前，先调整项目最低版本和文档。
- 三端共用同一个 App target 和业务层；平台差异集中在视图层最外层用 `#if os()` 处理。
- 测试框架使用 Swift Testing（`import Testing`）。
- 本地存储使用 SwiftData，store URL 指向 App Group container，供主 App 与 Widget 共享。
- 轻量级标志位可使用 App Group UserDefaults，业务数据统一走 SwiftData。
- Widget 仅使用 SwiftUI，并覆盖 iOS、iPadOS、macOS；macOS Widget 额外检查 `supportedFamilies`。
- App 主线直接连接真实 Supabase 数据与 Edge Function，不以 mock 数据为默认前提。
- App 使用 WeatherKit 在客户端取天气，并把结果作为请求参数传给 Edge Function。
- 无用户体系：不使用 Supabase Auth，用户数据全部存本地 SwiftData + CloudKit 同步。
- 内购使用 StoreKit 2 纯客户端验证。
- 开发过程中少用 `xcodebuild` 做频繁验证，主要用于最终打包或收尾检查。
- 涉及 Widget、App Group、天气服务或本地存储共享时，同时检查主 App 和 Widget 扩展的数据契约。

## 测试与验证

- 所有代码改动都要有对应验证，至少覆盖受影响的核心路径。
- 在 `dev`、`build` 或最终打包前，优先跑测试、静态检查或最小闭环验证。
- 如果仓库缺少完整自动化测试，明确记录实际执行过的验证步骤，不做“应该没问题”的假设。

## 实施规则

- 文档同步：更新协作规则时，同时修改 [AGENTS.md](/Users/cain/Documents/code/swift-daily-oracle/AGENTS.md) 和 [CLAUDE.md](/Users/cain/Documents/code/swift-daily-oracle/CLAUDE.md)。
- 事实核对：实现、答复和判断以 [docs/architecture.md](/Users/cain/Documents/code/swift-daily-oracle/docs/architecture.md)、相关代码和用户提供的原文为准，不把旧 README、临时数据或未核实信息当事实。
- 文档落地：架构、schema、环境变量或关键工作流有变更时，代码与对应文档同一轮更新。
- 元数据来源：`lang`、`author`、`work`、`year`、`genre` 等字段统一来自 txt 元数据头，不由 AI 生成。
- 提取链路：提取状态、进度、超时、SSE、并发和任务边界都以当前实现为准；进度提示基于真实状态、chunk 进度或明确兜底原因。
- 提取健壮性：txt 分隔符兼容 BOM、零宽字符、全角和长横线等变体；SSE / ReadableStream 写入前先处理连接关闭和取消订阅。
- AI 数据入库：AI 请求结构保持 `system` 承载提示词模板、`user` 承载来源信息和正文分片；`moods` 先按 [docs/schema.sql](/Users/cain/Documents/code/swift-daily-oracle/docs/schema.sql) 的 `quote_mood` 枚举过滤，再写入 SQLite 或 Supabase。
- 人工审核入库：人工点击 `收` 时，候选句先按归一化文本在原始正文中命中，命中后再写入 Supabase；提交失败时打印服务端错误日志。
- 环境与安全：SvelteKit 服务端运行时配置统一通过 `$env/dynamic/private` 封装访问；敏感密钥、私钥和生产凭证只放安全配置，不进入仓库。
- 可观测性：本地工作台的上传解析、AI 请求与响应、提取进度和错误都打印到服务端控制台。
- 管理后台交互：页面只展示当前视图需要的信息，不重复主导航标题，不引入架构未定义的业务概念；删除操作优先乐观更新，高风险删除优先行内确认。
- Apple 平台兼容：主线代码保持 `iOS 17.6 / macOS 14.0` 兼容，不混入未使用的 Xcode 模板文件，也不直接引入仅 `iOS 18+ / macOS 15+` 可用的 WidgetKit、AppIntents 或 Control Widget API。
