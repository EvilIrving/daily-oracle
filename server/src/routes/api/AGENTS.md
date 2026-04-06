# api

## 职责

这里只放 API 路由处理，作为业务模块入口。

## 路由清单

- extract/+server.ts - POST: 启动后台提取 / GET: SSE 进度 / PATCH: 停止
- review/+server.ts - PATCH: 单条终态审核（收即入库，弃即删除）
- books/+server.ts - GET/POST: 书籍列表管理
- library/+server.ts - GET/DELETE: 已入库名句库
- almanac/+server.ts - GET: 宜忌历史列表
- review-log/+server.ts - GET: 审核日志书目汇总 / 导出单书审核记录

## 约束

- 请求处理、响应格式统一、错误处理在此层完成
- 复杂业务逻辑下沉到 server/ 层，路由层保持薄
- 当前目录有更新时，随之更新本目录下的 CLAUDE.md 和 AGENTS.md，保持两者一致。
