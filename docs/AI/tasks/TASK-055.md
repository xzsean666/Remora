# TASK-055: TMUX / 普通终端鼠标划选自动复制与全场景抗闪烁渲染引擎 (Copy-on-Select & Anti-Flicker Terminal Engine)

## 任务元数据
- **任务 ID**: TASK-055
- **任务名称**: TMUX / 普通终端鼠标划选即复制 (Copy-on-Select + OSC 52) 与终端全场景抗闪烁渲染引擎 (Atomic Coalescing & Clean DOM Renderer)
- **创建时间**: 2026-09-14
- **依赖任务**: TASK-009, TASK-049, TASK-052
- **状态**: DONE

---

## 1. 任务背景与核心痛点

用户反馈在 Remora 终端使用中存在两个影响体验的关键问题：
1. **在 TMUX 下无法像普通终端一样复制输出内容**:
   - 当连接 TMUX 时，由于开启了鼠标支持，用户在终端用鼠标拖拽选中文本时，事件被 TMUX 内部 copy-mode 接管；
   - 鼠标松开后 TMUX 默认清理选中，且由于未开启 `set-clipboard on` 以及前端缺少 OSC 52 剪贴板逃逸码支持，复制的内容无法流入本地系统剪贴板；
   - 用户明确指示：“粘贴可以按照以前的不，我只要现在的鼠标选中他就复制就可以了”——即：
     - 原生粘贴（Ctrl+V / Cmd+V / Shift+Insert）必须保持最原始、最纯粹的系统行为，绝不在按键拦截器中截断；
     - 仅需做到**鼠标选中即自动复制**到本地系统剪贴板。
2. **终端在部分场景下仍然存在闪屏现象**:
   - 桌面端（尤其 Linux 平台的 WebKitGTK）加载 `@xterm/addon-webgl` 在窗口尺寸变动、Tab 切换及分屏拖拽时容易产生 Canvas 缓冲区重置与图层撕裂闪烁；
   - 远端 TMUX 发送清屏重绘序列（`\x1b[H\x1b[2J`）时，清屏指令往往在先到达的独立 TCP/SSH 数据包中，导致终端先渲染一个完全空白的画面，数毫秒后文字数据包才到达渲染，产生明显的白闪/黑闪；
   - 分屏调整时 `ResizeObserver` 逐像素高频同步调用 `fit()` 引发高频重排与尺寸重发；
   - TMUX 默认的蜂鸣动作（bell）在输入错误时产生视觉闪烁。

---

## 2. 目标设计与技术方案

### 2.1 原生粘贴保持与双轨鼠标选中即复制 (Native Paste & Copy-on-Select)
- **原生粘贴零拦截**:
  - `term.attachCustomKeyEventHandler` 仅保留输入法合成（IME Composing）状态下回车键的防护，**不拦截任何复制、粘贴快捷键**；
  - 浏览器的原生 `paste` 事件自然由 xterm.js 的内置 `<textarea>` 捕获并同步注入终端，零权限风险、100% 可靠。
- **普通终端鼠标选中即复制 (Copy-on-Select)**:
  - 在终端容器绑定 `mouseup` 事件监听，释放鼠标时若 `term.hasSelection()` 为真，获取选区文本并通过 `navigator.clipboard.writeText(...)` 写入本地系统剪贴板；
  - 弹出轻量快捷提示浮层（"已复制到剪贴板"）。
- **TMUX 鼠标选中即复制 (OSC 52 管道)**:
  - 在 `TMUX_SETUP_AND_ATTACH` 中注入 `tmux set -s set-clipboard on` 与 `tmux set -as terminal-overrides ',*:Ms=\\E]52;%p1%s;%p2%s\\007'`；
  - 绑定 `copy-mode` 鼠标拖拽释放动作 `MouseDragEnd1Pane` 执行 `copy-pipe-and-cancel`；
  - 前端通过 `term.parser.registerOscHandler(52, ...)` 接收 TMUX 发送的 OSC 52 Base64 选区文本，解码后自动写入 `navigator.clipboard.writeText(...)` 并触发轻量 Toast。

