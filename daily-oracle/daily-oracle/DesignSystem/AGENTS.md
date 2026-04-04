# DesignSystem

- 这里只放跨页面复用的设计 token 和基础样式定义，不放具体业务视图。
- Asset Catalog 只负责颜色值和 light/dark 适配；代码里取色只能经过 `Colors.swift`。
- `Colors.swift` 的 token 名必须和资产名一致；业务代码不允许直接写 `Color("...")`，也不允许再做第二层别名翻译。
- 页面背景、内容面板、边框、文字、强调色要分层定义，不允许不同页面各自发明背景语义。
- 修改 token 后要回看 `Views/` 和 Widget 相关代码，确认命名和视觉语义仍一致。
- 当前目录有更新时，随之更新本目录下的 `CLAUDE.md` 和 `AGENTS.md`，保持两者一致。
