# TASK-011: SSH 断线自动重连联动、终端恢复与防丢码冲突检测

## Objective
在 Rust 后端实现 SSH 断线感知、指数退避自动重连机制与连接状态全局广播；在前端实现断线警告浮条、状态栏重连状态指示、本地未保存编辑 Buffer 安全保护与网络恢复后的防丢码远端冲突检测。

## Scope
- 后端 Rust `src-tauri/src/connection/`:
  - 完善 `ConnectionManager`：
    - 保存当前服务器会话凭据副本以便自动重连
    - 实现 `reconnect(&self, server_id, app_handle)`，支持最大 5 次重试与指数退避 (1s, 2s, 4s, 8s, 16s)
    - 状态流转并通过 `app_handle.emit("connection-state-changed", ...)` 广播全局连接事件
    - 注册 Tauri 命令：`reconnect_server`
  - 单元测试：验证重连状态切换与重试逻辑
- 前端 React/TS:
  - 创建 `src/stores/connectionStore.ts`（Zustand）：
    - 监听 `"connection-state-changed"` 事件
    - 管理当前激活服务器连接状态（`connected`, `connecting`, `reconnecting`, `disconnected`, `failed`）
    - 提供手动一键重连 `reconnectServer(serverId)`
  - 更新 `src/components/StatusBar/StatusBar.tsx`：
    - 展示动态颜色指示灯（绿色已连接、琥珀色重连中闪烁、红色断开）与重试操作
  - 更新 `src/components/Editor/EditorArea.tsx`：
    - 断网时展示顶部警示条：“⚠️ SSH 连接中断，正在自动重连... 本地编辑内容已安全保存在缓冲区”，并提供手动重连按钮
    - 结合 TASK-008 已有的 `sftp_write_file` mtime 冲突校验，恢复后若远端发生外部变动弹窗提示覆盖或重载
  - 更新 `src/components/Terminal/XtermView.tsx`：
    - 连接状态变更时在终端打印相应提示（`Connection interrupted. Reconnecting...` / `Connection re-established.`）

## Allowed Files
- `src-tauri/src/connection/**/*`
- `src-tauri/src/lib.rs`
- `src/stores/connectionStore.ts`
- `src/stores/editorStore.ts`
- `src/components/StatusBar/StatusBar.tsx`
- `src/components/Editor/EditorArea.tsx`
- `src/components/Terminal/XtermView.tsx`
- `src/App.tsx`
- `docs/AI/tasks/TASK-011.md`

## Dependencies
- 前置依赖: TASK-003 (SSH 连接管理器), TASK-008 (CodeMirror 6 编辑器及冲突检测), TASK-009 (xterm.js 终端)

## Inputs and Outputs
- **Inputs**: 网络连接断开信号、用户手动重连指令、远端重连恢复
- **Outputs**: 具备指数退避自动重连的韧性连接系统、不丢代码的安全编辑保护机制

## Acceptance Criteria
1. 后端 `ConnectionManager` 支持指数退避重连与全局事件广播。
2. 断网时前端状态栏与编辑区顶部浮条实时呈现重连进度与状态。
3. 断网期间本地未保存代码保持 Dirty 状态并在内存中完整保留，不丢码。
4. 网络恢复后可成功重新连接并安全提交保存或触发 mtime 冲突检测。
5. 前端 `pnpm run build` 与后端 `cargo test` 全部通过。

## Verification Commands
```bash
cargo test --manifest-path src-tauri/Cargo.toml
pnpm run build
```

## Risks and Assumptions
- 风险: 自动重连若过于激进可能导致服务端拒绝连接；通过指数退避加随机抖动平滑请求。

## Status
DONE

## Verification Results
- `cargo test --manifest-path src-tauri/Cargo.toml`: 12 passed, 0 failed.
- `pnpm run build`: Succeeded with code 0 without any type or bundling errors.
- Exponential backoff reconnection, `connection-state-changed` event broadcasting, floating editor disconnection warning banner, and status bar indicators fully verified.
