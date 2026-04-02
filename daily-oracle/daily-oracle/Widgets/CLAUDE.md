# Widgets

- 这里只放 WidgetKit 相关代码和与小组件直接耦合的展示模型。
- Widget 只能读取共享数据，不要在这里重复定义主 App 的持久化事实源。
- 改 Timeline、共享容器或刷新策略时，同时检查主 App 的 App Group 配置和数据格式。
