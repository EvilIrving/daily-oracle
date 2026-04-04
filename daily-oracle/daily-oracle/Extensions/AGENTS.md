# Extensions

- 这里只放 Foundation / SwiftUI / 系统类型的轻量扩展，解决局部复用问题，不承载业务主流程。
- 扩展应保持无副作用和低耦合；复杂状态、网络调用、持久化写入分别回到 `Stores/`、`Services/`、`Models/`。
- 新增扩展前先确认不是更适合做工具类型或显式方法，避免把隐式行为分散到过多 extension 里。
- 当前目录有更新时，随之更新本目录下的 `CLAUDE.md` 和 `AGENTS.md`，保持两者一致。
