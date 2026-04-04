# 开发争论点

## UserConfig 固定 UUID + `@Attribute(.unique)` + CloudKit

**背景**：`UserConfig` 用硬编码默认 UUID 表达「单例」语义，并对 `id` 标了 `@Attribute(.unique)`。容器使用 `cloudKitDatabase: .automatic`。

**争论**：

- **一方**：固定 UUID 保证各端本地最多一行、业务上就是「一个配置」，与 fetch-or-create 配合即可，实现简单。
- **另一方**：两台设备在从未同步过之前各自冷启动并各插入一条「同 UUID」的 `UserConfig` 时，CloudKit 合并行为是否必然与「单条逻辑记录」一致存疑；若合并阶段出现两条同 `id` 的待应用变更，可能与**本地** unique 约束冲突。官方明确：同步并发且择机进行，**CloudKit 无法在服务器侧强制执行 `unique`**（见 *Syncing model data across a person's devices* 中 CloudKit compatible schema 表）。

**已共识的事实**：

- `unique` 主要是本地存储约束，不是 CloudKit 的全局唯一保证。
- 不能把「硬编码 UUID」当作跨设备已由 CloudKit 背书的 singleton 契约；若要坚持 singleton，应依赖 **fetch-or-create / 单一插入路径** 与实测双机场景，而不是仅靠 `unique`。

**未决**：是否要在架构或代码层显式化「仅允许一条 UserConfig」的初始化策略（例如仅在一处 seed、或首启统一 ensure），以及是否保留 `UserConfig.id` 的 `unique`（权衡：本地防重复 vs CloudKit 文档中的兼容性注意）。

**建议的验证**（产品化前）：双设备、同 iCloud 账号、均首次安装并触发插入后，观察同步完成后的行数与崩溃/持久化错误。

## iOS Simulator MCP 的适用边界

**背景**：iOS Simulator MCP 提供通过 Model Context Protocol 程序化控制模拟器的能力（启动、点击、截图、输入等原子操作）。

**争论**：

- **一方**：MCP 自动化可加速探索性测试、批量生成 UI 截图、简化冒烟验证，减少人工操作成本。
- **另一方**：原子操作（`tap`/`swipe`）与测试意图（如"验证结账流程"）存在抽象层级断层。AI 编写 MCP 操作序列时易过度关注"如何点击"而非"验证什么"，导致偏离测试初衷；且坐标/Accessibility ID 硬编码使 UI 微调即失效，与测试稳定性原则冲突。

**已共识的事实**：

- MCP 适合：探索性测试、UI 截图批量生成、简单冒烟验证。
- XCTest/人工 QA 更适合：复杂业务流程验证、回归测试。
- 原子操作与高级测试意图之间存在抽象鸿沟，需显式决策是否建中间抽象层。

**未决**：是否建立 MCP 操作抽象层（如"完成购买"高级意图映射到具体操作序列），或严格限定其使用场景与职责边界。

**建议的验证**：在复杂 UI 流程中使用 MCP 编写测试，观察维护成本与偏离意图的频率。
