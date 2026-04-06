# 全局代码校正计划



## 2. 名句元数据 (Quote Metadata)

**moods（8 种）**：
- `calm`：静
- `sad`：失落、离别、错过
- `anxious`：悬而未决，等待，不安
- `happy`：轻盈，意外的好
- `hopeful`：需要一点希望或鼓励
- `tender`：心里柔软的感觉，温和
- `contemplative`：想安静地思考或沉淀
- `angry`：压着的，不是爆发

**tags**：3-6 个具体语义标签，如 `["离别", "雨", "秋"]`

**其他字段**：
- `text`：原文
- `text_cn`：译文（原文非中文时）
- `why`：提取理由
- `location`：章节名或页码

---

## 3. 宜忌生成 (Almanac)

**Prompt**：硬编码在 Edge Function `daily-oracle/index.ts` 中

**输入信号**（全部可选）：
- `date`: 日期字符串，如 "4 月 5 日 · 周六"
- `solar_term`: 节气字符串，如 "清明"
- `weather`: 天气字符串，如 "晴 23℃" 或 "rainy"
- `anniversary`: 纪念日字符串，如 "结婚 3 周年"
- `mood_history`: 心情字符串数组，如 `["calm", "sad", "happy"]`

**原则**：
- 所有输入信号都是可选的
- 除 `mood_history` 是数组外，其余全部是字符串
- 不做格式校验，AI 根据实际传入的信号生成宜忌
- 如果某个信号为空，Prompt 中对应行留空或删除

**输出格式**：JSON `{"yi": "...", "ji": "..."}`

---

## 4. 数据层 (App)

**DailyRecord 字段**：
- `id`: UUID
- `date`: Date
- `quoteText`: String
- `quoteAuthor`: String
- `quoteWork`: String?
- `quoteYear`: Int?
- `recommended`: String (宜)
- `avoided`: String (忌)
- `moodRawValue`: String? (用户心情选择)
- `note`: String?
- `createdAt`: Date
- `updatedAt`: Date

**UserConfig 字段**：
- `id`: UUID (单例)
- `preferredFontName`: String
- `selectedTheme`: String (黑白主题选择，保留)
- `preferredSourceLanguages`: [String] → 改为用户语言偏好（中文/英文）
- `lastSyncedAt`: Date?
- ~~`preferredQuoteMoodRaw`~~ → **删除**（心情选择即时触发刷新，不需持久化）
- ~~`prefersReducedMotion`~~ → **删除**（暂不需要无障碍动画适配）

---

## 5. 提取流程优化

**现状**：
- 当前提取 Tab 只有单步骤，AI 同时负责提取句子和输出元数据
- 效率低，且质量不稳定

**目标**：
- 改为**双步骤**流程，提高产出质量
  1. **提取步骤**：用 `docs/prompts/extract.md` 提取句子，输出完整元数据（moods/tags/why/location）
  2. **审核步骤**：用 `docs/prompts/review.md` 对提取结果做终审（pass/reject）
- 审核通过的才入库，不通过的丢弃

**Prompt 分工**：
- `docs/prompts/extract.md`：提取用，输出完整元数据
- `docs/prompts/review.md`：审核用，输出 pass/reject
- `docs/prompts/extract-test.md`：调试页面专用（简化版）
- `docs/prompts/review-test.md`：调试页面专用（简化版）

---

## 6. CLAUDE.md / AGENTS.md 重构

**现状**：
- 仅在 `daily-oracle/` 目录下有子目录级的 `CLAUDE.md`/`AGENTS.md`
- 根目录 `CLAUDE.md`/`AGENTS.md` 职责过重，内容过多，且大量重复

**目标**：
- 在 `server/` 目录下也采用相同模式
- 各子目录维护自己的约束文档，根目录只做全局约定

**职责划分**：
- 根目录 `CLAUDE.md`/`AGENTS.md`：项目级约定（架构、开发流程、协作规范）
- `server/CLAUDE.md`/`AGENTS.md`：Server 工作台开发约束
- `server/src/lib/CLAUDE.md`：组件/服务层约束
- `server/src/routes/CLAUDE.md`：路由/API 层约束
- `daily-oracle/CLAUDE.md`/`AGENTS.md`：Apple App 开发约束（已有）
- `daily-oracle/Models/CLAUDE.md`：数据模型约束（已有）
- `daily-oracle/Views/CLAUDE.md`：视图层约束（已有）
- `daily-oracle/Stores/CLAUDE.md`：数据持久化约束（已有）
- `daily-oracle/Services/CLAUDE.md`：外部能力封装约束（已有）

**好处**：
- 动态加载时只需读取相关目录的约束，减少 context 占用
- 职责清晰，修改某模块时只需关注该模块的约束

---