# TASK-005: 远程 PTY 终端会话与 Tauri 2 Channel 二进制流

## Objective
在 Rust 后端实现多会话远程 PTY 终端管理器 (`TerminalManager`)，利用 Tauri 2 原生 `tauri::ipc::Channel<Vec<u8>>` 实现高吞吐、零 JSON 开销的二进制数据流下行传输，提供终端写入、窗口动态调整 (`SIGWINCH`) 与多标签会话生命周期管理。

## Scope
- 实现 `TerminalSession`：管理独立 SSH Channel、PTY 请求、窗口尺寸与 Tokio 异步读写任务
- 实现 `TerminalManager`：管理多 Server、多 Tab 终端会话池
- 下行数据流：基于 Tauri 2 `Channel<Vec<u8>>` 流式推送 PTY 原始字节流至 Webview
- 上行数据流：接收 Webview 键盘/粘贴输入并通过 Tokio Channel 异步写出
- 窗口尺寸同步：实现 `terminal_resize(session_id, cols, rows)`，调用 `channel.window_change`
- 自动 Workspace 切换：终端启动时如果指定 `initial_dir`，自动发送 `cd "<dir>" && clear\n` 指令
- 暴露 Tauri 2 IPC 接口：`terminal_open`, `terminal_write`, `terminal_resize`, `terminal_close`
- 编写单元测试验证终端会话生命周期与消息分派

## Allowed Files
- `src-tauri/Cargo.toml`
- `src-tauri/src/terminal/**/*`
- `src-tauri/src/core/**/*`
- `src-tauri/src/lib.rs`
- `docs/AI/tasks/TASK-005.md`

## Dependencies
- 前置依赖: TASK-003 (SSH 异步连接管理器就绪)

## Inputs and Outputs
- **Inputs**: Server ID, initial_cols, initial_rows, initial_dir, Tauri IPC Channel, 终端输入字节
- **Outputs**: 实时终端输出二进制流 (Channel)、会话 ID、退出状态

## Acceptance Criteria
1. 使用 Tauri 2 `Channel<Vec<u8>>` 进行下行二进制流推送，免除 JSON 序列化。
2. 支持窗口改变事件 (`window_change`) 动态同步行列数。
3. 支持多终端会话隔离，关闭会话时自动清理 Tokio 任务与 Channel。
4. 单元测试覆盖会话创建、写入分发与关闭流程全部通过。

## Verification Commands
```bash
cargo test --manifest-path src-tauri/Cargo.toml terminal::
cargo check --manifest-path src-tauri/Cargo.toml
```

## Risks and Assumptions
- 风险: 远程终端 high-frequency 输出背压处理；Tokio mpsc 与 Tauri Channel 具备内置缓冲机制。

## Status
DONE
