# Models

- 这里只放 SwiftData `@Model`、轻量枚举和值类型，保持字段语义稳定。
- 改字段名、类型、唯一约束前，先核对 `docs/architecture.md`、后续 Edge Function 契约和本地持久化兼容性。
- 模型里可以放少量派生属性和归一化逻辑，不放网络请求、视图状态和重 UI 计算。
