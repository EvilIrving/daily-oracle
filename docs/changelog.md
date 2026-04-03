# Changelog — 重大架构决策

记录产品和技术方向的关键转折点，不是代码级 commit log。

---

## v0.2.3 — 2026-04-03

**Apple App 改为双轨能力规划，iOS 约定下沉到子目录文档**

- Apple App 新增 `Dev Baseline` 和 `Production Capabilities` 两条交付线
- `Dev Baseline` 以 Personal Team 可编译、可运行、可联调为目标，允许关闭 `iCloud`、`Push Notifications`、`WeatherKit`
- `Production Capabilities` 只在付费 Apple Developer Program 账号下启用，要求 App ID、entitlements、provisioning profile 一致
- App 侧 Supabase 配置边界明确：客户端只使用 `SUPABASE_URL` 和 `PUBLISHABLE_KEY`，不接触 `SERVICE_SECRET_KEY`
- 在未引入 `.xcconfig` 前，iOS 客户端配置先放 `daily-oracle/daily-oracle/Info.plist`
- iOS 细化约定不再堆在仓库根文档，统一收敛到 `daily-oracle/CLAUDE.md`

**原因**：实际联调时发现 Personal Team 无法签出带 `iCloud`、`Push Notifications`、`WeatherKit` 的 profile。如果继续把这些能力当默认前提，日常开发会被签名阻塞。改成双轨后，先保证本地可跑，再补正式能力；同时把 iOS 约定下沉到 `daily-oracle/CLAUDE.md`，避免根文档混入子项目实现细节。

---

## v0.2.2 — 2026-04-02

**工作台配置与数据边界继续收紧**

- AI 提取配置不再落本地 SQLite，也不再通过 `/api/config` 做服务端持久化
- 提供商配置只存在当前浏览器 `localStorage`；浏览器里没有配置就不能发起提取
- 开始提取时，前端把当前激活配置直接随 `/api/extract` 请求传给服务端
- Local 工作台的 SQLite 职责明确为“工作台缓存”，只保存原文、提取任务、待审候选、审核日志，以及本地书到 Supabase `book_id` 的映射
- 上传 txt 后先写 Supabase `books` 拿正式 `book_id`，审核通过后再写 Supabase `quotes`
- 删除书的职责边界明确：先删 Supabase `books`，成功后再删本地缓存；如果该书已有关联 quotes，应拒绝删除

**原因**：之前同一套 AI 配置同时存在浏览器缓存和 SQLite，职责重复且容易混淆。收紧后，配置只属于当前浏览器会话；SQLite 只承担本地工作台缓存；Supabase 只承担正式数据。

---

## v0.2.1 — 2026-04-02

**正式库改为 books + quotes 关联模型**

- Supabase 正式数据模型从 `quotes + extraction_batches + almanac` 调整为 `books + quotes + almanac`
- 新增 `books` 表保存正式书目元数据，包含书名、作者、年份、体裁、语言等字段
- `quotes` 表改为只保存句子正文、`mood`、`themes` 和审核信息，通过 `book_id` 关联 `books`
- 删除 `extraction_batches` 作为正式库表的设计，提取过程批次、待审候选、审核日志继续留在本地工作台 SQLite
- 工作台上传 txt 后，解析出的书籍元数据即写入 Supabase `books`，审核通过的句子再写入 `quotes`

**原因**：Supabase 的职责应聚焦正式内容，而不是提取过程状态。书级信息放进 `books`，句级信息放进 `quotes`，可以减少重复字段，明确正式库与本地工作台的职责边界。

---

## v0.2.0 — 2026-04-02

**去掉用户体系，简化为三层解耦架构**

- 删除 Supabase Auth，不再有注册/登录流程
- 用户数据全部存本地 SwiftData，通过 CloudKit 跨设备同步
- 内购使用 StoreKit 2 纯客户端验证，付费功能全部是体验层（主题、图标、纪念日、自定义字体）
- 合并三个 Edge Function（daily-quote / generate-almanac / log-mood）为单一入口 `daily-oracle`
- 客户端改用 Apple WeatherKit 获取天气，去掉服务端 QWeather 依赖
- 定义统一请求格式：`geo` / `weather` / `profile` / `preferences`，固定字段 + 扩展字段，向后兼容
- 删除 Supabase 表：`user_daily_logs`、`anniversaries`、`user_profiles`
- 三模块完全解耦：工作台、Edge Function、App 只通过数据库 schema 和接口格式联调

