# TASK-022: 终端空闲超时断连检测、超时防挂死与无感自动重连优化

---

## 1. 任务背景与目标

在长时间使用或网络空闲时，用户遇到了以下关键缺陷：
1. **黄色圆点（`connecting`）永久挂死**: 当 SSH 远程连接因空闲超时、网络切换或服务器端策略断开后，用户新建或恢复终端时，由于后端 `open_channel` / `request_pty` / `request_shell` 缺少超时防护，底层调用永久阻塞（Hang）。前端 Promise 永不 resolve，Tab 永久处于黄色脉冲圆点状态。
2. **终端静默失效与按键无效**: 远端通道断开后，Rust 端后台循环静默退出，但没有向前端发射关闭事件。前端仍显示连接正常，用户按键输入失败且无任何回显和错误提示。
3. **缺少重连与恢复通道**: 终端断开后没有自动重连机制，也没有一键重连按钮，用户无法恢复正在使用的终端环境。

本任务目标：
- 为所有 SSH 通道开启与终端建立异步调用注入严谨的超时保护（10s），彻底根治黄点永久挂死。
- 实现后端通道关闭的实时事件通知，毫秒级同步终端状态至前端。
- 在集成终端与 Tab 栏增加“断开提示”、“按回车键重新连接”和“一键重连按钮”，实现秒级平滑恢复。

---

## 2. 详细设计方案

### 2.1 后端防挂死超时体系
- 在 `ConnectionManager::open_channel`:
  - 为 `handle.channel_open_session()` 增加 10 秒 `tokio::time::timeout` 保护。
  - 若超时或发生连接重置，立即返回 `AppError::Connection("SSH channel open timed out")`。
- 在 `TerminalSession::start`:
  - 为 PTY 请求、Shell 请求以及环境变量/启动命令发送全部封装 10 秒超时防护。
  - 遇到任何环节超时，快速返回明确的 `AppError::Terminal` 错误，绝不阻塞 Tauri IPC 线程。

### 2.2 通道关闭的主动事件推送
- 在 `TerminalSession` 的后台轮询循环中：
  - 当接收到 `ChannelMsg::Eof`、`ChannelMsg::Close`、`None` 或网络写失败时，向前端发出 `terminal-session-closed` 事件，携带 `sessionId`、`serverId` 与关闭原因。
  - 在 `terminal.write` 失败时，返回精准错误并协助前端判定断连。

### 2.3 前端实时断连感知与终端提示
- 在 `useTerminalStore` 中挂载 `terminal-session-closed` 事件监听器：
  - 收到后将对应 `session.status` 变更为 `"disconnected"`。
- 在 `XtermView` 中：
  - 当检测到终端断连或写入失败时，在 xterm 窗口内打印高对比度恢复提示：
    `\r\n\x1b[33m[Remora] Terminal connection lost. Press [Enter] or click Reconnect to restore session.\x1b[0m\r\n`
  - 捕获用户键盘回车键（Enter），在 disconnected 状态下一键触发静默重连。
  - 设置 12 秒连接超时兜底，防止意外情况下前端状态停滞在 yellow connecting。

### 2.4 Tab 栏状态与一键重连操作
- 在 `TerminalTabBar.tsx` 中：
  - 断开时显示红色指示灯。
  - 在断开的 Tab 上提供“一键重连”按钮（刷新小图标），悬停显示 Tooltip：`Disconnected - Click to Reconnect`。
  - 点击即可销毁旧连接并重新发起连接建立，无缝复用现有终端标签页。

---

## 3. 验收标准

1. 新建终端或重连终端遇到网络超时或连接僵死时，10秒内精准抛出超时并转为 `disconnected`，绝不发生永久黄点（`connecting`）挂死。
2. 当远程 SSH 连接空闲超时或意外断开时，前端毫秒级收到断开通知，Tab 状态变为断开，终端输出清晰指引。
3. 用户在断开的终端中按回车键，或点击 Tab 上的重连按钮，能够全自动重新建立终端，恢复正常输入输出。
4. `cargo check`, `cargo test`, `pnpm tsc --noEmit`, `pnpm build` 全部通过。
