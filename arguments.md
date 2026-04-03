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
