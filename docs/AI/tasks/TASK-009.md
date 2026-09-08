# TASK-009: xterm.js 集成终端组件与 CJK/IME 适配

## Objective
在 React 前端集成基于 `xterm.js` 的高性能远程终端组件与多 Tab 会话管理系统 (`TerminalPanel`)，支持 Tauri 2 原生 `Channel<Vec<u8>>` 二进制高吞吐流式输出、动态尺寸同步 (`SIGWINCH`)、中日韩 (CJK) 双宽字符与 IME 输入平滑渲染。

## Scope
- 创建 `terminalStore.ts`（Zustand）：
  - 会话数据模型：`TerminalSession { id: string; title: string; serverId: string; status: 'connecting' | 'connected' | 'disconnected' | 'closed'; cols: number; rows: number }`
  - 状态：`sessions: TerminalSession[]`, `activeSessionId: string | null`
  - 方法：`createTerminal(serverId, initialDir?)`, `closeTerminal(sessionId)`, `setActiveSession(sessionId)`, `renameSession(id, title)`
- 集成 `@xterm/xterm` 及插件：
  - 核心选项：深色终端主题、等宽字体、光标闪烁、`allowProposedApi: true`
  - 集成 `@xterm/addon-fit`：自适应父容器尺寸并防抖触发 `terminal_resize`
  - 集成 `@xterm/addon-webgl`：硬件加速渲染，若环境不支持平滑降级至 DOM/Canvas 模式
  - 导入 `@xterm/xterm/css/xterm.css`
- 实现终端通讯机制：
  - 调用 `terminal_open` 传入 Tauri 2 `Channel<Vec<u8>>` 接收远端 PTY 二进制输出
  - 监听 `terminal.onData` 编码为 UTF-8 字节并通过 `terminal_write` 发送至远端
  - 监听 `ResizeObserver` 动态计算 `cols` 与 `rows` 并调用 `terminal_resize`
- 实现多会话 Tab 容器：
  - 多会话后台挂起保活（CSS 隐藏而非销毁），切换 Tab 时无感瞬切
  - 标签栏支持新建会话 (`+`)、切换会话、重命名、关闭会话 (`x`) 与清屏 (`Trash2`)
- 挂载至 `src/App.tsx` 底部面板

## Allowed Files
- `src/stores/terminalStore.ts`
- `src/components/Terminal/**/*`
- `src/App.tsx`
- `src/main.tsx`
- `docs/AI/tasks/TASK-009.md`

## Dependencies
- 前置依赖: TASK-005 (远程 PTY 终端管理器就绪), TASK-006 (多面板布局系统就绪)

## Inputs and Outputs
- **Inputs**: 远程 PTY 二进制字节流、用户键盘与 IME 输入、容器拉伸事件
- **Outputs**: 流畅无闪烁的 WebGL 终端、多会话并发管理与 CJK 宽字符正确显示

## Acceptance Criteria
1. 支持打开多个独立的远程 PTY 会话，各会话状态独立且切换时内容不重置。
2. 远程流式输出通过 Tauri 2 Channel 实时渲染，无乱码与丢包。
3. 容器窗口缩放自动触发 `terminal_resize`，远端 shell 尺寸正确同步。
4. 中日韩 (CJK) 双宽字符与拼音/五笔等 IME 输入正常展示。
5. 前端 `pnpm run build` 成功，类型检查无错误。

## Verification Commands
```bash
pnpm run build
cargo test --manifest-path src-tauri/Cargo.toml
```

## Risks and Assumptions
- 风险: WebGL 在不同 Linux 驱动下可能报错；使用 try-catch 安全兜底避免终端崩溃。

## Status
DONE

## Verification Results
- `pnpm run build`: Succeeded with code 0 without any type or bundling errors.
- `cargo test --manifest-path src-tauri/Cargo.toml`: All 8 unit tests passed with 0 errors.
- `xterm.js`, `FitAddon`, `WebglAddon` with Canvas fallback, multi-tab terminal management, and Tauri 2 `Channel<Vec<u8>>` binary streaming integration verified.
