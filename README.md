# Swift Daily Oracle（每日名句）

本地工作台负责从书籍 txt 解析、AI 提取名句、人工审核后写入 Supabase；iOS App 与小组件展示内容。实现细节与边界以架构文档为准。

## 文档

| 文档 | 说明 |
|------|------|
| [docs/architecture.md](docs/architecture.md) | 架构与流程的唯一事实源 |
| [docs/schema.sql](docs/schema.sql) | 数据库表结构与枚举 |
| [docs/env.md](docs/env.md) | 环境变量与外部服务 |

## 仓库结构

- `server/` — SvelteKit 本地工作台（提取、SQLite 待审、审核入库）
- `daily-oracle/` — iOS 主工程（SwiftUI、SwiftData、WidgetKit）
- `docs/` — 架构、schema、prompt、设计参考等

## 语料来源备忘（非实现约束）

以下为选题/公版方向备忘，具体元数据与正文仍以各书 txt 为准。

**英文（公版可直接处理）**  
Hemingway、Fitzgerald、Virginia Woolf、Kafka（英译）、卡尔维诺（英译）；可补充简·奥斯汀、艾米莉·勃朗特。

**日文（中译）**  
川端康成《雪国》、太宰治《人间失格》、村上春树《挪威的森林》。

**韩文（中译）**  
韩江《素食者》《白》。

**歌词**  
Bob Dylan、Leonard Cohen；中文可考虑李宗盛、朴树、陶喆、王菲。

**中文**  
杜甫、鲁迅、张爱玲、萧红、穆旦、邱妙津、黎紫书、白先勇、金庸等。

## app 付费项

个性组件(带自定义背景 像素风 温暖风 等等。 )和icon  参考小宇宙
纪念日管理（自定义输入/选择日期）
有不同的日历主题，比如粤语歌主题、电影主题、某作家主题等（免费版只能选择 中文/英文/歌曲 等大的分类。开启vip 后 分类更细致。

后续要统计 收和丢的数据，优化 prompt



中文

殆知阁 — 古籍为主，质量高
中国哲学书电子化计划 — 经典文献
书格 — 古籍扫描版

英文/多语言

Project Gutenberg — 最全，直接下载 txt/epub，陀思妥耶夫斯基英译本在这里
Standard Ebooks — Gutenberg 的精排版本，排版更好
Internet Archive — 量大，包含扫描版

圣经专项

bible.com 可以下载，或直接搜"和合本 txt"有大量镜像
Gutenberg 上有 King James Version












export SUPABASE_ACCESS_TOKEN=你的token