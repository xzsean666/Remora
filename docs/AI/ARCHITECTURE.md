# Remora 架构设计与技术规范 (ARCHITECTURE.md)

本文档定义 Remora 的系统架构、模块职责、数据流、关键通道设计及架构优化演进策略。

---

## 1. 总体架构图

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                              Remora Frontend (Webview)                       │
│                                                                              │
│   ┌───────────────┐  ┌───────────────────┐  ┌────────────────────────────┐   │
│   │ Activity Bar  │  │ Project Explorer  │  │       Editor Area          │   │
│   │               │  │  - File Tree View │  │   - CodeMirror 6           │   │
│   │ - Explorer    │  │  - Lazy Loading   │  │   - Multi-Tab Manager      │   │
│   │ - Servers     │  │  - Context Menu   │  │   - Dirty Buffer Store     │   │
│   │ - Transfers   │  │  - Drag & Drop    │  │   - Conflict Detection     │   │
│   │ - Settings    │  └───────────────────┘  └────────────────────────────┘   │
│   └───────────────┘  ┌───────────────────────────────────────────────────┐   │
│                      │              Terminal Panel (Bottom)              │   │
│                      │   - xterm.js Multi-Tabs                           │   │
│                      │   - WebGL / Canvas / IME Addons                   │   │
│                      │   - FitAddon (Resize Observer)                    │   │
│                      └───────────────────────────────────────────────────┘   │
│   ────────────────────────────────────────────────────────────────────────   │
│   Zustand Stores: connectionStore, projectStore, fileStore, editorStore,     │
│                   terminalStore, transferStore, uiStore                      │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │ Tauri 2 IPC Commands & Streaming Channels
┌──────────────────────────────────────▼───────────────────────────────────────┐
│                           Rust Core (Tauri 2 Backend)                        │
│                                                                              │
│  ┌───────────────────────┐ ┌───────────────────────┐ ┌─────────────────────┐ │
│  │   ConnectionManager   │ │    TerminalManager    │ │   TransferManager   │ │
│  │  - russh Client Loop  │ │  - PTY Multiplexing   │ │  - Chunked Worker   │ │
│  │  - Keepalive Pings    │ │  - Tauri Channel Tx   │ │  - Resume Support   │ │
│  │  - Exponential Retry  │ │  - Window Resize (SIG)│ │  - Progress Events  │ │
│  └──────────┬────────────┘ └───────────┬───────────┘ └──────────┬──────────┘ │
│             │                          │                        │            │
│  ┌──────────▼────────────┐ ┌───────────▼───────────┐ ┌──────────▼──────────┐ │
│  │      SftpService      │ │     StorageService    │ │    SecurityService  │ │
│  │  - Metadata / Readdir │ │  - SQLite (rusqlite)  │ │  - OS Keyring       │ │
│  │  - Read / Write File  │ │  - Servers & Projects │ │  - SSH Agent / Sock │ │
│  │  - Rm / Mv / Mkdir    │ │  - Layout Preferences │ │  - ~/.ssh/config    │ │
│  └───────────────────────┘ └───────────────────────┘ └─────────────────────┘ │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │ SSH2 Protocol (TCP)
┌──────────────────────────────────────▼───────────────────────────────────────┐
│                              Remote Linux Server                             │
│       - SSHD                                                                 │
│       - SFTP Subsystem                                                       │
│       - PTY / Shell Sessions (/bin/bash, /bin/zsh, etc.)                     │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 核心架构设计与优化点 (Architecture Optimizations)

在基础 MVP 设计的基础上，为保证轻量化、高吞吐、弱网鲁棒性与开发体验，引入以下 7 项深度优化：

### 优化 1: SSH 通道隔离与多路复用 (Channel Isolation)
- **挑战**: 单个 SSH 会话内，如果大文件上传/下载与普通目录读取、文件保存共享同一个 SFTP 会话通道，会导致 Head-of-Line Blocking（队头阻塞），导致编辑保存卡顿。
- **架构方案**:
  - `ConnectionManager` 维护每个远程主机的单一底层 TCP/SSH 连接句柄（Session）。
  - **通道分离**:
    - **SFTP 交互通道**: 专用于 Project Explorer 目录查询、文件快速读取、Ctrl+S 保存。
    - **SFTP 传输独立通道**: `TransferManager` 执行后台大文件传输时开启独立 SFTP Subsystem 通道，互不干扰。
    - **终端通道**: 每个 Terminal 标签页独立开立一个 `Channel<Msg>` 并请求独立的 PTY。

