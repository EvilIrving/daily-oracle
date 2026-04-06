# Models

## 职责

这里只放 SwiftData @Model、轻量枚举和值类型。

## 文件清单

- DailyRecord.swift - 每日记录（名句、心情、宜忌）
- Anniversary.swift - 纪念日
- UserConfig.swift - App 配置
- QuoteMood.swift - 8 种心情枚举

## 约束

- 保持字段语义稳定，改字段前核对 docs/architecture.md 和 Edge Function 契约
- 模型里可以放少量派生属性和归一化逻辑，不放网络请求、视图状态和重 UI 计算
- 当前目录有更新时，随之更新本目录下的 CLAUDE.md 和 AGENTS.md，保持两者一致。
