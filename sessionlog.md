## 管理台主页面从 Svelte 4 迁移到 Svelte 5 Runes 语法 · 2026-03-31 · claude-haiku-4-5

用户指出 `server/src/routes/+page.svelte` 使用了错误的 Svelte 4 语法，要求转换为 Svelte 5。

**问题：** 文件使用了 Svelte 4 的 `let` 声明响应式变量、`$:` 响应式语句、`onMount` 生命周期和 `on:click` 事件指令。

**改动：**
- 所有 `let` 状态变量改为 `$state()` runes（约 40+ 处）
- `$:` 响应式语句改为 `$derived()`（如 `filteredCandidates`、`pendingCount` 等）和 `$effect()`（如配置持久化、过滤器重置）
- `onMount(() => { ... })` 改为 `$effect(() => { ... })`，带 cleanup 返回
- 所有事件指令从 `on:click`、`on:change`、`on:keydown`、`on:dblclick` 改为小写 `onclick`、`onchange`、`onkeydown`、`ondblclick`
- 移除 `import { onMount } from 'svelte'`，`$effect` 是内置 rune

**注意事项：**
- 原 `$: currentBook = getCurrentBook()` 改为 `currentBookDerived = $derived(...)`，模板中引用需改为 `currentBookDerived`
- 部分 `$: if (...)` 侧效果必须用 `$effect()` 而不是 `$derived()`
- `libraryAuthorOptions` 等三个过滤器选项变量改为派生变量，模板中引用需加 `Derived` 后缀

用 svelte-autofixer 验证后无语法问题。

---

## 提取链路日志从 JSON blob 改为紧凑单行格式，加入耗时与引文预览 · 2026-03-31 · claude-sonnet-4-6

ai-client 和 extractor 里每个 chunk 原本会打 4 条多行 JSON 日志（包含完整 prompt 文本、完整 AI 响应、完整候选对象数组），高并发时终端几乎不可读。

改动：
- `ai-client.ts`：删掉"Prepared AI request payload"（含完整 prompt 文本）和"Received AI response"（含完整响应文本）、"Parsed AI response"（含完整对象数组），合并成 2 条紧凑单行：`[3/12] → model (N chars, maxTokens=…)` 和 `[3/12] ← M quotes (N chars, 3.2s)`
- `extractor.ts`：dispatch 日志改为 `[3/12] dispatching (workers=2, done=2, failed=0)`；成功日志改为 `[3/12] ✓ 4 quotes (3.4s)`，并逐条预览引文前 60 字；失败日志内联错误信息和耗时；run 完成日志合并为单行 summary
- `extraction-jobs.ts`：job queued 加一条，job completed 删掉（extractor 自己的 Run finished 已足够）
- 耗时通过 `Date.now()` 在 chunk 开始时打点，ai-client 内单独计 AI 请求耗时

这些都是纯日志改动，不影响提取逻辑、SSE 数据结构或前端。

---

## 提供商编辑改为双击弹窗，覆盖全量配置字段 · 2026-03-31 · claude-sonnet-4-6

本次把 `+page.svelte` 中提供商的编辑入口从"双击重命名弹窗"改为"双击全量编辑弹窗"。

原来双击只能改名称，其他字段（apiUrl、model、apiKey、并发数、temperature、topP、topK、maxTokens、切片大小）只能通过内联控件操作。现在双击打开一个独立弹窗，把这些字段全收进去，名称也在弹窗里改。保存后若当前激活的就是被编辑的提供商，立即同步到内联 config（保留 prompt 不覆盖）。

内联控件没有删，仍可快速调参。弹窗设计：点击背景或 Escape 取消，Enter 无效防误触（只有"保存"按钮提交）。

---

## 三层架构全流程文档演进：Local / Supabase / iOS 与 themes 标签终局 · 2026-03-30 · claude-4.6-sonnet

