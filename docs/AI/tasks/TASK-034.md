# TASK-034: 修复终端重连无响应与通道复用失效、后台切回自愈与 TMUX 会话自动续连

## 1. 任务背景与核心诉求

用户反馈：
> "我现在又发现了个bug,我退出了，然后过一会进他会显示disconnect然后我点reconnect 一直没有反应，但是我点击tmux然后进入新的session瞬间就进去了。你看看什么情况呢？帮我优化"
> "有个hint,我要去config那里点击一下连接才行。。。"
> "还有，我reconnect恢复了，他就回到普通terminal了。你还不如给我关闭了从新打开个、、"
> "意思是当前active 断连 了，那么你要自动的恢复，然后如果有tmux 需要重新连接那么就把当前的关闭了给我从新开一个？"

深入分析根因：
1. **Tauri 2 IPC Channel 注销致命缺陷**：
   原终端组件 `XtermView.tsx` 中将 Tauri 的 `Channel` 作为组件单例创建。当远端 SSH/PTY 断开时，后端 reader 任务退出 drop 了 `on_data`，Tauri 内部会触发 `end` 事件注销回调（`window.__TAURI_INTERNALS__.unregisterCallback`）。用户点击 Reconnect 时重复把已注销的 Channel 传给后端，后端建立了新 shell 发送输出，但前端全部静默丢弃，屏幕一片死寂无响应。
2. **底层 SSH 僵尸死锁与超时失步**：
   应用切出或休眠后，TCP 链路静默失效。在用户点击 Reconnect 前，前端与后端内存中均仍认为服务器是 `Connected`，因此前端跳过了 SSH 重连；后端在死连接上执行 `handle.channel_open_session()` 阻塞等待 10 秒，加上后续重连耗时超过了前端 12 秒超时。此时用户必须手动跑到“服务器配置(Config)”去点连接才能强行刷新 SSH 句柄。
3. **TMUX 状态丢失与脏终端残留**：
   Tab 断开后原地重连只启动普通 bash，没有记录与回放 TMUX attach 指令，导致用户丢失工作上下文；且旧终端屏幕留存死锁前的脏输出，体验极差。

---

## 2. 方案与技术实现

1. **终端生命周期与 Channel 每次隔离 (Per-Session Clean Recreation)**:
   - 在 `XtermView.tsx` 中，每次调用 `startSession` 均构造崭新的 `new Channel<number[] | Uint8Array>()`，确保 Tauri IPC 永远拥有合法注册回调，杜绝数据丢包。
   - `terminal_close` 采用异步 fire-and-forget，后端增加 800ms 超时保护，彻底杜绝关旧通道挂死新重连的问题。

2. **断连自动原地置换 (Zero Dirty State, Seamless Recreation)**:
   - 在 `useTerminalStore.reconnectSession` 中，断线重连不再原地修补脏 DOM，而是就地以全新的唯一 Session ID 实例化全新干净的会话实体，在 Tab 栏位置和标题完全保持不变的情况下让 React 触发全新纯净挂载。
   - 彻底重置终端缓冲区与画布上下文，杜绝残留乱码与假死。

3. **TMUX 会话持久记忆与自动恢复 (Auto Re-Attach TMUX)**:
   - `TerminalSession` 实体持久化 `tmuxSessionName`，并在 Tab 标题匹配 `tmux: <name>` 时自动提取。
   - 重连时自动装配 `pendingCommand: tmux attach -d -t "<name>"\n`，连通后延迟 120ms 自动注入，让用户回到离开前完整的 TMUX 界面，绝不再掉落回普通 bash。

4. **SSH 僵尸链路 3s 极速失败与后端自愈**:
   - `ConnectionManager::open_channel` 超时从 10s 降低为 3s，并在超时或失败时立即清理失效句柄并重置状态为 `Disconnected`。
   - `terminal_open` 遇到通道异常时 3 秒内快速判定失败，并立即调用 `do_connect_server` 自动建立全新 SSH 链路。用户无需再去 Config 列表手动重连。

5. **前台切回与唤醒自动自愈 (App Resume Auto-Heal)**:
   - 在 `App.tsx` 中监听 `visibilitychange`（`visible`）与 `focus` 事件，当应用从后台或锁屏唤醒时，自动同步连接状态；若检测到当前活动的终端处于 `disconnected` 状态，自动发起无感重连恢复。

6. **UI 视觉反馈与便捷操作**:
   - 悬浮恢复徽章增加旋转动画的 `Connecting...` / `正在恢复 TMUX...` 状态提示。
   - 悬浮条提供明确的 `恢复 TMUX` 与 `X`（一键关闭该死会话）按钮。

---

## 3. 验收标准

1. 终端断线后点击恢复不再有任何无响应或假死现象，秒级完成重连。
2. TMUX 标签页断开后点击恢复自动重新 attach 到原来的 TMUX 会话。
3. 应用从后台或锁屏切回后，若活动终端已断开，能够自动发起自愈。
4. `cargo test --manifest-path src-tauri/Cargo.toml` 25 项全通。
5. 前端 `tsc` 与 `build` 0 报错通过。
