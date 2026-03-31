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

如果是普通的问题，请你回答保持在 10 句以内，无须扩展或者引申，直接回答问题
避免使用黑话、行话，减少分段和列表，保持自然表达
无须使用礼貌用语

## 项目记忆

- `sessionlog.md` 是调用 `/session-log` skill 生成的会话摘要，只记录对后续工作有价值的信息，不记录一次性过程噪音。
- 反复遇到的错误、修复方式、稳定结论，应沉淀到本文件，而不是只留在 `sessionlog.md`。
- 如果发现本文件规则已经和代码、文档或实际流程不一致，修代码或修文档后必须顺手修正本文件。

## 事实源与文档

- [docs/architecture.md](/Users/cain/Documents/code/swift-daily-oracle/docs/architecture.md) 是项目架构设计的唯一事实源。每次开发前先读，任何架构或流程变更后都要同步更新。
- [docs/schema.sql](/Users/cain/Documents/code/swift-daily-oracle/docs/schema.sql) 是数据库 schema 文件，依赖于架构设计；涉及表结构、字段、RLS、索引的变更时，必须与架构文档保持一致。
- [docs/env.md](/Users/cain/Documents/code/swift-daily-oracle/docs/env.md) 是环境变量与外部服务配置清单；新增、删除、重命名环境变量时必须同步更新。
- `docs/` 下的 UI 参考图仅用于视觉和交互风格参考，不能直接修改设计源文件，也不能把设计稿当成真实实现。

## 项目结构

- `server/` 是本地工作台，承担 txt 解析、AI 提取、SQLite 待审队列、人工审核和提交到 Supabase 的流程。
- iOS App 是展示层和用户交互层，不承载语料生产和审核逻辑。
- Supabase 承担正式数据持久化、RLS 和 Edge Functions。
- 本地 SQLite 仅是待审队列，不是正式业务数据源；正式数据以 Supabase 为准。

## 关键业务不变量

- 名句或宜忌内容必须先经过本地人工审核，审核通过后才能写入 Supabase。
- 待审名句的审核动作是终态：`收` 即立即写入 Supabase 并从本地待审清单移除，`弃` 即立即删除本地待审项，不保留可反复切换的中间状态。
- App 侧使用匿名登录和 anon/publishable key，只读或按 RLS 约束访问；`service_role` 仅用于本地工作台或受控服务端。
- txt 文件顶部元数据头的解析规则属于稳定契约，修改前必须同步检查解析器、prompt、入库字段和审核界面。
- 涉及字段命名、状态枚举、表结构的改动，必须同时检查本地工作台、Supabase 和 iOS App 三层是否一致。

## 开发流程

1. 先阅读 [docs/architecture.md](/Users/cain/Documents/code/swift-daily-oracle/docs/architecture.md)，确认当前实现目标和边界。
2. 再阅读相关代码和文档，避免基于旧 README 或旧目录结构做假设。
3. 开发时优先修改真实代码，不在文档里提前承诺未落地的实现。
4. 代码改动完成后，更新受影响的架构文档、schema 文档、环境变量文档和本文件。
5. 在允许的范围内完成测试或验证，再进行 build 或交付。

## 前端开发约束

- 管理后台使用 SvelteKit，包管理使用 `pnpm`。
- TailwindCSS 固定使用 v3，通过 `tailwind.config.js` 配置，不按 v4 的方式组织配置。
- 避免使用 `pnpm dev` 作为默认工作流；优先使用不会长期占用交互会话的检查、测试、build 命令。
- 修改页面、接口或状态流时，要同时检查路由层、`lib/server`、类型定义和 UI 文案是否一致。
- 涉及书籍导入、提取工作台或本地持久化流程时，先对照 [tools/test-book-pipeline.html](/Users/cain/Documents/code/swift-daily-oracle/tools/test-book-pipeline.html) 的现有交互与状态处理，再决定删减或迁移哪些能力。

## iOS 开发约束

- iOS App 目录为 `daily-oracle/`，使用 SwiftUI + SwiftData + WidgetKit。
- Deployment Target: iOS 17.0。
- 测试框架使用 Swift Testing（`import Testing`），不使用 XCTest。
- 本地存储使用 SwiftData；SwiftData store URL 指向 App Group container 以实现主 App 与 Widget 数据共享。
- 轻量级标志位（如 `lastFetchDate`）可使用 App Group UserDefaults，业务数据统一走 SwiftData。
- Widget 只能使用 SwiftUI，不可引入 UIKit。
- 一期不接后端，使用 mock 数据开发；后续接入 Supabase Swift SDK 和 QWeatherSDK。