**起点问题：** 原 `docs/architecture.md` 更像「本地服务 + Supabase 存库」两层，缺一整条「app + 服务」链路：宜忌生成归属、Edge Functions、小组件与主 App 交互、端到端数据流。目标改为明确三层：**Layer 1 Local 工作台**（书籍解析、`prompt-oracle` 提取、审核、与 DB 交互）、**Layer 2 Supabase 业务层**（App 请求、`prompt-yi` 宜忌与 LLM）、**Layer 3 iOS 展示层**（多尺寸小组件、预览/配置外观与内容、日期与主题、与 Widget 数据传递）。

**实施阶段约定：** 先完成 Layer 1 + Layer 2，再开发 Layer 3。

**Layer 1 技术选型：** 合并为单一 **SvelteKit** 项目（`local-server/`），取代 Express + Python proxy 分裂栈；**`@anthropic-ai/sdk`** 通过 `baseURL` 接 Anthropic Messages 兼容端点（不必绑死 Claude）；**better-sqlite3** 待审队列；**Tailwind v3**；**@supabase/supabase-js** `service_role` 入库。核心逻辑从 `tools/test-book-pipeline.html` 迁到 server routes（chunk / parse / merge / p-limit 并发）。**去掉 EPUB**，只处理带**元数据头**的 txt（书名/作者/年份/语言/体裁 + 分隔符后正文），规避解析不到书名作者；提取工作台：**单按钮上传**、书名作者**小字只读**。**不保留**自动切换书籍队列；**不要**待审清单批量多选一键收弃，逐条收/弃。**审核**后定为收/弃（去掉「改」与 `reviewer_note` 等，另见下文旧条）。

**Layer 2：** PostgreSQL + **Edge Functions**：`daily-quote`、`generate-almanac`（日期、天气信号、近 7 天心情/阅读偏好、临近纪念日）、`log-mood`；**pg_cron** 等定时预生成宜忌（文档中有述）。**用户身份：** 曾考虑 `device_id` + `current_setting()` 做 RLS，实际 App 端不可行，定为 **Supabase Anonymous Auth**，`user_id` 关联 `auth.users`，RLS `auth.uid()`；`anniversaries` 表随方案加入。**Schema 中间态：** 曾补 `weathers` 枚举与列、`quote_occasion` typo 修正、删 `weight`、视图与统计对齐等；后与「枚举无法覆盖全球节日与 API 天气全文」矛盾，**终局**改为见下「themes」。

**Layer 3：** **CoreLocation** + **QWeatherSDK**（JWT/Ed25519，`weatherNow`）；主界面：预览/配置、**日历历史**（`user_daily_logs`）、**纪念日**（库表 + 宜忌信号）；**App Group** + **WidgetKit**；后补文档：**小组件每日自动更新**（Timeline `.after` 次日零点、BGAppRefresh、App 写 UserDefaults 后 `reloadAllTimelines`）。

**themes 语义标签终局（替代 weather/occasion 枚举）：** 入库 AI 输出 `themes text[]`；`genre` 改为 **text 单值**（来自 txt 头，非数组）；删除 `weight`、`quote_weather`/`quote_occasion` 及相关列；查询侧 **节日/天气 → 主题词映射 + themes 加权评分**，软匹配不硬过滤。`daily-quote` 实现时需维护小规模映射表与天气关键词解析。

**文档与代码落点：** `docs/architecture.md`（三层、时序图、QWeather、日历、纪念日、themes 策略、Widget 日更）、`docs/schema.sql`、`docs/prompt-oracle.md`（themes，genre 不由 AI 输出）。

**与旧条「宜忌个人化暂缓」的关系：** 曾记全局 `almanac_entries` 与个人化信号的矛盾；当前方向是 Edge + 用户信号生成，若仍全局每日一条，个人化程度以实际表结构为准，实现时再对齐。

---

