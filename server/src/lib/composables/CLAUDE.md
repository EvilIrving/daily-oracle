# composables

## 职责

这里只放组合式函数，封装可复用的状态逻辑和数据映射工具。

## 文件清单

- useMappers.ts - 数据映射（BookFile、Candidate、LibraryQuote、AlmanacEntry 等类型定义与映射函数）
- useProviderConfig.ts - 提供商配置管理

## 约束

- 与 daily-oracle/Stores/对应，提供响应式状态管理
- 函数职责单一，避免副作用扩散
- 类型定义集中在 lib/types.ts，composables 只引用不重复定义
- 当前目录有更新时，随之更新本目录下的 CLAUDE.md 和 AGENTS.md，保持两者一致。
