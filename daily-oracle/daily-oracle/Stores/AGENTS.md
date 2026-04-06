# Stores

## 职责

这里只放本地数据访问和持久化装配。

## 文件清单

- DailyOracleStore.swift - 主数据库 store
- OracleModelContainer.swift - ModelContainer 配置
- HistorySeedStore.swift - 300 天种子数据生成

## 约束

- Store 负责数据入口、容器配置和种子数据，不负责页面布局
- 涉及 App Group、CloudKit、文件路径时，把标识符集中定义
- 改动后同步检查 entitlements 和 Widget 共享配置
- 当前目录有更新时，随之更新本目录下的 CLAUDE.md 和 AGENTS.md，保持两者一致。