## 审核流程去掉"改"，宜忌个人化暂缓，后端选型开放 · 2026-03-30 15:38 · claude-4.6-sonnet  

`docs/architecture.md` 和 `docs/schema.sql` 做了两处明确改动：

1. **审核流程从"收/弃/改"改为"收/弃"**。原来允许在审核阶段直接修改文案，现在去掉这个概念——不满意就弃，要换措辞就重跑提取，不在审核环节手改。`schema.sql` 同步删除了 `quotes.reviewer_note`（"终审备注"字段），因为它隐含了"先改后存"的逻辑。

2. **宜忌个人化动态生成暂缓**。当前 `almanac_entries` 是 `date unique`（全局每天一条），但文档里写了"用用户近 7 天心情/阅读类型作为信号"——这两件事是矛盾的：全局一条就没法做到按人不同。要真做个人化，至少要把存储维度改成 `(device_id, date)`，并且必须有一个可靠的在线服务（自建服务器、Cloudflare Workers 或 Supabase Edge Functions）来接请求、处理用户上下文、调模型。目前认为代价超过当前阶段，暂不做。

后端选型决定使用 supabase 全家桶。讨论了 Workers 和 Supabase Edge Functions 的差异（主要是墙钟/CPU 超时、和数据库绑定程度），结论是两条路都走得通，但都需要明确：LLM 延迟不可控时客户端和服务端要把超时设得够长。等个人化宜忌真正要做时再定。

## Changelog

避免过多解释，记录 situation reason solution 的格式，方便后续回顾，描述不必过多。

Q: github push 遇到 Invalid username or token. Password authentication is not supported for Git operations 问题，
A：查看 git remote -v 得知 remote url 被设置为 https，将其改成 ssh 连接即可："git remote set-url origin <git@github.com>:EvilIrving/svelte-high-tree.git"

## 修复多因素导致的 Android 应用启动失败问题

time: 2026-03-12

source: gemini-cli

topic: Android Build and Launch Debugging

tags: [bugfix, build, android, gradle]

summary:
应用在 Android 模拟器上启动失败（超时）。经过排查，发现问题由多个因素共同导致：Dart 代码层面的编译错误、静态分析警告（包括缺失依赖和废弃 API），以及最关键的本地 Java 环境配置错误。通过逐一修复这些问题，最终成功在 Android 模拟器上构建并启动了应用。

decisions:

1. **修复 Dart 编译错误:** 修正了 `lib/data/database_helper.dart` 中 `Sqflite.firstIntValue` 方法的参数类型错误。
2. **解决静态分析问题:**
    - 为项目添加了缺失的 `path` 依赖。
    - 移除了 `database_helper.dart` 中不必要的类型转换。
    - 将项目中所有已废弃的 `withOpacity()` 调用替换为推荐的 `withAlpha()`。
3. **诊断和修复构建环境:**
    - 多次尝试 `launch_app` 均超时，怀疑是 Android 构建问题。
    - 直接在 `android` 目录下运行 `./gradlew assembleDebug`，明确了错误是“找不到 Java 运行时”。
    - 运行 `flutter doctor -v` 查找到正确的 `JAVA_HOME` 路径。
    - 设置正确的 `JAVA_HOME` 环境变量后，成功执行了 Gradle 构建。
4. **成功启动:** 在解决了所有代码和环境问题后，`launch_app` 命令成功启动了应用。

reason:

- `launch_app` 工具的超时错误信息不够具体，无法直接定位到是 Dart 代码问题还是原生构建环境问题。通过使用 `analyze_files` 定位代码问题，并直接调用 `gradlew` 来获取更详细的原生构建错误日志，是解决此类复合问题的有效策略。`flutter doctor` 默认不显示 Java 路径，需要使用 `-v` 参数获取详细信息。

refs:

- `lib/data/database_helper.dart`
- `flutter doctor -v`
- `cd android && export JAVA_HOME=... && ./gradlew assembleDebug`
