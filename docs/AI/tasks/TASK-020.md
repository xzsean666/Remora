# TASK-020: 修复集成终端中文/CJK 输入法重复与多次输入缺陷 (Fix Integrated Terminal Chinese/CJK IME Duplicate and Repeated Input Defect)

## Objective
优化 Remora 集成终端（基于 xterm.js）的中文及 CJK 输入法体验，彻底根除在终端中输入中文时连续输入 2 遍以及多次重复累积输入（“有时候还输入很多”）的问题，同时保障英文打字、连击、按键长按自动重复、快捷键及剪贴板粘贴零副作用。

## Scope
- 修改 `src/components/Terminal/XtermView.tsx`：
  - 挂载 `term.attachCustomKeyEventHandler`，在 `event.isComposing` 期间拦截回车确认键，防止误触发终端 `\r`。
  - 监听 `term.textarea` 的 `compositionstart`、`compositionupdate`、`compositionend`，维护精确的 IME 生命周期。
  - 在合成结束后微任务延时清空 `textarea.value = ''`，彻底消灭历史残留累积引发的雪崩式重复差量与多次输入。
  - 在 `term.onData` 中实现针对 IME 合成窗口的高精度去重守卫（仅在合成期及结束 150ms 内针对 `< 100ms` 的相同 CJK/合成字符进行去重阻断），非合成期完全直通。
  - 将原生 `invoke` 替换为 `safeInvoke`，提升 Web 预览与自动化测试鲁棒性。
- 修改 `src/utils/tauriBridge.ts`：
  - 在 `safeInvoke` 中支持 `terminal_open`、`terminal_write`、`terminal_resize`、`terminal_close` 的优雅 Mock 适配。
  - 提供 `window.__TAURI_INTERNALS__` 的浏览器安全 Polyfill，保障 Tauri 2 Channel 跨环境运行无异常。
- 修改 `src/components/Terminal/TerminalPanel.tsx`：
  - 优化空状态按钮条件判断，统一使用 `effectiveServerId`。
- 自动化测试与验证：
  - 编写 Playwright 端到端仿真脚本对中文输入法单次提交、多次连续提交、连击、回车及长按等场景进行仿真与断言。
  - 执行 `pnpm tsc --noEmit`、`cargo test`、`pnpm build`。

## Allowed Files
- `src/components/Terminal/XtermView.tsx`
- `src/components/Terminal/TerminalPanel.tsx`
- `src/utils/tauriBridge.ts`
- `docs/AI/tasks/TASK-020.md`
- `docs/AI/TASK_INDEX.md`
- `docs/AI/SESSION_STATE.md`

## Dependencies
- 前置依赖: TASK-009, TASK-019

## Acceptance Criteria
1. 中文输入法提交单字或词组时仅发送一次，绝不重复发送 2 遍。
2. 多次连续输入不同或相同中文词组时，历史输入内容绝不重新累积带出。
3. 英文快速打字（如连续按 `ll`、`ss`）正常发送，不被误拦截。
4. 键盘长按自动重复（如 Backspace）平滑连发。
5. 输入法状态下按 Enter 确认拼音不会提前执行终端命令。
6. 前端类型检查与打包完全通过，无任何编译及运行错误。

## Status
DONE

## Verification Results
- `pnpm tsc --noEmit`: 成功通过，0 错误 0 告警。
- `pnpm build`: 成功通过，前端产物打包完成。
- `cargo test --manifest-path src-tauri/Cargo.toml`: 成功通过，17 组测试（16 单元测试 + 1 端到端测试）100% 全部通过。
- Playwright 端到端真实浏览器仿真测试（`test_terminal_ime.py`）：
  - 成功捕获真实 XtermView 组件输入流：`['你好', '世界', '测试', 'h', 'e', 'l', 'l', 'o', 'pinyin']`
  - 验证“你好”、“世界”、“测试”均精准出现 1 次，重复率 0%；
  - 验证英文双写（`hello` 中的两个连续 `l`）完整保留；
  - 验证合成期 Enter 键仅提交拼音文本，无意外 `\r` 触发；
  - 验证 `textarea` 内部历史残留被彻底清空（`finalTextareaValue: ""`）；
  - 全流程 0 控制台错误。