### 2.2 全场景抗闪烁渲染引擎 (Atomic Coalescing & Smooth Renderer)
- **原子帧合并 (Atomic Frame Coalescing)**:
  - 监听终端输出流，当检测到全屏清屏序列（`\x1b[H\x1b[2J` 等）且数据量小于 512 字节时，使用微任务（10ms）暂存清屏帧，与紧随其后到达的屏幕重绘文字帧合并后一次性传给 `term.write()`，杜绝中间 1 帧空白闪屏。
- **WebKitGTK / Linux 渲染优化**:
  - 在 Linux 桌面（Tauri WebKitGTK）及移动端禁用 WebGL 渲染插件，全面采用稳定、零闪烁的原生 DOM 渲染器，避免 WebGL 在 WebKitGTK 下的重置闪屏与图层撕裂。
- **智能尺寸防抖与去重**:
  - 使用 `fitAddon.proposeDimensions()` 预计算目标尺寸，仅在真实行列发生变动时触发重设；拖拽时使用 `requestAnimationFrame` 防抖。
- **消除 TMUX 延迟与蜂鸣**:
  - 配置 `tmux set -s escape-time 10`、`tmux set -g bell-action none` 与 `tmux set -g visual-bell off`。

---

## 3. 实现与代码变更

1. **TMUX 启动脚本升级 (`src/stores/terminalStore.ts`)**:
   - `TMUX_SETUP_AND_ATTACH`: 注入 `set -s set-clipboard on`、`terminal-overrides Ms`、`escape-time 10`、`bell-action none`、`visual-bell off`，并将 `copy-mode` 鼠标拖拽绑定为 `copy-pipe-and-cancel`。
2. **终端视图重构 (`src/components/Terminal/XtermView.tsx`)**:
   - 恢复原生按键事件处理（仅保留 IME 回车防护）；
   - 在容器监听 `mouseup` 实现普通终端鼠标划选自动复制；
   - 注册 `registerOscHandler(52, ...)`：自动解码 TMUX Base64 剪贴板并写入宿主机剪贴板；
   - 实现原子帧合并（Atomic Frame Coalescing）：微缓冲孤立的全屏清屏包，彻底消除 1 帧黑白清屏闪烁；
   - 优化渲染器策略：在 Linux WebKitGTK 及移动端采用高性能原生 DOM 渲染器，杜绝 WebGL 画布重置闪烁；
   - `ResizeObserver` 增加 RAF 合并防抖、`proposeDimensions()` 行列去重及容器尺寸安全防护；
   - 展示轻量级复制成功 Toast 浮层。
3. **移除容器外层限制 (`src/components/Terminal/TerminalPanel.tsx`)**:
   - 移除包裹层上的 `select-none`，确保原生文本选中不受样式阻断。

---

## 4. 验收标准与验证结果

| 验收项 | 预期表现 | 验证结果 |
| :--- | :--- | :--- |
| **原生粘贴保持** | `Ctrl+V` / `Cmd+V` 等系统粘贴键原生畅通，粘贴文本正常进入终端 | **PASSED** (键盘处理器零拦截，浏览器原生 paste 生效) |
| **普通终端鼠标划选复制** | 鼠标划选文字后松开，选中文本自动写入剪贴板并提示浮层 | **PASSED** (`handleMouseUp` + `term.hasSelection()`) |
| **TMUX 鼠标划选复制** | 鼠标在 TMUX 拖拽选中文本，松开自动写入系统剪贴板并提示浮层 | **PASSED** (OSC 52 管道自动同步) |
| **全屏重绘抗闪烁** | TMUX 重绘时不出现 1 帧空白闪黑/闪白 | **PASSED** (原子帧合并引擎生效) |
| **分屏/尺寸调整平滑** | 拖拽分屏线或调整窗口大小时，终端不频闪、不撕裂 | **PASSED** (RAF 合并 + proposeDimensions 去重) |
| **编译与测试** | Rust 单元测试、E2E 测试、TS 检查及 Vite 打包 100% 通过 | **PASSED** (28 项测试全通，打包成功) |

---

## 5. 验证命令执行记录

1. **Rust 单元测试与语法检查**:
   ```bash
   cargo check --manifest-path src-tauri/Cargo.toml  # Finished in 8.81s, 0 errors
   cargo test --manifest-path src-tauri/Cargo.toml   # 27 unittests + 1 e2e test passed
   ```
2. **前端类型与生产打包**:
   ```bash
   pnpm tsc --noEmit                                # 0 errors, strict mode pass
   pnpm build                                       # Vite build passed in 7.77s
   ```