### 优化 2: 基于 Tauri 2 专用通道的高性能 PTY 流传输
- **挑战**: 终端高频输出（如 `cat large.log`、`htop`、编译输出）若通过传统的 Tauri `invoke` 轮询或全局事件广播，会产生严重的 JSON 序列化性能开销与 Webview 主线程卡顿。
- **架构方案**:
  - **下行流 (Rust -> Webview)**: 采用 Tauri 2 专用的 `tauri::ipc::Channel<Vec<u8>>`，二进制字节直推前端 xterm.js，免除 JSON 编解码。
  - **上行流 (Webview -> Rust)**: 前端键盘敲击和粘贴数据通过 `invoke("terminal_write", { sessionId, data })` 写入 Tokio 的无锁 `mpsc::Sender<Vec<u8>>`。
  - **窗口尺寸自适应**: 监听前端 Panel Resize，使用 `FitAddon` 算出 `(cols, rows)`，调用 `channel.window_change(cols, rows, 0, 0)` 实时通知远程操作系统更新 PTY `SIGWINCH`。

### 优化 3: 弱网鲁棒性与防丢码策略 (Network Resilience & Buffer Safety)
- **挑战**: 远程开发最致命的问题是网络闪断导致已写代码被重置或无法保存，以及终端全部异常退出。
- **架构方案**:
  - **本地 Buffer 绝对安全**: 编辑器已修改的内容完全保存在前端 Zustand 状态机中。任何网络中断都不会清空或覆盖本地内容。
  - **离线与保存队列**: 断网时若用户按 `Ctrl + S`，提示 "网络连接已断开，已暂存本地，重连后可一键重试保存"，禁止强制清空 dirty 标记。
  - **保存冲突检测**: 每次保存前比对远程文件的 `mtime`（修改时间）。若发现自打开后远程文件已被第三方修改，弹出冲突对比提示，禁止无条件静默覆盖。
  - **终端断线处理**: 网络断开时，xterm 界面覆盖轻量状态条（`[SSH 连接已断开，正在尝试重连...]`）。重连成功后，自动为用户重新开启 Shell 并自动进入当前 Project Root。

### 优化 4: 远程文件树虚拟化与智能过滤 (Explorer Optimization)
- **挑战**: 远程大型项目（包含 `node_modules`、`.git`、`target`、`vendor`）包含数十万文件，一次性全量加载会直接压垮 SFTP 与 DOM。
- **架构方案**:
  - **纯懒加载 (Strict Lazy Loading)**: 仅在用户展开文件夹节点时，按需调用 SFTP `readdir`。
  - **内置智能忽略规则**: 默认将 `.git/objects`、`node_modules`、`target/debug` 等庞大依赖目录设为延迟统计，不展开不预读。
  - **前端 DOM 虚拟列表 (Virtualization)**: 文件树在大规模展开时采用虚拟化滚动渲染，保证无论展开多少文件，DOM 节点数恒定在 ~50 个以内。

### 优化 5: 零明文安全凭据体系 (Secure Credentials & OpenSSH Integration)
- **挑战**: SQLite 数据库若以明文存储 SSH 密码或私钥口令，存在严重安全风险。
- **架构方案**:
  - **系统级安全存储**: 密码及私钥 Passphrase 仅存储于操作系统安全凭据管理器（Linux SecretService / macOS Keychain / Windows Credential Manager），通过 Rust `keyring` crate 操作。
  - **SSH Agent 优先**: 原生支持通过环境变量 `SSH_AUTH_SOCK` 接入本地 `ssh-agent` 或 1Password / GPG 代理，完全免密安全登录。
  - **OpenSSH 互操作**: 解析用户已有的 `~/.ssh/config`，自动发现已知 Host、User、IdentityFile、Port 和 ProxyJump，极大降低配置成本。

### 优化 6: 稳健的分块文件传输器 (Resumable Transfer Manager)
- **挑战**: 上传大文件（如压缩包、数据集）若单次崩溃需从头再来，且缺乏进度反馈。
- **架构方案**:
  - 传输分块流式处理（默认 64KB/128KB chunk）。
  - 支持追踪已传输字节数 (`bytes_transferred / total_bytes`) 并向前端发送高频节流的进度事件。
  - 支持暂停、取消和重试。

### 优化 7: 原生拖拽上传管线 (Native Drag & Drop Pipeline)
- **架构方案**:
  - 监听 Tauri 2 Webview 的 `on_drag_drop_event`，获取拖入的操作系统绝对路径数组。
  - 前端计算鼠标悬停在 Explorer 树中的具体文件夹节点，得到目标 `remote_target_dir`。
  - 后端 Rust 任务以异步非阻塞形式递归创建远程文件夹并上传文件，同时显示在 Transfer 面板。

