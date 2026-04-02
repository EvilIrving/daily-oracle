# Changelog — 重大架构决策

记录产品和技术方向的关键转折点，不是代码级 commit log。

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
