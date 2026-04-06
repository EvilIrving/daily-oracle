# Services

## 职责

这里只放外部能力封装。

## 文件清单

- EdgeFunctionService.swift - 对接 daily-oracle Edge Function
- OracleServiceModels.swift - 请求/响应模型定义
- Log.swift - 日志工具

## 约束

- Service 要做成可替换依赖，接口清楚，方便 mock
- 不要把 SwiftUI 状态或 @Query 直接塞进这里
- 改接口时同步检查调用方、预览假数据和测试替身
- 当前目录有更新时，随之更新本目录下的 CLAUDE.md 和 AGENTS.md，保持两者一致。