**原因**：Apple 生态已提供 Apple ID 内购 + CloudKit 同步，自建用户体系增加复杂度但无实际收益。简化后开发量大幅减少，App 可以先用 mock 数据独立开发，最后联调一个接口即可。

---

## v0.1.0 — 改用 Supabase Auth（Email+Password）

- 从 device_id 匿名体系改为 Supabase Auth Email+Password 正式用户体系
- App 新增用户页面（注册/登录/个人资料）
- 新增 `user_profiles` 表（display_name、avatar）
- RLS 策略从 device_id 匹配改为 `auth.uid()` 匹配

**原因**：device_id 匿名体系无法跨设备同步，换手机数据就丢了。Email 登录可以让用户在多设备间保持数据一致。

---

## v0.0.2 — 迁移到 Supabase

- 从自建服务器迁移到 Supabase，用托管服务替代自建基础设施
- 三层架构：Local 工作台 + Supabase 业务层 + iOS App
- 使用 device_id + Supabase 匿名用户体系记录用户历史和个性化配置
- 用户数据存 Supabase（user_daily_logs / anniversaries）
- 三个 Edge Function：daily-quote / generate-almanac / log-mood
- 服务端 QWeather 天气查询（Ed25519 JWT 签名）
- 工作台改为本地运行，不再部署到线上

**原因**：v0.0.1 的自建方案太重。要支持国内用户需要备案、软件著作权等合规流程，还得买境外服务器。Cloudflare/Supabase 免费层有请求延迟和次数限制，但作为起步够用，比自建维护成本低得多。

---

## v0.0.1 — 自建服务器方案

- 自建服务器 + 自建 SQL 用户体系
- 所有后端服务自己实现（认证、API、数据库、天气查询）
- 工作台部署到线上，支持多端操作

**放弃原因**：复杂度过高。自建用户体系、服务器运维、境外部署（规避备案和软著申请）、接口延迟优化，每一项都是独立的工程量。对于一个内容驱动的小产品来说，投入产出不合理。

---

## 附录：免费层调研数据（2026-04）

### Supabase Free Tier

| 资源 | 限制 |
|------|------|
| 数据库存储 | 500 MB |
| 数据库出口流量 | 5 GB/月 |
| Edge Function 调用 | 50 万次/月 |
| Edge Function CPU 时间 | 2s/请求 |
| Edge Function 请求空闲超时 | 150s |
| Edge Function 包大小 | 20 MB |
| API 请求 | 无限 |
| 活跃项目 | 2 个 |
| Auth MAU | 5 万（本项目不用） |

注意：免费层项目 **7 天无活动会自动暂停**，不适合需要 24/7 在线的生产环境。Pro 计划 $25/月可解除暂停，Edge Function 提升到 200 万次/月。

**本项目场景评估**：每个用户每天调用 1 次 `daily-oracle`，50 万次/月 ≈ 支撑约 1.6 万日活。对于起步阶段足够，500 MB 数据库存几万条名句绰绰有余。主要风险是 7 天暂停机制。

### Cloudflare Workers Free Tier

| 资源 | 限制 |
|------|------|
| 请求数 | 10 万次/天 |
| CPU 时间 | 有限（等待网络请求不计入） |
| KV 存储 | 包含 |
| 付费门槛 | $5/月起（1000 万次/月） |

注意：限额按天重置（UTC 00:00），超出后请求直接失败，不产生额外费用。

**对比结论**：Supabase 免费层在本项目场景下更合适——自带 PostgreSQL + Edge Functions + RLS，一站式解决。Cloudflare Workers 更适合纯计算/代理场景，缺少内置数据库（需额外接 D1 或外部 DB），增加架构复杂度。最终选择 Supabase。

### 来源

- [Supabase Pricing — UI Bakery](https://uibakery.io/blog/supabase-pricing)
- [Supabase Edge Functions Limits](https://supabase.com/docs/guides/functions/limits)
- [Supabase Edge Functions Pricing](https://supabase.com/docs/guides/functions/pricing)
- [Supabase Billing Docs](https://supabase.com/docs/guides/platform/billing-on-supabase)
- [Cloudflare Workers Limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Cloudflare Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Cloudflare Workers & Pages Pricing](https://www.cloudflare.com/plans/developer-platform/)