## macOS 开发约束

- 开发过程中避免使用 `xcode build` 作为频繁验证手段。
- 仅在开发完成、需要最终打包或做收尾验证时再执行 `xcode build`。
- 涉及 Widget、App Group、天气服务或本地存储共享时，要同时检查主 App 和 Widget 扩展的数据契约。

## 测试与验证

- 所有代码相关改动都应有对应验证，至少覆盖受影响的核心路径。
- 在 `dev`、`build` 或最终打包前，优先先跑测试、静态检查或最小闭环验证。
- 如果当前仓库缺少完整自动化测试，要明确记录实际执行过的验证步骤，不要假设“应该没问题”。

## Guardrails

- 不要让 AI 输出 `lang`、`author`、`work`、`year`、`genre` 这类元数据；这些字段统一来自 txt 元数据头，其中 `lang` 由书籍语言派生。
- 不要用硬编码宽度或静默吞空结果来表示提取状态；进度和结果提示必须基于真实提取状态、chunk 进度或明确的兜底原因。
- 不要只修改 [AGENTS.md](/Users/cain/Documents/code/swift-daily-oracle/AGENTS.md) 或 [CLAUDE.md](/Users/cain/Documents/code/swift-daily-oracle/CLAUDE.md) 其中一个文件。
- 不要把 [README.md](/Users/cain/Documents/code/swift-daily-oracle/README.md) 中的旧结构直接当成当前实现事实，目录和架构以 [docs/architecture.md](/Users/cain/Documents/code/swift-daily-oracle/docs/architecture.md) 为准。
- 不要在未核对 [docs/architecture.md](/Users/cain/Documents/code/swift-daily-oracle/docs/architecture.md)、相关路由和前端调用前，擅自假设提取链路是 streaming、后台任务轮询或短请求；涉及超时、SSE、并发和任务边界时，必须先以当前代码实现为准再下判断。
- 不要把本地测试数据、SQLite 队列数据或临时脚本输出当成正式业务数据。
- 不要在未更新文档的情况下调整架构、schema、环境变量或关键工作流。
- 不要在 UI、接口或文案里引入 [docs/architecture.md](/Users/cain/Documents/code/swift-daily-oracle/docs/architecture.md) 未定义的业务概念；像“精品”这类标签如果没有数据结构和流程支撑，就不要保留。
- 不要在管理页重复展示当前主导航已经表达过的标题，也不要展示与当前列表无关的统计；例如名句库页不要出现“待审”数量这类不属于已入库列表的信息。
- 删除类交互默认优先做乐观更新；只要后端失败时可以可靠回滚，点击后应先让条目立即消失或退出当前列表，不能让用户长时间等待界面停在原地。
- 危险删除优先使用行内确认交互，例如二次点击或双击确认；不要默认用弹窗打断流程，除非风险高到必须阻断或行内确认无法表达后果。
- 不要在 SvelteKit 服务端代码里直接依赖 `process.env` 读取运行时配置；统一通过 `$env/dynamic/private` 封装访问，避免 dev/build 环境取值不一致。
- 不要提交敏感密钥、私钥或生产凭证；如果在仓库中发现此类内容，优先提醒并推动迁移到安全配置。
- 本地工作台的上传解析、AI 请求与响应、提取进度和错误都必须打印到服务端控制台，排查问题时不能只依赖前端提示。
- 不要把 txt 正文分隔符限定为纯 ASCII `---`；解析时必须兼容 BOM、零宽字符、全角/长横线等常见变体，避免正文被误判为空。
- 不要在 SSE / ReadableStream 推送里假设连接会一直存活；所有 `controller.enqueue` 都必须先处理连接关闭和取消订阅，避免向已关闭 stream 写入把 Node 进程打崩。
- 不要把未校验的 AI `moods` 标签直接写入 SQLite 或 Supabase；必须先按 `docs/schema.sql` 的 `quote_mood` 枚举过滤，非法值直接丢弃，并在人工审核提交失败时打印服务端错误日志。
- 不要把未核实的句子、出处、作者、时间、数量或业务数据当成事实输出；拿不准就明确说不确定，先核对代码、文档或用户提供的原文，再回答。
- 不要在人工点击 `收` 时跳过原始正文校验；候选句必须先按归一化文本在该书正文中命中，未命中就直接报错拦截，不能把 AI 编造或改写过度的句子写入 Supabase。
