# TASK-041: 移动端Tab切换终端保活、TMUX会话防退化与无感静默接入 (Mobile Tab Keep-Alive & Stealth TMUX Attach)

## 任务元数据
- **任务 ID**: TASK-041
- **任务名称**: 移动端Tab切换终端保活、TMUX会话防退化与无感静默接入 (Mobile Tab Keep-Alive & Stealth TMUX Attach)
- **创建时间**: 2026-09-10
- **依赖任务**: TASK-035, TASK-038, TASK-040
- **状态**: DONE

---

## 1. 任务背景与核心问题

用户在移动端（手机端）以及日常使用 TMUX 会话时反馈两个关键问题：
1. **手机端切换 Tab 导致 TMUX 会话丢失退化**:
   - 手机端从终端 Tab 切换到底部的“工作区”或“编辑器”Tab，然后再切回终端时，此前打开并登录好的 TMUX 会话消失了，变成了一个全新的普通 bash 终端。
   - **根本原因**: `src/App.tsx` 中对移动端 3 个 Tab（workspace, editor, terminal）使用了条件渲染 `{mobileTab === "terminal" && <TerminalPanel />}`。当用户切换到其他 Tab 时，`TerminalPanel` 及其包含的 `XtermView` 实例被彻底 unmount（卸载）。组件卸载的 cleanup 逻辑调用了 `safeInvoke("terminal_close", { sessionId })` 杀死了后端 PTY 进程。当用户再次切回终端 Tab 时，`TerminalPanel` 重新 mount，但由于 `session.pendingCommand` 在首次连接成功后已经被置为 `undefined`，重新建立连接后没有任何命令输入，直接退化为一个空的普通终端。
2. **进入 TMUX 会话时存在输入命令的闪烁与打字感**:
   - 用户在连接 TMUX 时，终端屏幕上会先闪现出远端 shell 的提示符，然后快速打出一整行 `tmux attach -d -t "xxx"` 命令并回车，之后再闪烁进入 TMUX。
   - **用户诉求**: 希望把这个命令输入阶段隐藏起来，感觉不到在输入命令，无感直接进入 TMUX 视窗。

---

## 2. 解决方案与核心架构

### 2.1 移动端多板块 Keep-Alive 存活机制
- 在 `src/App.tsx` 中，改写移动端 Tab 的挂载方式，将 Workspace、Editor、Terminal 统一改为通过 CSS `hidden`（`display: none`）控制显示隐藏。
- 移动端在工作区、编辑器、终端之间切换时，各板块组件实例持续存活：
  - 文件树展开折叠状态与滚动位置不丢；
  - 编辑器光标位置与未保存改动不丢；
  - 终端 PTY 进程持续运行、网络连接不断开、TMUX 会话持续保活。
- 在 `XtermView` 中监听 `mobileTab === "terminal"`，在重新变为可见时自动延时 50ms 触发 `fitAddon.fit()` 和 `term.focus()`，保证视口尺寸精确适配。

### 2.2 TMUX 会话一等公民与防退化闭环
- 在 `terminalStore.ts` 中加固：只要终端会话具有 `tmuxSessionName` 属性，无论在任何连接或重新连接阶段，只要 `pendingCommand` 为空，均自动保底注入 `tmux attach -d -t "${session.tmuxSessionName}"\n`。
- 杜绝任何意外 remount 或重连后退化为普通终端的可能。

### 2.3 静默无感接入 TMUX (Stealth Attach)
- 在 `XtermView` 中实现数据流静默过滤器：
  - 当会话关联 TMUX 处于接入阶段（`isAttachingTmux = true`）时，对远端 PTY 发送的数据进行拦截并缓冲；
  - 检测 tmux 启动序列（`\x1b[?1049h` Alternate Screen 开启码、`\x1b[?47h` 等），检测到后精准剥离前置无用的 shell 提示符与 `tmux attach` 回显输入，直接将 tmux 的第一帧画面写入 xterm；
  - 配套 1000ms 超时安全兜底，一旦出现远端未安装 tmux 或报错的情况，自动释放缓冲内容，绝不导致界面卡死；
  - 增加全屏深色沉浸遮罩层，在进入期间优雅显示“正在接入 TMUX 会话...”，消除任何打字命令的杂乱视觉。

---

## 3. 验收标准
1. 移动端在 TMUX 终端中切到“工作区”或“编辑器”再切回“终端”，TMUX 会话始终保持连接，不发生中断和重置。
2. 点击进入 TMUX 会话时，没有任何 `tmux attach` 命令的打字回显，平滑直接展现 TMUX 界面。
3. 超时或错误场景具备 1000ms 兜底，缓冲数据自动刷出。
4. TypeScript 类型检查 0 报错，全量单元测试与构建通过。
