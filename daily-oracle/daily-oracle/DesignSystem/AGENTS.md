# DesignSystem

## 职责

这里只放设计 token 和基础样式。

## 文件清单

- Colors.swift - 语义色板（Asset Catalog light/dark）+ 宜忌固定色 + Mood enum + 心情色
- Spacing.swift - 4pt grid 间距 + 圆角
- Typography.swift - 字号层级（名句衬线、导航、日历、设置、标签）

## 约束

- 颜色 token 必须与 Asset Catalog 的 colorset 1:1 对应
- 视图层不要直接写 Color("...") 资产名，只从 Colors.swift 取语义入口
- 当前目录有更新时，随之更新本目录下的 CLAUDE.md 和 AGENTS.md，保持两者一致。
