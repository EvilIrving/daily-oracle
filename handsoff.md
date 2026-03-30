## pnpm + better-sqlite3 安装修复 - 2026-03-30 from: Cursor | id: n/a

主题: server 依赖安装失败与 node-gyp PATH 修复 | 标签: [build, config, bugfix]

摘要:
在 server 目录执行 `pnpm i` 时，`better-sqlite3` 的 install 脚本失败（ELIFECYCLE）。根因是 Node 24.12.0 无预编译包需本地编译，但脚本里执行 `node-gyp` 时 PATH 中找不到命令——pnpm 隔离布局下根项目的 node-gyp 不会出现在 better-sqlite3 包脚本的 PATH 中。通过在 `server/package.json` 使用 `pnpm.packageExtensions` 为 `better-sqlite3@*` 注入 `node-gyp` 依赖，使 node-gyp 进入该包的依赖树，安装脚本能解析到 node-gyp；随后 `pnpm install --no-frozen-lockfile` 成功并完成源码编译。验证时需注意先 `svelte-kit sync` 再 `pnpm check`，否则缺 `.svelte-kit/tsconfig.json`。

决策:

- 采用 packageExtensions 绑定 node-gyp 到 better-sqlite3，而非仅加根 devDependencies（后者仍无法被子包 install 脚本找到）。
- 不单独要求用户全局安装 node-gyp，保持可复现的仓库级配置。

备注:

- 首次安装或改 package.json 后若 lockfile 冻结，需 `--no-frozen-lockfile` 或更新 lockfile。
- 仍可能出现 `No prebuilt binaries found` 警告，属预期，会走 node-gyp 编译。

原因:

- prebuild-install 对 Node 24 / darwin / arm64 暂无匹配预构建时需本地编译。
- pnpm 的依赖隔离导致 `node-gyp` 必须作为 better-sqlite3 可解析的依赖出现。

引用:

- 文件: `server/package.json`（`pnpm.packageExtensions`）
- 命令: `cd server && pnpm install --no-frozen-lockfile`；`pnpm exec svelte-kit sync && pnpm check`
