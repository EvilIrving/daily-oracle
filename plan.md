# Daily Oracle - Development Plan

Based on `docs/architecture.md` and `docs/product_roadmap.svg`.

---

## Phase 0: iOS App 骨架 + Mock 数据

目标：用 Mock 数据跑通全部 UI，不依赖后端。

### 0.1 项目初始化

- [ ] Xcode 项目结构：主 App + Widget Extension
- [ ] App Group 配置（UserDefaults 共享）
- [ ] SwiftData 模型定义（Quote, Almanac, DailyLog）
- [ ] SwiftData store URL 指向 App Group container
- [ ] Mock 数据服务协议（`QuoteServiceProtocol`, `AlmanacServiceProtocol`）

### 0.2 主界面

@app_two_tab_prototype.html

### 0.3 Widget 三尺寸

@widget_sizes_spec.html

- [ ] TimelineProvider 骨架（Mock entry，次日 05:00 刷新策略）
- [ ] App Group UserDefaults 读写（todayQuote / todayAlmanac / lastFetchDate / userMood）

### 0.4 日历历史视图

- [ ] 按月展示，每天显示当日 mood 图标
- [ ] 点击某天展开：名句 + 心情 + 宜忌
- [ ] 从 SwiftData 读取 DailyLog
 
---

## Phase 1: Supabase 业务层部署

目标：数据库、Edge Functions、认证全部就绪。

### 1.1 数据库

- [ ] 执行 `docs/schema.sql`（quotes, extraction_batches, almanac_entries, user_daily_logs, anniversaries）
- [ ] 确认 RLS 策略生效
- [ ] 确认视图 v_quote_by_mood、v_corpus_stats 可查询
- [ ] 开启 Anonymous Auth

### 1.2 Edge Function: daily-quote

- [ ] 接收参数：mood, lat, lon, genre（可选）
- [ ] 调用 QWeather REST API 获取天气（JWT Ed25519 签名）
- [ ] 天气 → themes 映射（雨→["雨"], 雪→["雪","冬"] 等）
- [ ] 查询临近节日/纪念日 → themes 映射
- [ ] themes 加权评分 SQL 查询
- [ ] 避免连续重复（排除 user_daily_logs 最近 N 条的 quote_id）
- [ ] 返回：名句 + 天气数据

### 1.3 Edge Function: generate-almanac

- [ ] 接收参数：lat, lon
- [ ] 调用 QWeather REST API（或复用 daily-quote 缓存）
- [ ] 查询近 7 天 user_daily_logs（心情/阅读偏好）
- [ ] 查询临近纪念日
- [ ] 调用 LLM 生成宜忌（使用 `docs/prompt-yi.md`）
- [ ] 写入 almanac_entries
- [ ] 返回：宜忌 + 天气

### 1.4 Edge Function: log-mood

- [ ] 接收参数：mood, quote_id, almanac_id
- [ ] UPSERT user_daily_logs（同一天同一用户只保留最新）

### 1.5 QWeather 服务端配置

- [ ] Ed25519 私钥存入 Supabase Secrets
- [ ] JWT 签名工具函数（TypeScript/Deno）
- [ ] weatherNow 接口封装 + 错误处理
- [ ] 天气文本 → themes 关键词映射表

### 1.6 pg_cron（可选）

- [ ] 每日定时触发全局宜忌生成（无用户上下文的通用版本）
- [ ] 用于 Widget 在用户未打开 App 时也有内容展示

---

## Phase 2: iOS 接入真实后端

目标：替换 Mock，App 连接 Supabase。

### 2.1 Supabase Swift SDK 接入

- [ ] 安装 Supabase Swift SDK（SPM）
- [ ] 配置 anon key + project URL
- [ ] 实现 `SupabaseQuoteService`（替换 Mock）
- [ ] 实现 `SupabaseAlmanacService`（替换 Mock）

### 2.2 匿名登录

- [ ] App 启动时 `supabase.auth.signInAnonymously()`
- [ ] 持久化 session，避免每次启动重新创建用户
- [ ] 登录失败降级到离线缓存

### 2.3 CoreLocation 集成

- [ ] 请求 whenInUse 权限
- [ ] 获取经纬度 → 传给 daily-quote / generate-almanac
- [ ] 拒绝授权后：手动选择城市 → 转换为坐标

### 2.4 数据同步完整流程

- [ ] App 启动：检查 lastFetchDate → 过期则拉取新数据
- [ ] 拉取 daily-quote → 缓存到 SwiftData + App Group UserDefaults
- [ ] 拉取 generate-almanac → 缓存到 SwiftData + App Group UserDefaults
- [ ] 心情选择 → 调用 log-mood + 刷新名句 + reloadAllTimelines
- [ ] Widget TimelineProvider 从 App Group 读取真实数据

### 2.5 后台刷新

- [ ] 注册 BGAppRefreshTask
- [ ] 后台拉取当日数据 → 更新缓存 → reloadAllTimelines
- [ ] Widget getTimeline 内直接网络请求（超时 15s 内）

### 2.6 离线缓存

- [ ] SwiftData 存储历史数据
- [ ] 无网络时展示最近缓存
- [ ] 网络恢复后静默同步

---

## Phase 3: 天气增强 + 节假日匹配

目标：天气和节日信号完整接入选句和宜忌逻辑。

### 3.1 天气展示

- [ ] 主界面展示天气信息（Edge Function 返回的数据）
- [ ] 天气图标（可参考 `docs/qwd和风/Icons/`）

### 3.2 节假日信号

- [ ] 维护节日 → themes 映射表（服务端）
  - 中国：春节、元宵、清明、端午、中秋、重阳、国庆...
  - 西方：元旦、情人节、母亲节、父亲节、圣诞...
  - 节气：立春、雨水、惊蛰...
- [ ] daily-quote 查询时自动注入当日节日 themes
- [ ] generate-almanac 生成时参考节日上下文

### 3.3 纪念日信号

- [ ] anniversaries 表：用户生日、亲友生日等（简单输入，非独立管理页）
- [ ] 设置页提供生日输入入口
- [ ] Edge Function 查询临近纪念日 → 注入 themes 加权

---

## Phase 4: 个性化功能

### 4.1 月历情绪视图

- [ ] 从 user_daily_logs 按月聚合
- [ ] 每日格子显示 mood 对应图标/颜色
- [ ] 月度心情统计摘要

### 4.2 小组件主题定制

- [ ] 字体选择（系统字体 / 衬线 / 手写风格）
- [ ] 配色方案（多套预设）
- [ ] 留白/密度调节
- [ ] 主题配置存 App Group UserDefaults，Widget 实时读取

### 4.3 体裁筛选

- [ ] 设置页：用户选择偏好体裁（小说、诗歌、散文、哲学...）
- [ ] 偏好传给 daily-quote 的 genre 参数
- [ ] 不硬过滤，作为加权信号（有偏好体裁加分，无匹配也返回结果）

---

## Milestone Checklist

| Milestone | 标志 |
|-----------|------|
| M0 | Mock 数据跑通主界面 + 3 种 Widget |
| M1 | Supabase 部署完成，Edge Functions 可调用 |
| M2 | App 接入真实后端，匿名登录 + 数据同步 |
| M3 | 天气/节日/纪念日信号完整接入 |
| M4 | 月历视图 + 主题定制 + 体裁筛选 |
| M5 | 年度回顾 + 热力图，可分享 |
