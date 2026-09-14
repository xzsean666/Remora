# 当前会话状态 (SESSION_STATE.md)

本文档用于跨 Session 恢复工程上下文与进度。每次会话结束前必须更新此文件。

---

## 当前目标与任务
- **当前 Goal**: TMUX 剪贴板全链路打通 (OSC 52 + 鼠标选中即复制) 与终端全场景抗闪烁渲染引擎优化
- **当前 Task**: 
  - TASK-055: TMUX / 普通终端鼠标划选即复制 (Copy-on-Select + OSC 52) 与终端全场景抗闪烁渲染引擎 (Atomic Coalescing & Clean DOM Renderer) [DONE]
- **当前状态**: DONE (所有验收标准全部满足，28 项前后端测试 100% 通过)

---

## 2. 本次会话完成内容

1. **TMUX / 普通终端鼠标划选即复制 (TASK-055)**:
   - **根本成因与用户体验诉求**:
     1. TMUX 开启鼠标支持后，用户拖拽被 TMUX copy-mode 捕获，释放鼠标后默认清空选中；且未开启 `set-clipboard on`，复制内容无法发送到宿主机；
     2. 前端 xterm 未实现 OSC 52 协议逃逸码，即使收到剪贴板数据也直接丢弃；
     3. 用户明确要求：“粘贴可以按照以前的不，我只要现在的鼠标选中他就复制就可以了”。
   - **原生粘贴零拦截保持 (`src/components/Terminal/XtermView.tsx`)**:
     - `term.attachCustomKeyEventHandler` 彻底恢复为仅保留输入法合成（IME Composing）状态下回车键的防护，绝不拦截任何键盘粘贴或复制快捷键（如 `Ctrl+V`、`Cmd+V`、`Ctrl+Shift+V` 等）；
     - 宿主系统/浏览器的原生 `paste` 事件自然由 xterm 内置 `<textarea>` 捕获并注入终端，零权限风险、与以前表现完全一致。
   - **双轨鼠标划选即复制 (Copy-on-Select)**:
     - **普通终端会话 / TMUX+Shift**: 在终端容器监听 `mouseup` 事件，检测到 `term.hasSelection()` 时，自动读取选区文本并通过 `navigator.clipboard.writeText(...)` 写入本地系统剪贴板，并触发轻量 "已复制到剪贴板" Toast 提示；
     - **TMUX 会话**: 在 `TMUX_SETUP_AND_ATTACH` 中加入 `tmux set -s set-clipboard on` 与 `tmux set -as terminal-overrides ',*:Ms=\\E]52;%p1%s;%p2%s\\007'`，并将 `copy-mode` 拖拽释放绑定为 `copy-pipe-and-cancel`；前端注册 `term.parser.registerOscHandler(52, ...)` 安全解码 Base64 文本并写入宿主机剪贴板，同步弹出 Toast 提示。
   - **容器样式解禁 (`src/components/Terminal/TerminalPanel.tsx`)**:
     - 移除外层包裹容器上的 `select-none`，确保原生文本选中完全畅通。

2. **终端全场景抗闪烁渲染引擎 (TASK-055)**:
   - **双缓冲原子帧合并 (Atomic Frame Coalescing)**:
     - 监听输入数据流，当检测到全屏清屏序列（`\x1b[H\x1b[2J`、`\x1b[2J`、`\x1b[?1049h`）且处于独立小数据包时，使用 10ms 微任务暂存，与随后紧邻到达的屏幕重绘文字帧合并后一次性传给 `term.write()`，彻底消除“先清屏成黑底、再绘制文字”产生的 1 帧空白闪烁。
   - **Linux 桌面 WebKitGTK 渲染器优化**:
     - 识别 Linux 桌面环境与移动端，彻底停用 `@xterm/addon-webgl`，全面采用高性能原生 DOM 渲染器，根除 WebKitGTK 下 WebGL 画布重置引起的黑/白闪烁。
   - **尺寸防抖与去重**:
     - 在 `ResizeObserver` 中使用 `fitAddon.proposeDimensions()` 预计算目标行列，尺寸未变直接跳过 `fit()` 与 `term.resize`；分屏拖拽时使用 `requestAnimationFrame` 进行帧合并防抖；容器宽高未初始化时不执行 `fit()`。
   - **消除 TMUX 延迟与蜂鸣**:
     - 配置 `tmux set -s escape-time 10`、`tmux set -g bell-action none` 与 `tmux set -g visual-bell off`。

---

## 3. 修改与创建的文件
- **新建文件**:
  - `docs/AI/tasks/TASK-055.md`
- **修改文件**:
  - `src/stores/terminalStore.ts`
  - `src/components/Terminal/XtermView.tsx`
  - `src/components/Terminal/TerminalPanel.tsx`
  - `docs/AI/TASK_INDEX.md`
  - `docs/AI/SESSION_STATE.md`

---

## 4. 已运行的验证命令及结果
- `cargo check --manifest-path src-tauri/Cargo.toml`: 0 警告 / 0 错误编译通过（耗时 8.81s）。
- `cargo test --manifest-path src-tauri/Cargo.toml`: 27 个单元测试 + 1 个 E2E 集成测试全量 100% 通过（耗时 0.01s）。
- `pnpm tsc --noEmit`: 前端 TypeScript 严格检查 0 报错。
- `pnpm build`: Vite 前端生产打包顺利通过（7.77s，0 语法/类型错误）。

---

## 5. 承诺与约束说明
- **严格遵循用户指示**:
  1. 粘贴键完全保留以前原生方式，不拦截任何粘贴快捷键；
  2. 仅实现鼠标选中即自动复制；
  3. 本地 Release 构建与 Actions 发布完全交由用户自己执行，AI 代理不执行 `./build.sh`。
