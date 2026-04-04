# Swift Daily Oracle（每日名句）

本地工作台负责从书籍 txt 解析、AI 提取名句、人工审核后写入 Supabase；iOS App 与小组件展示内容。实现细节与边界以架构文档为准。

## 文档

| 文档 | 说明 |
|------|------|
| [docs/architecture.md](docs/architecture.md) | 架构与流程的唯一事实源 |
| [servers/supabase/schema.sql](servers/supabase/schema.sql) | 数据库表结构与枚举 |

## 仓库结构

- `server/` — SvelteKit 本地工作台（提取、SQLite 待审、审核入库）
- `daily-oracle/` — iOS 主工程（SwiftUI、SwiftData、WidgetKit）
- `docs/` — 架构、schema、prompt、设计参考等

## 语料来源备忘（非实现约束）

以下为选题/公版方向备忘，具体元数据与正文仍以各书 txt 为准。

**英文（公版可直接处理）**  

- **Hemingway**：《The Sun Also Rises》《A Farewell to Arms》《For Whom the Bell Tolls》《The Old Man and the Sea》及短篇（如 *The Snows of Kilimanjaro*）等。  
- **Fitzgerald**：《The Great Gatsby》《Tender Is the Night》《This Side of Paradise》《The Beautiful and Damned》等。  
- **Virginia Woolf**：《Mrs Dalloway》《To the Lighthouse》《The Waves》《Orlando》《A Room of One's Own》等。  
- **Kafka（英译）**：《The Trial》《The Castle》《The Metamorphosis》及短篇集等。  
- **卡尔维诺（英译）**：如《If on a winter's night a traveler》《Invisible Cities》《Cosmicomics》《The Baron in the Trees》等。  
- **简·奥斯汀**：《Pride and Prejudice》《Sense and Sensibility》《Emma》《Persuasion》等。  
- **艾米莉·勃朗特**：《Wuthering Heights》。

**日文（中译）**  

- **川端康成**：《雪国》《伊豆的舞女》《千羽鹤》《古都》《睡美人》等。  
- **太宰治**：《人间失格》《斜阳》《奔跑吧，梅勒斯》《维庸之妻》《女生徒》等。  
- **村上春树**：《挪威的森林》《且听风吟》《1973年的弹子球》《寻羊冒险记》《世界尽头与冷酷仙境》《海边的卡夫卡》《奇鸟行状录》等。

**韩文（中译）**  
韩江《素食者》《白》。

**歌词**  
Bob Dylan、Leonard Cohen；中文可考虑李宗盛、朴树、陶喆、王菲。

**中文**  

- **杜甫**：诗作见《杜工部集》；名篇如「三吏」「三别」、《登高》《春望》等（公版以集子或选本为准）。  
- **鲁迅**：《呐喊》《彷徨》《故事新编》《野草》《朝花夕拾》《坟》《热风》等。  
- **张爱玲**：《传奇》《倾城之恋》《金锁记》《半生缘》《红玫瑰与白玫瑰》等。  
- **萧红**：《生死场》《呼兰河传》《马伯乐》《商市街》等。  
- **穆旦**：《穆旦诗集》《探险队》《旗》等（诗作以全集/选集为准）。  
- **邱妙津**：《鳄鱼手记》《蒙马特遗书》等。  
- **黎紫书**：《流俗地》《告别的年代》《野菩萨》《暂停键》等。  
- **白先勇**：《台北人》《孽子》《树犹如此》《纽约客》等。  
- **金庸**：《射雕英雄传》《神雕侠侣》《倚天屠龙记》《天龙八部》《笑傲江湖》《鹿鼎记》等（「飞雪连天射白鹿，笑书神侠倚碧鸳」十四部）。

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

如果失败了，应该有 fallback page 避免应用崩溃。



筛选 


语言  我可以选多种语言查看

主题：歌曲 电影 作家 歌曲 


字体 


卡片主题：特定节日 特定背景图片 

如果自定义节日呢?