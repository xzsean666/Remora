# TASK-051: 移动端软键盘弹出输入框遮挡自动向上避让与平滑滚动优化 (Mobile Virtual Keyboard Avoidance & Input Auto-Scroll Adjustment)

## 任务元数据
- **任务 ID**: TASK-051
- **任务名称**: 移动端软键盘弹出输入框遮挡自动向上避让与平滑滚动优化 (Mobile Virtual Keyboard Avoidance & Input Auto-Scroll Adjustment)
- **创建时间**: 2026-09-12
- **依赖任务**: TASK-028, TASK-029, TASK-030, TASK-049, TASK-050
- **状态**: DONE

---

## 1. 任务背景与核心痛点

在 Remora Android 移动端应用使用过程中，用户在点击各类输入框（如服务器添加/编辑表单、私钥配置、TMUX 新建会话、快捷命令编辑等）时遇到了明显的输入遮盖缺陷：
1. **键盘弹出直接遮盖输入框**:
   - 移动端点击输入框后，Android 系统调出虚拟软键盘（IME）。
   - 处于屏幕中下半部分的输入框被弹出的软键盘直接覆盖遮挡，用户无法看见当前聚焦的输入字段与光标。
2. **必须盲打字符才发生位置调整**:
   - 只有当用户盲打至少一个字符时，Chromium 浏览器的文本光标校准机制才被动触发，将页面强行向上推移。
   - 用户体验不直观，极其影响在移动端进行 SSH 服务器添加、密码输入或配置管理的效率。
3. **根本成因定位**:
   - **Android 原生层 Insets 缺失**: [MainActivity.kt](file:///ssd0/git/Remora/src-tauri/gen/android/app/src/main/java/com/remora/app/MainActivity.kt) 中开启了 `enableEdgeToEdge()`，但 `setOnApplyWindowInsetsListener` 仅监听了 `systemBars()` 与 `displayCutout()`，漏掉了 `WindowInsetsCompat.Type.ime()`，导致系统键盘弹起时原生内容容器（`android.R.id.content`）的底边距未被更新，WebView 视口没有物理缩减；
   - **Manifest 模式未声明**: [AndroidManifest.xml](file:///ssd0/git/Remora/src-tauri/gen/android/app/src/main/AndroidManifest.xml) 未显式配置 `android:windowSoftInputMode="adjustResize"`；
   - **Viewport 视口规范更新缺失**: [index.html](file:///ssd0/git/Remora/index.html) 的 `<meta name="viewport">` 缺少现代移动端标准的 `interactive-widget=resizes-content`，导致 Chromium 默认采用 overlays/visual 模式，未重排 layout viewport；
   - **前端弹窗定高与遮罩限制**: 各类 Modal 弹窗使用 `fixed inset-0` 搭配 `overflow-hidden`、`flex items-center` 与绝对 `max-h-[xxvh]`（`vh` 单位在软键盘弹出时不缩小），导致居中的弹窗下方输入框被完全盖在键盘下方且无法滚动；
   - **前端缺少主动聚焦滚动避让引擎**: 前端缺乏全局输入框聚焦（`focusin`）与视口尺寸变化（`visualViewport.resize`）的主动平滑避让驱动，未能做到“软键盘一弹起，立即向上居中”。

---

## 2. 解决方案与实施步骤

### 2.1 Android 原生层软键盘 Insets 与 Resize 联动
- 在 [src-tauri/gen/android/app/src/main/java/com/remora/app/MainActivity.kt](file:///ssd0/git/Remora/src-tauri/gen/android/app/src/main/java/com/remora/app/MainActivity.kt) 的 `WindowInsetsCompat.Type` 中添加 `or WindowInsetsCompat.Type.ime()`：
  - 当软键盘弹起时，`insets.bottom` 动态获取软键盘像素高度；
  - `view.updatePadding(...)` 自动将底边距增至软键盘高度，使 Tauri WebView 的可用绘制空间实时收缩在软键盘之上；
  - 当软键盘收起时，`insets.bottom` 自动恢复至系统导航栏安全边距。
- 在 [src-tauri/gen/android/app/src/main/AndroidManifest.xml](file:///ssd0/git/Remora/src-tauri/gen/android/app/src/main/AndroidManifest.xml) 的 `MainActivity` 节点中显式增加 `android:windowSoftInputMode="adjustResize"`。

### 2.2 Viewport 视口与自适应高度规范
- 在 [index.html](file:///ssd0/git/Remora/index.html) 的 `<meta name="viewport">` 中加入 `interactive-widget=resizes-content`，指引移动端 Chromium 内核在键盘弹起时主动缩减 layout viewport。
- 将 `html` 与 `body` 的固定 `h-screen`（100vh）优化为 `h-full` 自适应高度，配合根容器灵活响应视口物理变化。

### 2.3 全局移动端键盘主动避让与平滑滚动引擎 (`src/utils/mobileKeyboard.ts`)
- 创建专用工具库 `mobileKeyboard.ts` 并集成至 [src/App.tsx](file:///ssd0/git/Remora/src/App.tsx)：
  - **聚焦感知（`focusin`）**: 用户点击任何 `<input>`、`<textarea>` 或 `isContentEditable` 元素时，使用多段渐进式定时器（50ms, 250ms, 450ms）平滑执行 `target.scrollIntoView({ behavior: 'smooth', block: 'center' })`；
  - **视口变化（`window.visualViewport.resize` & `window.resize`）**: 监听视口高度因软键盘出现而收缩的事件，毫秒级触发当前活动输入框向上平滑调整居中；
  - **终端排除保护**: 显式跳过 xterm.js 内部辅助的隐藏 textarea（`.xterm-helper-textarea`），杜绝干扰终端已有渲染与触控；
  - **失焦清理（`focusout`）**: 输入框失焦时清理未决定时器，避免页面意外跳动。

### 2.4 Modal 弹窗自适应与动态视口响应优化
- 针对主要 Modal 容器（`ServerManager.tsx`, `KeyManagerModal.tsx`, `SnippetEditModal.tsx`, `TmuxManagerModal.tsx`, `GroupModal.tsx`, `ImportSnippetModal.tsx`, `BranchSwitchModal.tsx`, `OpenFolderModal.tsx` 等）：
  - 蒙层容器添加 `overflow-y-auto`，消除在软键盘弹出时外层阻断滚动的限制；
  - 弹窗卡片应用 `max-h-[min(xxvh,calc(100dvh-1rem))]` 与 `my-auto`，在键盘弹出压缩可用空间时自适应缩小并居中可见，确保内部滚动容器无论如何都能将激活项展示在屏幕开阔区。

---

## 3. 验收标准与验证结果
1. 手机端点击任何表单输入框（包括服务器添加/编辑、私钥管理、快捷命令编辑、TMUX 新建等），输入法弹出瞬间，输入框自动向上平滑调整至可视区域中央，不再被输入法软键盘遮挡 [已满足]。
2. 无需等待用户输入任何字符，在输入法弹起的同时（或聚焦 50ms~300ms 期间）即完成避让定位 [已满足]。
3. 软键盘收起后，界面恢复原样，无布局错乱或白屏残影 [已满足]。
4. `ANDROID_HOME=/opt/android-sdk ./gradlew compileReleaseKotlin` 编译 100% 成功 [通过]。
5. `pnpm tsc --noEmit` 前端 TypeScript 严格检查 0 报错通过 [通过]。
6. `pnpm build` 完整生产打包 100% 通过 [通过]。

