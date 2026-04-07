## 创建 WidgetKit Extension 实现桌面小组件 · 2026-04-08

用户在 Xcode 手动创建了 Widget Extension target（Product Name: `quotes`，Bundle ID: `cain.com.daily-oracle.quotes`），我完成了实际的小组件代码。

**改动：**

1. `quotes/quotesExtension.entitlements`：新建，添加 App Group `group.cain.com.daily-oracle`
2. `project.pbxproj`：Debug/Release 配置加了 `CODE_SIGN_ENTITLEMENTS`
3. `quotes/Assets.xcassets/Colors/`：从主 App 复制了全部 20 个语义色 colorset（背景、文字、边框、宜忌、心情色）
4. `quotes/quotes.swift`：完全重写 — `QuoteEntry` 数据模型 + `QuoteTimelineProvider`（placeholder 假数据 + `.atEnd` 策略）+ 三种尺寸视图（Small 名句+出处、Medium +宜忌、Large +心情条）+ `containerBackground` 用 `backgroundPrimary` + "All Sizes" 组合 Preview
5. `quotes/quotesBundle.swift`：只保留 `quotes()` widget
6. `quotes/AppIntent.swift`：最小化，无可配置参数
7. 删除 `quotesLiveActivity.swift` 和 `quotesControl.swift`

**技术要点：**

- Widget target 用 `fileSystemSynchronizedGroups`，`quotes/` 目录下所有 Swift 文件自动编译，不需要手动添加文件引用
- Asset Catalog 需要在 widget target 自己的 `Assets.xcassets` 里放一份颜色资源，不能直接引用主 App 的
- `@Environment(\.widgetFamily)` 用来在 `WidgetEntryView` 里区分尺寸，不是 entry 上的属性
- Preview 标签页在 Xcode Canvas 底部切换；加了 `"All Sizes"` 组合预览可同时看到三种尺寸

**主 App 内 WidgetPreview 组件的参数化改动被用户回退了**，恢复为原始硬编码版本。CalendarTab 中的 `WidgetPreviewLargeRecord` 引用也恢复原样。

---

# 会话卸载记录

以下是本次会话中为卸载 Flutter/Android 开发环境所执行的主要 Shell 命令及删除的内容：

### Flutter & Android Studio
- **卸载 Homebrew Flutter:**
  - **命令:** `brew uninstall flutter`
  - **内容:** 卸载了通过 Homebrew 安装的 Flutter SDK。

- **删除 Flutter, Android Studio 及相关数据:**
  - **命令:** `rm -rf ~/flutter "/Applications/Android Studio.app" ~/Library/Android ~/.android ~/.gradle ~/Library/Application\ Support/Google/AndroidStudio* ~/Library/Caches/Google/AndroidStudio* ~/Library/Logs/Google/AndroidStudio* ~/Library/Preferences/com.android.* ~/Library/Preferences/com.google.android.studio.plist`
  - **内容:** 删除了以下目录和文件：
    - `~/flutter` (手动安装的 Flutter SDK)
    - `/Applications/Android Studio.app` (Android Studio 应用程序)
    - `~/Library/Android` (Android SDK)
    - `~/.android` (AVD 和调试密钥)
    - `~/.gradle` (Gradle 缓存)
    - Android Studio 的各类配置、缓存和日志文件。

### Java 开发环境
- **卸载 SDKMAN:**
  - **命令:** `rm -rf ~/.sdkman`
  - **内容:** 删除了 SDKMAN 工具及其管理的所有 Java 版本 (如 `17.0.2-open`)。

- **卸载 Homebrew Java 11:**
  - **命令:** `brew uninstall openjdk@11`
  - **内容:** 卸载了通过 Homebrew 安装的 `openjdk@11`。

### Dart/Flutter 缓存
- **删除 Dart/Flutter 缓存:**
  - **命令:** `rm -rf ~/.dart-tool ~/.dartServer`
  - **内容:** 删除了 Dart 工具的全局配置和分析服务器缓存。