---

## 3. 技术栈选型

| 模块 | 选型 | 版本/规范 | 决策理由 |
| :--- | :--- | :--- | :--- |
| **跨平台桌面容器** | Tauri | 2.x | 极轻量资源占用，启动毫秒级，Rust 原生安全性与性能 |
| **前端框架** | React + TypeScript | 19.x / 5.x | 生态成熟，强类型，组件化开发标准 |
| **状态管理** | Zustand | 5.x | 极简、无冗余样板代码、无上下文包裹、轻量高性能 |
| **代码编辑器** | CodeMirror 6 | 6.x | 极度模块化、轻量级、针对长文件优化、移动与 IME 友好 |
| **集成终端** | xterm.js | 5.x | 工业级终端模拟器，完美支持 ANSI、Unicode 及 IME 扩展 |
| **样式与布局** | TailwindCSS | 3.x / 4.x | 高度自由的 Flex/Grid 布局，易实现 VS Code 风格拖拽面板 |
| **后端异步运行时**| Tokio | 1.x | Rust 工业级高并发异步运行时 |
| **SSH 协议栈** | russh + russh-sftp | 0.40+ | 纯 Rust 异步 SSH2 协议实现，与 Tokio 深度融合 |
| **本地存储** | SQLite (rusqlite) | 3.x | 零配置单文件数据库，用于项目历史、服务器配置及 UI 布局 |
| **凭证安全** | keyring-rs | 3.x | 调用 OS 级钥匙串保护敏感密码及密钥口令 |

---

## 4. 模块结构与文件布局

```text
Remora/
├── AGENTS.md                   # AI 协作规则
├── docs/                       # 项目文档体系
│   ├── AI_AGENT_PROMPT.md
│   └── AI/
│       ├── GOAL.md
│       ├── ARCHITECTURE.md
│       ├── DECISIONS.md
│       ├── TASK_INDEX.md
│       ├── SESSION_STATE.md
│       └── tasks/
│           ├── TASK-001.md
│           └── ...
├── src-tauri/                  # Rust 后端
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── src/
│   │   ├── main.rs             # Tauri 应用入口与 IPC 路由注册
│   │   ├── lib.rs              # 核心应用装配与 State 管理
│   │   ├── core/               # 核心类型与错误定义
│   │   │   ├── error.rs
│   │   │   └── types.rs
│   │   ├── connection/         # SSH 会话与通道管理
│   │   │   ├── manager.rs
│   │   │   ├── client_handler.rs
│   │   │   └── keepalive.rs
│   │   ├── terminal/           # PTY 会话与 Tauri Channel 绑定
│   │   │   ├── manager.rs
│   │   │   └── session.rs
│   │   ├── sftp/               # 远程文件系统操作
│   │   │   ├── service.rs
│   │   │   └── file_entry.rs
│   │   ├── transfer/           # 上传下载传输管理器
│   │   │   ├── manager.rs
│   │   │   └── worker.rs
│   │   ├── storage/            # 本地 SQLite 数据层
│   │   │   ├── db.rs
│   │   │   └── models.rs
│   │   └── security/           # 凭据与 OpenSSH 配置解析
│   │       ├── keyring.rs
│   │       └── ssh_config.rs
└── src/                        # React 前端
    ├── index.html
    ├── package.json
    ├── vite.config.ts
    ├── src/
    │   ├── main.tsx
    │   ├── App.tsx
    │   ├── api/                # Tauri IPC 包装调用
    │   │   ├── connection.ts
    │   │   ├── sftp.ts
    │   │   ├── terminal.ts
    │   │   └── storage.ts
    │   ├── stores/             # Zustand 全局状态
    │   │   ├── connectionStore.ts
    │   │   ├── projectStore.ts
    │   │   ├── fileTreeStore.ts
    │   │   ├── editorStore.ts
    │   │   ├── terminalStore.ts
    │   │   ├── transferStore.ts
    │   │   └── layoutStore.ts
    │   ├── components/
    │   │   ├── ActivityBar/
    │   │   ├── Sidebar/        # 包含 Project Explorer、Server List
    │   │   ├── Editor/         # CodeMirror 6 多 Tab 编辑区
    │   │   ├── Terminal/       # xterm.js 容器与 Tab 栏
    │   │   ├── Transfer/       # 传输浮窗/面板
    │   │   ├── StatusBar/      # 底部状态栏 (SSH 状态、编码、光标位置)
    │   │   └── Layout/         # VS Code 式 Splitter 分割拉伸容器
    │   └── utils/
    │       ├── fileIcons.ts
    │       └── keyboard.ts
```
