# supabase

- 这里是数据库 schema 事实源，`schema.sql` 定义所有表结构。
- Edge Functions 放在 `functions/` 目录，Deno runtime。
- 涉及表结构、字段命名改动时，同步核对本地工作台和 iOS App 三层一致性。
- 当前目录有更新时，随之更新本目录下的 `CLAUDE.md` 和 `AGENTS.md`，保持两者一致。