### Shell 配置文件清理
- **修改 `.zshrc` 和 `.bash_profile`:**
  - **命令:** `replace ...` (多次执行)
  - **内容:** 从 `.zshrc` 和 `.bash_profile` 文件中搜索并删除了所有与 Flutter、Android SDK、Valdi、SDKMAN 和 `openjdk@11` 相关的 `PATH` 和 `JAVA_HOME` 环境变量设置。


将 Edge Function 从固定格式组装 prompt 改为透传模式，App 侧完全控制提示词内容。

**改动：**

1. `docs/prompts/yi.md`：改为 App 侧参考文档，说明如何组装 prompt
2. `server/supabase/functions/daily-oracle/index.ts`：
   - 移除 `PROMPT_YI` 常量，移除所有 prompt 组装逻辑
   - LLM 调用改为直接透传 `body.prompt`（无 system）
   - 名句选择简化，不再使用天气主题加权
3. `daily-oracle/Services/OracleServiceModels.swift`：`OracleEdgeRequest` 新增 `prompt: String` 字段
4. `daily-oracle/Stores/DailyOracleStore.swift`：新增 `buildAlmanacPrompt` 函数，负责组装完整 prompt（系统风格定义 + 输入信号）

**设计决策：**

- Edge Function 简化为纯透传层，不做任何 prompt 处理
- App 侧完全控制提示词格式，可自由组合任意信号
- 系统风格定义硬编码在 App 侧，可随时调整

---



**被放弃的方案：服务端预生成图片**

考虑过让 Edge Function 每天为每个用户生成 6 张图片（3 种尺寸 × 2 种主题），App 和 Widget 只渲染图片。

放弃原因：
- 需预生成量大（日活 × 6 张），或首次请求时延迟生成
- 深色/浅色需两套图，或按需实时生成有延迟
- Widget 内存限制（30MB）对大图敏感
- 完全丧失离线能力

替代方案：本地渲染，内置字体。

---

**字体方案决策**

**默认免费字体**：霞鹜文楷（简繁体 + 基础西文，约 3MB）
- 温润书卷气，适合文学名句
- 西文部分较弱，纯英文名句需 fallback 到系统字体或内置西文字体

**付费解锁特殊字体**（规划）：
- 得意黑（几何斜体，现代感）
- 站酷庆科黄油体（圆体，温暖）
- Zpix / Press Start 2P（中文/西文像素）
- Caveat / Dancing Script（手写/花体）
- Playfair Display（古典衬线）
- Courier Prime（打字机复古）

**多语言支持**：
- 中文名句：霞鹜文楷
- 英文名句：需额外西文字体（Merriweather 或 Lora）或直接用系统 SF Pro
- 日文/韩文原文：思源宋体 JP/K 子集，或直接用系统字体 fallback

**技术路径**：
- 字体文件放 Xcode Resources，Info.plist 注册
- SwiftUI 用 `.custom("FontName", size: 17)`
- 检测到纯英文时自动切换西文字体

---

  

主题: server 依赖安装失败与 node-gyp PATH 修复 | 标签: [build, config, bugfix]

摘要:
在 server 目录执行 `pnpm i` 时，`better-sqlite3` 的 install 脚本失败（ELIFECYCLE）。根因是 Node 24.12.0 无预编译包需本地编译，但脚本里执行 `node-gyp` 时 PATH 中找不到命令——pnpm 隔离布局下根项目的 node-gyp 不会出现在 better-sqlite3 包脚本的 PATH 中。通过在 `server/package.json` 使用 `pnpm.packageExtensions` 为 `better-sqlite3@*` 注入 `node-gyp` 依赖，使 node-gyp 进入该包的依赖树，安装脚本能解析到 node-gyp；随后 `pnpm install --no-frozen-lockfile` 成功并完成源码编译。验证时需注意先 `svelte-kit sync` 再 `pnpm check`，否则缺 `.svelte-kit/tsconfig.json`。

决策:

- 采用 packageExtensions 绑定 node-gyp 到 better-sqlite3，而非仅加根 devDependencies（后者仍无法被子包 install 脚本找到）。
- 不单独要求用户全局安装 node-gyp，保持可复现的仓库级配置。

备注:

