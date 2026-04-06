# Apple App

## 职责

展示层：每日名句 + 宜忌展示、心情选择、日历历史、主题切换、Widget。

## 技术方案

- SwiftUI + SwiftData + WidgetKit
- 支持 iOS / iPadOS / macOS（先 iPhone，再适配 iPad）
- Deployment Target：iOS/iPadOS 17.6、macOS 14.0
- 测试框架：Swift Testing（import Testing）

## 代码写作规范

- Swift 5.9+，@Model、@Observable、#Preview
- 单文件不超过 500 行，组件职责单一
- 视图层不直接写 Color("...")，走 DesignSystem 语义 token
- 服务层做成可替换依赖，接口清晰，方便 mock

## 目录组织

- App/ - App 入口
- Models/ - SwiftData @Model、轻量枚举和值类型
- Views/ - SwiftUI 视图（RootView、CalendarTab、SettingsView、Components/*）
- Stores/ - 本地数据访问（ModelContainer 配置、种子数据）
- Services/ - 外部能力封装（EdgeFunctionService、OracleServiceModels）
- DesignSystem/ - 设计 token（Colors、Spacing、Typography）
- Extensions/ - 扩展（Calendar+Oracle 等）
- Widgets/ - 小组件

## 数据存储

- 纯本地 SwiftData（第一版）
- Phase 5：App Group 共享存储（Widget）
- Phase 7：CloudKit 跨设备同步

## 开发约定

- 涉及 UI/UX 参考 dribbble.com、Apple HIG
- 少用 xcodebuild，仅用于最终打包

## 构建计划

UI/UX 事实源：后续原型文件请在 `docs/` 目录下确认，命名以 `app-` 或 `widget-` 开头。

### Design System 约定

- 颜色只从 `DesignSystem/Colors.swift` 取语义入口，视图层不要直接写 `Color("...")` 资产名。
- 页面背景统一用 `AppColors.pageBackground`，内容卡片用 `AppColors.surface`，更强调的分层才用 `AppColors.surfaceElevated`。
- 文字、边框、强调色也必须走语义 token，避免页面自行决定视觉基调。

### 已完成

#### Phase 0 — 项目初始化 [DONE]

- Xcode 创建 SwiftUI App（SwiftData + CloudKit）
- 建好文件夹结构：App/ Models/ Views/Home/ Views/Onboarding/ Stores/ Widgets/ DesignSystem/ Resources/

#### Phase 1 — Design Token [DONE]

- `DesignSystem/Colors.swift`：语义色（Asset Catalog light/dark）+ 宜忌固定色 + Mood enum + 心情色
- `DesignSystem/Spacing.swift`：4pt grid 间距 + 圆角
- `DesignSystem/Typography.swift`：字号层级（名句衬线、导航、日历、设置、标签）
- `Assets.xcassets/Colors/`：9 个 colorset，1:1 对应 prototype CSS 变量

#### Phase 2 — 数据层（纯本地，可离线验证）[DONE]

- 清理模板代码（删 Item.swift，重写 App 入口）
- SwiftData Models：DailyRecord、Anniversary、UserConfig
- App Group container 配置
- CloudKit container 配置
- Preview 验证持久化

#### Phase 3 — 网络层 [DONE]

- Services/EdgeFunctionService.swift：对接 daily-oracle Edge Function
- 截止 Phase 3 只保留模型层和网络层
- UI 视为 0，`RootView` 保持空壳
- 不保留 mock 数据、seed 数据或模板 UI test

#### Phase 3.5 — 清理不可用 Capabilities [DONE]

- App 侧已移除 `WeatherService.swift`、`LocationService.swift`、相关字段与测试替身
- `DailyRecord`、`UserConfig`、`OracleServiceModels` 已去除 lat/lng/weather 相关字段
- entitlements 已移除 WeatherKit、CloudKit；SwiftData `ModelContainer` 已改为纯本地存储
- `daily-oracle` Edge Function 现在支持无天气请求；不传 `lat/lng/weather` 时跳过天气逻辑
- 无天气时会从 `PROMPT_YI` 中移除天气整行，不保留空占位

### 待办

#### Phase 4 — 主界面

- 4.1 Tab 与导航：`TabView` 历史 / 设置，根级结构与 `app_two_tab_prototype` 一致
- 4.2 历史 Tab — 日历：月视图、选日、与 `DailyRecord` 绑定；空日 / 无数据状态
- 4.2 进展：已接入本地 300 天 `DailyRecord` seed，支持离线调历史页月历与详情卡
- 4.3 历史 Tab — 详情：名句 + 宜忌卡片，沿用 `DesignSystem` 字号与语义色
- 4.4 设置 Tab — 分区骨架：列表或分组，为子模块预留入口
- 4.5 Widget 预览：假数据示意，不调 Edge Function（仅展示给用户）
- 4.6 外观：主题等，持久化到 `UserConfig`（或等价模型）
- 4.7 语料偏好：与 Edge Function 请求参数对齐的本地配置 UI + 持久化
- 4.8 纪念日：入口与 `Anniversary` 列表 / 编辑；与 Phase 6 内购门闩衔接
- 4.9 心情：选择控件 + 写入当日记录或配置；与历史 / 详情展示一致
- 4.10 设置页显示定位、天气、同步、推送当前状态与不可用原因

#### Phase 5 — Widget

- 5.1 Widget extension + App Group：主 App 写入，小组件从共享容器读取 SwiftData / 共享数据
- 5.2 小 2×2：名句（或 `widget_sizes_spec` 规定的最小信息集）
- 5.3 长条 4×2：名句 + 宜忌
- 5.4 大 4×4：完整布局（对照 `widget_sizes_spec`）
- 5.5 `TimelineProvider`：刷新策略、每日午夜（或本地日界）对齐；调试可用 Widget Preview

#### Phase 6 — StoreKit、打磨、收尾

- 6.1 StoreKit 2 基础：产品、`Transaction`、恢复购买、entitlement 与本地功能门闩
- 6.2 付费点落地：主题、纪念日相关能力、自定义字体（可分迭代交付）
- 6.3 Onboarding：首启流程与 `UserConfig` / 本地状态同步
- 6.4 动效与微交互：转场、列表与日历反馈（对照 prototype 节奏）
- 6.5 iPad / 多尺寸：`horizontalSizeClass`、横屏与宽屏布局

#### Phase 7 — Production Capabilities（需付费 Apple Developer Program）

- 7.1 WeatherKit + CoreLocation：重新加入定位与天气能力，接入 Edge Function lat/lng 参数
- 7.2 CloudKit：确认 container id、entitlement、SwiftData 存储位置、跨设备同步行为一致
- 7.3 Push / 后台刷新：只在明确有业务需求时启用并联调
- 7.4 归档前检查 App ID、bundle identifier、provisioning profile、entitlements 四者一致
