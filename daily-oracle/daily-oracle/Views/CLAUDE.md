# Views

## 职责

这里只放 SwiftUI 视图和与视图直接相关的轻量展示逻辑。

## 目录结构

- RootView.swift - App 入口和 Tab 导航
- CalendarTab.swift - 日历页面
- SettingsView.swift - 设置页
- WidgetTab.swift - 小组件预览页面
- Components/ - 可复用视图组件（CalendarMonthPanel、WidgetPreviewSmall、WidgetPreviewMedium、WidgetPreviewLarge）

## 约束

- 视图层不直接写 Color("...")，走 DesignSystem 语义 token
- 页面背景统一用 AppColors.pageBackground，内容卡片用 AppColors.surface
- 单文件不超过 500 行，过大时主动拆分组件和逻辑
- 当前目录有更新时，随之更新本目录下的 CLAUDE.md 和 AGENTS.md，保持两者一致。
