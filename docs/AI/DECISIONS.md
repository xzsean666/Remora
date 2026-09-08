# 架构决策记录 (DECISIONS.md)

本文档记录 Remora 项目关键的技术选型、架构决策及其背后的权衡与理由（ADR - Architecture Decision Records）。

---

## ADR-001: 采用 Tauri 2 作为桌面应用骨架

### 状态: ACCEPTED
### 上下文
开发一款类似 VS Code 的远程开发工作区，需要在跨平台桌面 GUI、低内存占用与高并发系统级网络 I/O 之间取得平衡。Electron 内存开销巨大（每个窗口数百 MB），且依赖 Node.js 后端。
### 决策
采用 **Tauri 2 (Rust + Webview)** 作为桌面应用基础。
### 权衡与结果
- **优势**:
  - 安装包极小（数 MB），空闲内存占用极低（< 50MB）。
  - 后端直接运行高性能 Rust 代码，与 Tokio 异步运行时及网络库无缝融合。
  - Tauri 2 提供了全新的 IPC 通道（`Channel` API）、多窗口管理及更精细的系统级能力。
- **代价**:
  - 前端 Webview 依赖宿主系统（Linux 下为 WebKitGTK，macOS 为 WebKit，Windows 为 WebView2），跨平台渲染表现需进行标准化测试。

---

## ADR-002: 采用纯 Rust 异步协议栈 (russh + russh-sftp)

### 状态: ACCEPTED
### 上下文
SSH 连接与 SFTP 管理是 Remora 最核心的基础设施。可选方案包括基于 C 语言的 `libssh2`（如 `ssh2-rs`）或纯 Rust 实现的 `russh`。
### 决策
选择 **russh + russh-sftp**。
### 权衡与结果
- **优势**:
  - 纯 Rust 实现，内存安全无 C 依赖与跨平台动态链接难题。
  - 原生基于 Tokio 异步生态，与异步任务调度、定时 Keepalive、并发传输无缝契合，无需手动处理线程池与阻塞 I/O。
  - 支持最新的加密套件与安全握手算法。
- **代价**:
  - 文档相比成熟的 libssh2 略显紧凑，需精细化封装连接状态机与错误处理。

---

## ADR-003: 选择 CodeMirror 6 作为代码编辑核心

### 状态: ACCEPTED
### 上下文
在前端代码编辑器选型中，主流选择为 Monaco Editor（VS Code 核心）与 CodeMirror 6。
### 决策
选择 **CodeMirror 6**。
### 权衡与结果
- **优势**:
  - 极度轻量（相比 Monaco 打包体积小 80% 以上）。
  - 纯函数式架构与扩展机制（State + Extension + View），对定制快捷键、外部数据流同步非常友好。
  - 对中日韩 (CJK) 输入法 (IME) 及光标处理支持良好。
- **代价**:
  - 语法高亮与语言包需要按需单独引入对应的 `@codemirror/lang-*`。对于 MVP 阶段重点支持的常用开发语言（Rust, TS/JS, Python, Go, JSON, YAML, Markdown, Bash），按需组合即可。

---

## ADR-004: 终端输出采用 Tauri 2 Channel 专用二进制传输通道

### 状态: ACCEPTED
### 上下文
在终端运行高输出命令（例如构建编译、`cat` 大日志、跑测试）时，数据产生频率可达每秒数兆字节。传统 IPC 的 `invoke` 或事件广播涉及大量的 JSON 字符串序列化与主线程排队，会导致 Webview 界面冻结卡死。
### 决策
使用 Tauri 2 的 `tauri::ipc::Channel<Vec<u8>>` 流式传输 PTY 标准输出。
### 权衡与结果
- **优势**:
  - 零 JSON 序列化开销，直接将原生二进制字节块送达前端 xterm.js 的 `terminal.write(uint8Array)`。
  - 极大降低 CPU 占用，彻底消除界面卡顿。

---

## ADR-005: 凭据零明文原则 (OS Keyring + SSH Agent)

### 状态: ACCEPTED
### 上下文
SSH 连接需要用户密码、私钥口令或私钥文件。如果在本地 SQLite 中以明文或弱加密形式持久化存储，会带来严重的安全风险。
### 决策
1. 本地 SQLite 仅存储连接元数据（Host, Port, User, AuthType, KeyPath）。
2. 敏感凭据（Password / Key Passphrase）统一使用系统级凭据管理器（`keyring` crate - Linux SecretService, macOS Keychain, Windows Credential Manager）。
3. 优先推荐并支持原生 `SSH Agent` (`SSH_AUTH_SOCK`) 免密登录与 `~/.ssh/config` 导入。
### 权衡与结果
- **优势**:
  - 符合现代安全开发规范，无泄漏风险。
- **代价**:
  - Linux 无图形环境或特殊无 Headless 环境下 Keyring 初始化可能降级，需提供内存级临时凭据会话支持。

---

## ADR-006: 保护本地 Buffer 与保存冲突检测机制

### 状态: ACCEPTED
### 上下文
远程网络连接随时可能发生波动或中断。如果断网时用户正在输入或按保存，不能发生代码丢失或静默覆盖远程最新变更。
### 决策
1. **状态隔离**: CodeMirror 的 Buffer 数据由本地 Zustand 单独托管，独立于网络连接状态。
2. **断网保存保护**: 网络离线时，Ctrl+S 触发轻量离线提醒并保持 Dirty 标记；重连恢复后可无损保存。
3. **冲突检测**: 每次从远程加载文件时记录文件的 `mtime`。保存前先进行一次 SFTP `stat`，若远程修改时间大于打开时间，阻断直接覆盖并提示用户进行差异决策。
