# TASK-049: 移动端 TMUX 触控滑动手势滚屏支持与惯性动量优化 (Mobile TMUX Touch Gesture Scrolling & Momentum Physics)

## 任务元数据
- **任务 ID**: TASK-049
- **任务名称**: 移动端 TMUX 触控滑动手势滚屏支持与惯性动量优化 (Mobile TMUX Touch Gesture Scrolling & Momentum Physics)
- **创建时间**: 2026-09-12
- **依赖任务**: TASK-009, TASK-041, TASK-044, TASK-046
- **状态**: DONE

---

## 1. 任务背景与核心问题

在手机端或移动设备通过 Remora 访问远程集成终端时，当终端接入 TMUX 会话后，用户无法通过在屏幕上手指上下滑动来浏览历史命令行输出（无任何滑动反应）：
1. **xterm.js 原生底层逻辑限制**:
   - 当终端接入开启鼠标报告模式（Mouse Tracking）的应用（例如 TMUX 启用 `set -g mouse on`，或者 vim、htop）时，xterm.js 底层的 `coreMouseService.areMouseEventsActive` 为 `true`。
   - xterm.js 在 `touchstart` 和 `touchmove` 事件中显式判断了 `if (!this.coreMouseService.areMouseEventsActive) return this.viewport.handleTouchStart(e)`。
   - 因此，当鼠标追踪激活时，xterm.js 完全关闭了内部触摸滚动逻辑，并且没有为触摸滑动合成任何鼠标滚轮事件（Mouse Wheel）。
2. **移动端手势与滚轮事件割裂**:
   - 手机触摸屏滑动仅产生 `touchstart`, `touchmove`, `touchend` 事件，浏览器不会在非可滚动 DOM 区域触发 `wheel` 事件。
   - TMUX 的屏幕缓冲区完全由自身接管，仅响应 SGR 鼠标滚轮转义序列（`\x1b[<64;col;rowM` 向上滚轮进入 copy-mode，`\x1b[<65;col;rowM` 向下滚轮退出 copy-mode）。
   - 导致普通 Bash 会话在手机端可以轻微滑动，而一旦进入 TMUX 便彻底“焊死”，无法通过单指手势上下翻阅终端历史。

---

## 2. 解决方案与核心架构

### 2.1 XtermView 移动端触控手势映射引擎
- 在 [XtermView.tsx](file:///ssd0/git/Remora/src/components/Terminal/XtermView.tsx) 中实现专用的移动端触控转轮映射系统：
  1. **手势意图精准判别**:
     - 监听 `touchstart` 捕获单指起点 `(touchStartX, touchStartY)`；
     - 在 `touchmove` 中，当垂直移动距离 `|deltaY| > 6px` 且垂直距离大于水平距离时锁定为垂直滚动，并立即调用 `e.preventDefault()` 阻止移动端浏览器的下拉刷新与弹性拉伸；若检测为水平滑动则不予拦截，保持对移动端标签页手势的兼容。
  2. **像素累积与多步滚轮序列派发**:
     - 按照手指拖拽位移换算为终端滚轮脉冲（每 ~20px 对应 1 次滚轮脉冲）：
       - 手指**向下滑动**（拉出上方历史） -> 映射为滚轮向上 `Wheel UP` (`deltaY = -100`) -> TMUX 触发 `WheelUpPane` 进入 copy-mode 并滚动；
       - 手指**向上滑动**（推上去查看底部 Prompt） -> 映射为滚轮向下 `Wheel DOWN` (`deltaY = 100`) -> TMUX 触发 `WheelDownPane` 向下滚动并在到底后退出 copy-mode。
     - 动态派发包含触摸坐标的合成 `WheelEvent`，由 xterm.js 捕获并自动经由 `coreMouseService` 编译为标准的 SGR 鼠标序列发送给后端 TMUX。
  3. **指数衰减惯性物理滚动 (Momentum Scrolling)**:
     - 实时通过 EMA 滤波器统计滑动释放速度 `touchVelocity`；
     - 在 `touchend` 时若速度超过阈值（`> 0.35 px/ms`），通过 `requestAnimationFrame` 驱动动量衰减循环（`decay = 0.91`），让终端手势获得原生 App 般的流畅滑行体验。
  4. **容器触控属性优化**:
     - 在终端外层容器添加 `touchAction: "none"` 及 Tailwind `touch-none` 类，彻底规避 WebView/浏览器层级的手势抢夺。

### 2.2 TMUX 滚轮与服务端环境调优
- 在 [terminalStore.ts](file:///ssd0/git/Remora/src/stores/terminalStore.ts) 的 `TMUX_SETUP_AND_ATTACH` 中注入即时滚轮响应配置：
  - `tmux bind -n WheelUpPane if-shell -F -t = "#{mouse_any_flag}" "send-keys -M" "if -Ft= '#{pane_in_mode}' 'send-keys -M' 'copy-mode -e; send-keys -M'"`
  - `tmux bind -n WheelDownPane if-shell -F -t = "#{mouse_any_flag}" "send-keys -M" "if -Ft= '#{pane_in_mode}' 'send-keys -M' ''"`
  - 首个滚轮事件即可立即进入 copy-mode 并完成位移，消除原版 tmux 需要两次滚轮才滚动的顿挫感。
- 在宿主机创建全局 `/root/.tmux.conf` 并将 `mouse on` 与瞬时滚轮绑定持久化，确保无论是 Remora 还是 Termius、JuiceSSH 等移动 SSH 工具直连 tmux，都能直接生效。

### 2.3 移动端辅助快捷栏增强
- 在 [TerminalMobileBar.tsx](file:///ssd0/git/Remora/src/components/Terminal/TerminalMobileBar.tsx) 的虚拟按键中追加高亮键：
  - `PgUp`（`\x1b[5~`）：支持一键单手向上翻整页历史；
  - `PgDn`（`\x1b[6~`）：支持一键单手向下翻整页历史。

---

## 3. 验收与验证结果
1. **TypeScript 检查**: `pnpm tsc --noEmit` 严格校验 0 错误通过。
2. **前端打包构建**: `pnpm build` (vite) 打包构建通过。
3. **后端测试套件**: `cargo test --manifest-path src-tauri/Cargo.toml` 26 项单元测试与 1 项 e2e 测试 100% 通过。
4. **TMUX 配置验证**: `tmux source-file /root/.tmux.conf` 成功对全部运行中的 tmux 会话生效。
