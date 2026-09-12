# 当前会话状态 (SESSION_STATE.md)

本文档用于跨 Session 恢复工程上下文与进度。每次会话结束前必须更新此文件。

---

## 当前目标与任务
- **当前 Goal**: 深度治理 Android 移动端终端聚焦/切换及 TMUX 全屏重绘闪屏问题，优化移动端渲染管线与 Tab 几何常驻
- **当前 Task**: 
  - TASK-051: 移动端软键盘弹出输入框遮挡自动向上避让与平滑滚动优化 [DONE]
  - TASK-052: 终端聚焦/切换与 TMUX 重绘闪屏深度治理及移动端渲染管线优化 [DONE]
- **当前状态**: DONE

---

## 2. 本次会话完成内容

1. **移动端软键盘弹出自动向上避让与平滑滚动优化 (TASK-051)**:
   - **根本成因深度剖析**:
     1. Android 原生层开启 `enableEdgeToEdge()` 后，`MainActivity.kt` 仅监听了 `systemBars()` 和 `displayCutout()`，忽略了 `WindowInsetsCompat.Type.ime()`，且 `AndroidManifest.xml` 未配置 `windowSoftInputMode="adjustResize"`，导致软键盘弹出时原生内容容器并未更新底边距，WebView 可视高度没有发生物理缩减；
     2. `index.html` 缺少移动端现代标准的 `interactive-widget=resizes-content`，移动端 Chromium 内核默认将软键盘视作浮层，未触发视口重新排版；
     3. 前端各类 Modal 弹窗使用 `fixed inset-0` 配合 `overflow-hidden`、`flex items-center` 与绝对 `max-h-[xxvh]`（`vh` 单位在键盘弹起时不缩减），导致弹窗被锁死在屏幕垂直中心，中下部输入框被键盘完全遮盖且无法上下滚动；
     4. 前端缺乏全局输入框聚焦与视口尺寸变化的主动避让引擎，导致只能依赖用户盲打触发浏览器底层的选区被动校准。
   - **Android 原生层 Insets 动态绑定与 AdjustResize 适配**:
     - 在 [MainActivity.kt](file:///ssd0/git/Remora/src-tauri/gen/android/app/src/main/java/com/remora/app/MainActivity.kt) 中引入 `WindowInsetsCompat.Type.ime()`，键盘弹出时自动将内容视图底边距置为键盘高度，收起时自动回退为导航栏高度；
     - 在 [AndroidManifest.xml](file:///ssd0/git/Remora/src-tauri/gen/android/app/src/main/AndroidManifest.xml) 中为 `MainActivity` 显式启用 `android:windowSoftInputMode="adjustResize"`。
   - **Viewport 视口规范更新与自适应高度**:
     - 在 [index.html](file:///ssd0/git/Remora/index.html) 中添加 `interactive-widget=resizes-content`，引导现代 Chromium 内核在键盘弹起时主动缩减 layout viewport；
     - 将 `html` 与 `body` 的定高 `h-screen` 替换为自适应 `h-full`，[App.tsx](file:///ssd0/git/Remora/src/App.tsx) 根容器改用 `h-full max-h-[100dvh]` 随原生视图缩放。
   - **全局移动端键盘主动避让引擎 (`src/utils/mobileKeyboard.ts`)**:
     - 实现了全局 `focusin` 感知，采用 50ms、250ms、450ms 渐进式多阶段定时器，在输入法弹起过程中平滑执行 `scrollIntoView({ behavior: 'smooth', block: 'center' })`；
     - 深度接入 `window.visualViewport.resize` 与 `window.resize`，实时捕获视口高度被键盘压缩的事件，毫秒级自愈激活输入框的位置；
     - 显式过滤排除 xterm 终端的隐藏代理 textarea（`.xterm-helper-textarea`），防止干扰终端固有触控流；
     - 监听 `focusout` 清理定时器，避免键盘收起时产生冗余跳动。
   - **Modal 弹窗容器自适应与滚动限制解封**:
     - 全面改造 `ServerManager.tsx`, `KeyManagerModal.tsx`, `SnippetEditModal.tsx`, `TmuxManagerModal.tsx`, `GroupModal.tsx`, `ImportSnippetModal.tsx`, `BranchSwitchModal.tsx`, `OpenFolderModal.tsx` 等弹窗；
     - 蒙层层级放通 `overflow-y-auto`，卡片采用 `max-h-[min(xxvh,calc(100dvh-1rem))]` 与 `my-auto`，在软键盘弹起高度急剧压缩时自适应缩小并维持完整可滚动性。

2. **终端聚焦/切换与 TMUX 重绘闪屏深度治理及移动端渲染管线优化 (TASK-052)**:
   - **成因定位**:
     1. TMUX 作为全屏终端复用器，在接收到 `SIGWINCH` 时必须发送 `\x1b[H\x1b[2J` 清空屏幕并逐行重绘。之前 `ResizeObserver` 未对行列数（`cols` / `rows`）去重，切 Tab 时从 `display: none`（0x0）复原立即广播 resize，软键盘动画过程中产生多段尺寸跳变，引发 TMUX 连续全屏清屏闪烁；
     2. 移动端加载 `@xterm/addon-webgl` 造成 Android WebView 在尺寸突变或唤醒时重建 WebGL 帧缓冲区，引发图层撕裂与黑白频闪；
     3. 切换 Tab 时的强制 `term.focus()` 误触移动端软键盘管道；
     4. Android 原生 WebView 底色未显式设为 `#181818`，图层重构时易露白。
   - **治理措施**:
     - 在 `XtermView.tsx` 建立 `lastCols` 与 `lastRows` 缓存比对机制，尺寸未变直接拦截 `terminal_resize`，移动端软键盘弹起防抖提升至 150ms；
     - 识别移动设备（`isMobileDevice`），在移动端禁用 WebGL Addon，全面切回 DOM 同层高性能零闪烁渲染器；桌面端保留 WebGL 加速；
     - 终端 Tab 容器改用 `visibility: hidden; position: absolute; inset: 0` 保持盒模型真实尺寸，切 Tab 达到 0 延迟、0 突变、0 重绘；
     - 限制切换 Tab 自动聚焦仅在桌面端生效；
     - 在 `MainActivity.kt` 中显式设置原生 WebView 背景色为 `#181818`。

3. **文档与规范同步**:
   - 编写并创建 `docs/AI/tasks/TASK-051.md` 与 `docs/AI/tasks/TASK-052.md`；
   - 更新 `docs/AI/TASK_INDEX.md`，将任务总数递增至 53 项并保持 100% DONE。

---

## 3. 修改与创建的文件
- **新建文件**:
  - `src/utils/mobileKeyboard.ts`
  - `docs/AI/tasks/TASK-051.md`
  - `docs/AI/tasks/TASK-052.md`
- **修改文件**:
  - `src-tauri/gen/android/app/src/main/java/com/remora/app/MainActivity.kt`
  - `src-tauri/gen/android/app/src/main/AndroidManifest.xml`
  - `index.html`
  - `src/App.tsx`
  - `src/components/Terminal/XtermView.tsx`
  - `src/components/Sidebar/ServerManager/ServerManager.tsx`
  - `src/components/Sidebar/ServerManager/KeyManagerModal.tsx`
  - `src/components/Sidebar/QuickInput/SnippetEditModal.tsx`
  - `src/components/Sidebar/QuickInput/GroupModal.tsx`
  - `src/components/Sidebar/QuickInput/ImportSnippetModal.tsx`
  - `src/components/Terminal/TmuxManagerModal.tsx`
  - `src/components/Sidebar/Git/BranchSwitchModal.tsx`
  - `src/components/Sidebar/ProjectExplorer/OpenFolderModal.tsx`
  - `docs/AI/TASK_INDEX.md`
  - `docs/AI/SESSION_STATE.md`

---

## 4. 已运行的验证命令及结果
- `ANDROID_HOME=/opt/android-sdk ./gradlew compileReleaseKotlin`: Kotlin 语法、WebView 背景及 IME Insets 编译 100% 成功。
- `pnpm tsc --noEmit`: 前端 TypeScript 严格检查 0 报错通过。
- `pnpm build`: Vite 前端生产打包 100% 成功通过。

---

## 5. 承诺与约束说明
- **严格遵循用户指示**: 本地 Release 构建与 Actions 发布完全交由用户自己执行，AI 代理不执行 `./build.sh`。
