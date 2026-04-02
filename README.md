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




可以分成两条线：**苹果自己怎么测**，以及**你做 App 时一般怎么测**。

---

### 苹果（系统 / 自带 App）

对外细节不多，但公开能归纳出的包括：大量**真机 + 自动化**（单元 / 界面 / 性能 / 无障碍等）、内部与**员工 / 合作伙伴**的预发布渠道、以及面向公众的 **Beta**（例如开发者预览版系统）。他们也会在多种机型、网络、地区组合下做验证。具体流程不会完全公开。

---

### 你做 iOS / macOS App 时常见做法

1. **开发者本机**  
   Simulator 跑得快，适合逻辑和大部分 UI；**真机**必测（性能、相机、推送、小组件、触觉等 Simulator 不准或没有的能力）。

2. **自动化测试（在工程里）**  
   - **单元测试**：测模型、业务逻辑（你们项目规范里提到 **Swift Testing**）。  
   - **UI 测试（XCTest UI）**：录屏式或代码驱动，点按钮、走流程，适合回归。  
   - 用 `xcodebuild test` 在 CI（如 Xcode Cloud、GitHub Actions、自建 Mac）里跑。

3. **人工测试**  
   按「用户故事」或检查清单过一遍：安装、升级、深色模式、动态字体、无网、弱网等。

4. **TestFlight**  
   上传到 App Store Connect，邀请**内测 / 外测**用户装 beta，收集崩溃和反馈（和正式审核是两套流程）。

5. **App Store 审核**  
   主要是**合规与基本可用性**，**不是**替你保证测试覆盖率；上线前的质量仍靠你自己 + TestFlight。

6. **小组件 / App Clip / Watch**  
   各自有 extension target，要在对应环境（真机、多尺寸）单独验。

---

**一句话**：苹果侧是规模化自动化 + 真机 + Beta；你做 App 则是 **Simulator/真机 + 单元/UI 测试 + TestFlight + 人工清单**，审核只算最后一道门槛，不能替代测试。