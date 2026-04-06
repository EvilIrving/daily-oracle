# components

## 职责

这里只放 Svelte 组件，负责 UI 展示。

## 目录结构

- QuoteCard.svelte - 名句卡片组件
- NotificationViewport.svelte - 通知提示组件
- tabs/ - 页面级组件（AlmanacTab、ReviewLogTab、LibraryTab、ExtractTab、PromptLabTab、EpubConverterTab）
- extract/ - 提取相关组件（ExtractionProgress、ProviderSelector、FileUploader、ConfigForm、ProviderEditDialog、BookList）

## 约束

- 组件接收 props、派发事件，不直接操作全局状态
- 样式统一走 TailwindCSS，不内联复杂样式
- 单文件不超过 500 行，过大时主动拆分
- 当前目录有更新时，随之更新本目录下的 CLAUDE.md 和 AGENTS.md，保持两者一致。