- 首次安装或改 package.json 后若 lockfile 冻结，需 `--no-frozen-lockfile` 或更新 lockfile。
- 仍可能出现 `No prebuilt binaries found` 警告，属预期，会走 node-gyp 编译。

原因:

- prebuild-install 对 Node 24 / darwin / arm64 暂无匹配预构建时需本地编译。
- pnpm 的依赖隔离导致 `node-gyp` 必须作为 better-sqlite3 可解析的依赖出现。

引用:

- 文件: `server/package.json`（`pnpm.packageExtensions`）
- 命令: `cd server && pnpm install --no-frozen-lockfile`；`pnpm exec svelte-kit sync && pnpm check`

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

**与旧条「宜忌个人化暂缓」的关系：** 曾记全局 `almanac` 与个人化信号的矛盾；当前方向是 Edge + 用户信号生成，若仍全局每日一条，个人化程度以实际表结构为准，实现时再对齐。

---

## 审核流程去掉"改"，宜忌个人化暂缓，后端选型开放 · 2026-03-30 15:38 · claude-4.6-sonnet  

`docs/architecture.md` 和 `docs/schema.sql` 做了两处明确改动：

1. **审核流程从"收/弃/改"改为"收/弃"**。原来允许在审核阶段直接修改文案，现在去掉这个概念——不满意就弃，要换措辞就重跑提取，不在审核环节手改。`schema.sql` 同步删除了 `quotes.reviewer_note`（"终审备注"字段），因为它隐含了"先改后存"的逻辑。

2. **宜忌个人化动态生成暂缓**。当前 `almanac` 是 `date unique`（全局每天一条），但文档里写了"用用户近 7 天心情/阅读类型作为信号"——这两件事是矛盾的：全局一条就没法做到按人不同。要真做个人化，至少要把存储维度改成 `(device_id, date)`，并且必须有一个可靠的在线服务（自建服务器、Cloudflare Workers 或 Supabase Edge Functions）来接请求、处理用户上下文、调模型。目前认为代价超过当前阶段，暂不做。

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

---

## iOS App 接入 daily-oracle Edge Function · 2026-04-02

- **Edge Function**（`server/supabase/functions/daily-oracle/index.ts`）：`almanac` 用 `maybeSingle()`；无 mood 命中时回退拉取名句；无当日缓存且未配置 `ANTHROPIC_API_KEY` 时明确报错；服务端密钥环境变量为 **`SERVICE_SECRET_KEY`**（与 `server/.env` / 架构文档一致，不用 legacy `SUPABASE_SERVICE_ROLE_KEY`）。
- **iOS**（`daily-oracle/`）：`URLSession` 调用 `POST …/functions/v1/daily-oracle`（`Authorization` + `apikey` 为 publishable key）；`Info.plist` 增加 `SupabaseURL` / `SupabasePublishableKey`；`DailyOracleClient` + `Codable` 模型；`CachedDailyOracle` 缓存上次响应；`ContentView` 心情选择 + 拉取 + 展示；占位经纬度与天气（后续接 CoreLocation / WeatherKit）；工程 `IPHONEOS_DEPLOYMENT_TARGET` 对齐为 **17.6**。
- **本地构建**：若 Xcode 报 Push / iCloud entitlement 与描述文件不一致，需在 Apple Developer 打开对应 capability 或暂时改 entitlements；与本代码改动无关。

---

## iOS 原型级样式与双 Tab（历史 / 设置）· 2026-04-02

- **DesignTokens.swift**：`AppColors` / `AppMetrics` 对齐 `docs/proto/app_two_tab_prototype.html` 的浅色与深色 hex、圆角与导航字号；`appScreenBackground()` 使用 `backgroundTertiary`。
- **TabView**：`历史`（日历 + `DetailQuoteCard`）与 `设置`（小组件尺寸切换 + `WidgetPreviewCard` + 心情 + 拉取 + 占位列表行）；TabBar 使用 `toolbarBackground` 与主色 `tint`。
- **逻辑**：`DailyOracleViewModel` 承载拉取与缓存；`ContentView` 仅保留 `TabView` 与 `Query`。
