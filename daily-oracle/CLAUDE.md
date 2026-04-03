
## Apple App 构建计划

UI/UX 事实源：`docs/proto/app_two_tab_prototype.html`、`docs/proto/widget_sizes_spec.html`

## Apple App 开发约定

- App 侧 Supabase 只允许使用 `SUPABASE_URL` + `PUBLISHABLE_KEY`；`SERVICE_SECRET_KEY` 只能留在 `server/.env` 和 Supabase Edge Function 环境变量。
- 在未引入 `.xcconfig` 前，`SUPABASE_URL` / `PUBLISHABLE_KEY` 先放 `daily-oracle/daily-oracle/Info.plist`；后续需要多环境时再迁移到 `.xcconfig` 注入。
- `Info.plist` 只放客户端可公开配置和权限文案，不放 service secret、管理口令或任何可写库的密钥。
- Personal Team 开发环境不支持 `iCloud`、`Push Notifications`、`WeatherKit`；这三项必须设计成可裁剪能力，不能阻塞本地开发。
- Apple App 维持两条交付线：`Dev Baseline` 和 `Production Capabilities`。
- `Dev Baseline` 目标是让 Personal Team 也能编译、运行、联调主流程；默认关闭 `iCloud`、`Push Notifications`、`WeatherKit`，用本地存储和降级逻辑跑通。
- `Production Capabilities` 只在付费 Apple Developer Program 账号下启用；开启前先确认 App ID、entitlements、provisioning profile 一致。
- 改 entitlements、capability、bundle id、container id 前，先判断当前是不是 Personal Team；若是，优先保 `Dev Baseline` 可运行。
- Widget 不自己申请定位权限；主 App 负责写入共享数据，Widget 只读最后一次成功同步结果。
- 没有定位权限时，允许功能降级并明确提示；没有 WeatherKit 时，允许天气字段为空或回退到不依赖天气的请求；没有 CloudKit 时，SwiftData 继续本地工作。
- 设置页需要预留“服务状态 / 权限状态”分区，展示定位、天气、同步当前是否可用，避免静默失败。
- Push / 后台刷新只有在明确需要远程刷新 widget 或通知时才启用，不提前开 capability。
- 发版前必须逐项确认：权限文案、无网表现、无定位表现、无天气表现、首次启动表现、签名与 provisioning 一致。

### Phase 0 — 项目初始化 [DONE]

- Xcode 创建 SwiftUI App（SwiftData + CloudKit）
- 建好文件夹结构：App/ Models/ Views/Home/ Views/Onboarding/ Stores/ Widgets/ DesignSystem/ Resources/

### Phase 1 — Design Token [DONE]

- `DesignSystem/Colors.swift`：语义色（Asset Catalog light/dark）+ 宜忌固定色 + Mood enum + 心情色
- `DesignSystem/Spacing.swift`：4pt grid 间距 + 圆角
- `DesignSystem/Typography.swift`：字号层级（名句衬线、导航、日历、设置、标签）
- `Assets.xcassets/Colors/`：9 个 colorset，1:1 对应 prototype CSS 变量

### Phase 2 — 数据层（纯本地，可离线验证）[DONE]

- 清理模板代码（删 Item.swift，重写 App 入口）
- SwiftData Models：DailyRecord、Anniversary、UserConfig
- App Group container 配置
- CloudKit container 配置
- Preview 验证持久化

### Phase 3 — 网络层 [DONE]

- Services/EdgeFunctionService.swift：对接 daily-oracle Edge Function
- Services/WeatherService.swift：WeatherKit 封装
- Services/LocationService.swift：CoreLocation 封装
- 截止 Phase 3 只保留模型层和网络层
- UI 视为 0，`RootView` 保持空壳
- 不保留 mock 数据、seed 数据或模板 UI test

### Phase 3.5 — 配置与能力裁剪

- 3.5.1 从 `Info.plist` 读取 `SupabaseURL`、`SupabasePublishableKey`，集中封装到单一配置类型，不允许在业务代码里散读 plist。
- 3.5.2 抽出 `CloudKit`、`WeatherKit`、`Push` 的能力边界，支持 capability 不可用时降级。
- 3.5.3 `Dev Baseline` 默认可关闭 `iCloud`、`Push Notifications`、`WeatherKit`，但不删模型字段，不改业务契约。
- 3.5.4 真机调试前先检查签名身份、entitlements、App ID、Provisioning Profile 是否匹配；不匹配先回退到 `Dev Baseline`。

### Phase 4 — 主界面

- 4.1 Tab 与导航：`TabView` 历史 / 设置，根级结构与 `app_two_tab_prototype` 一致
- 4.2 历史 Tab — 日历：月视图、选日、与 `DailyRecord` 绑定；空日 / 无数据状态
- 4.3 历史 Tab — 详情：名句 + 宜忌卡片，沿用 `DesignSystem` 字号与语义色
- 4.4 设置 Tab — 分区骨架：列表或分组，为子模块预留入口
- 4.5 Widget 预览：假数据示意，不调 Edge Function（仅展示给用户）
- 4.6 外观：主题等，持久化到 `UserConfig`（或等价模型）
- 4.7 语料偏好：与 Edge Function 请求参数对齐的本地配置 UI + 持久化
- 4.8 纪念日：入口与 `Anniversary` 列表 / 编辑；与 Phase 6 内购门闩衔接
- 4.9 心情：选择控件 + 写入当日记录或配置；与历史 / 详情展示一致
- 4.10 设置页显示定位、天气、同步、推送当前状态与不可用原因。

### Phase 5 — Widget

- 5.1 Widget extension + App Group：主 App 写入，小组件从共享容器读取 SwiftData / 共享数据
- 5.2 小 2×2：名句（或 `widget_sizes_spec` 规定的最小信息集）
- 5.3 长条 4×2：名句 + 宜忌
- 5.4 大 4×4：完整布局（对照 `widget_sizes_spec`）
- 5.5 `TimelineProvider`：刷新策略、每日午夜（或本地日界）对齐；调试可用 Widget Preview

### Phase 6 — StoreKit、打磨、收尾

- 6.1 StoreKit 2 基础：产品、`Transaction`、恢复购买、entitlement 与本地功能门闩
- 6.2 付费点落地：主题、纪念日相关能力、自定义字体（可分迭代交付）
- 6.3 Onboarding：首启流程与 `UserConfig` / 本地状态同步
- 6.4 动效与微交互：转场、列表与日历反馈（对照 prototype 节奏）
- 6.5 iPad / 多尺寸：`horizontalSizeClass`、横屏与宽屏布局

### Phase 7 — Production Capabilities 收口

- 7.1 CloudKit：确认 container id、entitlement、SwiftData 存储位置、跨设备同步行为一致。
- 7.2 WeatherKit：确认 Apple Developer 后台能力、Xcode capability、entitlement、真机天气请求可用。
- 7.3 Push / 后台刷新：只在明确有业务需求时启用并联调。
- 7.4 归档前检查 App ID、bundle identifier、provisioning profile、entitlements 四者一致。

 
