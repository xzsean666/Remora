# TASK-031: 修复局域网/移动端SSH心跳断连、终端通道死锁泄漏(OpenSSH no more sessions)与一键TMUX无缝恢复

## 1. 任务背景与核心痛点

用户在手机端与局域网实机使用 Remora 连接远端服务器（Ubuntu 24.04, `root@192.168.31.110`）时反馈以下三大痛点：
1. **局域网极易掉线**：手机端在闲置 30~45 秒后网络即断开。
2. **点击 Reconnect 永久失效**：终端掉线后提示 `Press [Enter] or click 'Reconnect' to retry`，但点击 Reconnect 或敲击 Enter 完全没有任何恢复效果，终端持续报错。
3. **TMUX 无法恢复后台任务**：手机上运行了 TMUX 会话（内含运行中的 `ai agya` 交互任务），断线后点击手机辅助栏的 `TMUX` 按钮无法恢复。

通过对远端机 `sshd-session` 系统日志与前后端代码的实机分析，定位出以下四大根本原因：
- **russh Keepalive 策略过于激进 (45s 误杀)**：
  后端设置 `keepalive_interval = 15s`，但 `keepalive_max` 默认为 3。移动端灭屏或短暂休眠触发 Wi-Fi 节能时，未能在 45s 内回包，russh 强行撕毁 TCP 套接字。且未开启 `nodelay = true` (TCP_NODELAY)。
- **致命通道互斥锁死锁导致 OpenSSH 资源泄漏 (error: no more sessions)**：
  在 `src-tauri/src/terminal/session.rs` 中，读写与关闭操作共用 `Arc<Mutex<Channel>>`。后台监听协程在 `ch.wait().await`（等待远端数据）期间独占互斥锁。当断线或重连触发 `session.close()` 时，`close()` 发生死锁挂起，导致 `channel.close()` 无法送达服务端。前端多次重试 `terminal_open` 导致 OpenSSH 累积打开 10 个未关闭的僵尸会话通道，触碰 OpenSSH 的 `MaxSessions 10` 阈值，服务端持续报错 `error: no more sessions` 并拒绝任何新通道。
- **重连层级脱节**：
  前端 `reconnectSession` 仅尝试在已死亡或耗尽的 SSH 底层连接上重新请求 `terminal_open`，未联动 SSH 底层连接自愈恢复。
- **断线状态下 TMUX 指令被静默丢弃**：
  `sendDataToActiveTerminal` 判定 `backendSessionId` 不存在时直接退出，未做重连后待发缓冲；且会话探测未考虑既有会话。

---

## 2. 详细改造方案与实现

### 2.1 终端通道读写完全解耦 (Split Channel 无锁设计)
- 在 `src-tauri/src/terminal/session.rs` 中使用 `let (read_half, write_half) = channel.split()`：
  - **读协程完全无锁**：独立持有 `ChannelReadHalf`，纯异步等待 `read_half.wait().await`，不占用任何 Mutex。
  - **写与关闭协程独立**：`ChannelWriteHalf` 封装于 `Arc<Mutex<ChannelWriteHalf<Msg>>>`，仅在发送写入切片瞬间加锁微秒级释放。
  - **彻底消灭通道死锁与泄漏**：`session.close()` 能立即获取锁并向服务端发送 `eof` 与 `close`，通道及时退还给 OpenSSH，彻底杜绝 `MaxSessions 10` 溢出及 `error: no more sessions` 报错。

### 2.2 强化 KeepAlive 韧性与禁用 Nagle 延迟
- 在 `src-tauri/src/connection/manager.rs`：
  - 开启 `config.nodelay = true`，提升交互式终端包发送即时性。
  - 调整心跳为 `keepalive_interval = 20s`, `keepalive_max = 6`（提供 120 秒抗干扰容忍度），避免手机 Wi-Fi 芯片微睡眠导致误杀。
  - 在 `open_channel` 中增加 `handle.is_closed()` 主动探测，一旦物理连接关闭立即标记 `Disconnected` 并清理僵尸 handle。

### 2.3 终端与 SSH 服务端连接全链路自愈恢复
- 在 `src-tauri/src/lib.rs` 的 `terminal_open` 中：
  - 提取 `do_connect_server` 内部自愈连接函数。
  - 若检测到底层连接未处于 `Connected` 状态，自动装载密钥凭证执行无缝重连。
  - 若首次 `terminal.open()` 因网络抖动失败，自动触发一次 SSH 重新建联并重试开辟终端。
- 在 `src/components/Terminal/XtermView.tsx` 中：
  - 优化 `startSession`：异步安全等待旧通道释放。
  - 若检测到对应服务器断开，自动优先调用 `connect_server` 恢复底层通道，并在终端输出 `[Remora] Reconnecting SSH server...` 明确反馈。

### 2.4 TMUX 待发指令缓冲与智能会话附着
- 在 `src/stores/terminalStore.ts`：
  - 新增 `pendingCommand?: string | number[]` 属性与 `setPendingCommand` 动作。
  - 当终端未连接（`disconnected` 或 `backendSessionId == null`）时调用 `sendDataToActiveTerminal`，不再静默丢弃，而是将指令存入 `pendingCommand` 并自动触发 `reconnectSession`。
  - 终端通道连接成功并在 `updateBackendSessionId` 获取到后端 ID 时，延时 120ms 自动重放 `pendingCommand`。
- 在 `src/components/Terminal/TerminalMobileBar.tsx`：
  - 优化 `handleTmuxAutoBootstrap` 脚本：优先探测并附着到指定的会话名；若未找到则自动探测远端服务器上已存在的 `remora_*` 会话（例如 `remora_git_1`），百分百挂载回正在运行的后台任务。

### 2.5 Android 原生常亮屏锁 (Keep Screen On)
- 在 `MainActivity.kt` 的 `onCreate` 中加入 `window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)`，确保前台查看与操作终端时手机不灭屏。

---

## 3. 验收标准与验证结果

1. `cargo test`: 24 组单元测试 + 1 组 e2e 测试全数通过。
2. `pnpm tsc --noEmit`: 前端类型检查 0 报错。
3. `pnpm build`: Vite 前端生产环境构建 100% 成功。
4. 通道释放测试：连续关闭或重连终端，服务端不再泄漏 channel，OpenSSH 不再触发 `error: no more sessions`。
5. 实机 TMUX 续接测试：`remora_git_1` 能够被断线后的 TMUX 按钮自动重连并重新挂载。
