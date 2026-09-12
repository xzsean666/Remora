# TASK-044: TMUX 工作路径自动继承与终端鼠标滚轮日志输出平滑滚动修复 (TMUX Working Dir Inheritance & Terminal Mouse Wheel Scroll Fix)

## 任务元数据
- **任务 ID**: TASK-044
- **任务名称**: TMUX 工作路径自动继承与终端鼠标滚轮日志输出平滑滚动修复 (TMUX Working Dir Inheritance & Terminal Mouse Wheel Scroll Fix)
- **创建时间**: 2026-09-12
- **依赖任务**: TASK-009, TASK-031, TASK-033, TASK-041
- **状态**: DONE

---

## 1. 任务背景与核心问题

1. **新建/接入 TMUX 时丢失当前终端路径 (Issue 2)**:
   - 用户在终端中进入了特定工作目录（如 `/ssd0/project/xxx`），此时打开 TMUX 管理弹窗并新建或接入会话，TMUX 默认总是在远程用户的 home 目录（`~`）下启动，未能继承当前已在浏览的目录。
2. **在 TMUX 中使用 AI CLI (如 `agya`) 滚轮翻页变成滚动历史输入词 (Issue 4)**:
   - 当用户在 TMUX 会话中运行类似 `agya` 的交互式 AI CLI 时，用户希望向上滑动鼠标中键来浏览滚动的历史输出。
   - 然而在 TMUX 环境下，鼠标中键滚轮不仅没有滚动屏幕历史，反而导致 CLI 输入框内的文本不断快速切换变动（翻动历史输入记录）。
   - **根本原因**:
     - 现代 CLI 多运行于 VT100 备用屏幕（Alternate Screen 缓冲区）。xterm.js 在 alternate screen 模式下，如果当前程序未开启鼠标报告协议（mouse tracking），默认行为是将鼠标滚轮事件转译为 `\e[A`（Up 箭头）和 `\e[B`（Down 箭头）按键序列发送给 PTY。
     - CLI 程序（如 `agya` / Python readline / Prompt Toolkit）接收到上/下箭头按键，会执行“切换历史输入词”操作；
     - 此外，TMUX 默认情况下未开启 `set -g mouse on`，不会截获并处理终端仿真器的鼠标滚轮事件进入 copy-mode 滚动浏览。

---

## 2. 解决方案与核心实现

### 2.1 动态捕获当前终端路径并在 TMUX 中自动带入
- **动态路径探测**:
  - 在 [XtermView.tsx](file:///ssd0/git/Remora/src/components/Terminal/XtermView.tsx) 中监听 `term.onTitleChange`，自动解析主流 Linux shell（如 Bash/Zsh 常见的 `user@host: dir` 或纯路径格式）上报的 OSC 动态标题，提炼出实时工作路径并存入 `session.currentDir`。
  - 在 [terminalStore.ts](file:///ssd0/git/Remora/src/stores/terminalStore.ts) 中增加 `currentDir` 与 `updateSessionCurrentDir` 状态字段。
- **后端支持指定目录启动 TMUX**:
  - 在 [src-tauri/src/lib.rs](file:///ssd0/git/Remora/src-tauri/src/lib.rs) 的 `tmux_new_session` 指令中，支持可选的 `initial_dir: Option<String>`。若存在路径，则通过 `tmux new-session -d -s "..." -c "<safe_path>"` 创建会话，直接锁定目标目录。
- **前端弹窗交互呈现**:
  - 在 [TmuxManagerModal.tsx](file:///ssd0/git/Remora/src/components/Terminal/TmuxManagerModal.tsx) 中自动展示当前活动终端检测到的路径；支持一键修改、清空或确认，并在创建会话及直接进入时全链路透传。

### 2.2 根治 TMUX 鼠标滚轮滚历史命令、实现平滑日志翻页
- **TMUX 原生鼠标滚轮与 Copy-Mode 支持**:
  - 在 [src-tauri/src/lib.rs](file:///ssd0/git/Remora/src-tauri/src/lib.rs) 的 `tmux_new_session` 中，追加 `\; set -g mouse on` 配置。
  - 在 [terminalStore.ts](file:///ssd0/git/Remora/src/stores/terminalStore.ts) 的 `pendingCommand` 接入指令中，统一注入 `tmux set -g mouse on 2>/dev/null; tmux attach -d -t "..."\n`。这使得 TMUX 本身接管滚轮事件，无论何时滑动中键滚轮，TMUX 都会自动进入 copy-mode 并上下滚动历史终端回滚区，与普通终端滚动体验完全一致。
- **xterm.js 备用屏滚轮箭头转译拦截 (兜底保障)**:
  - 在 [XtermView.tsx](file:///ssd0/git/Remora/src/components/Terminal/XtermView.tsx) 中挂载 `term.attachCustomWheelEventHandler`。
  - 当终端处于备用屏幕且未启用鼠标跟踪时，如果发生滚轮滑动，主动拦截并消费滚轮事件，阻止其向 PTY 发送 `\e[A` / `\e[B` 箭头控制码，彻底绝收 AI CLI 历史命令被意外循环触发的现象。

---

## 3. 验收标准
1. 在已切换目录的终端中打开 TMUX 管理器，能够自动识别并预填当前路径；新建的会话初始目录与当前终端一致。
2. 在 TMUX 会话中运行 CLI 工具，向上或向下滑动鼠标滚轮时，能够上下浏览滚动的终端日志，绝不触发历史命令回滚。
3. 后端 Rust 单元测试通过，前端编译 0 报错。
