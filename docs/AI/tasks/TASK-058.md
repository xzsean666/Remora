# TASK-058: 代码编辑器聚焦与滚屏位置保持优化 (CodeMirror Focus & Scroll Retention)

## 1. 任务背景与目标
- **背景**: 
  1. 用户点击打开或聚焦代码编辑器时，文档会自动异常平滑滚动至正中间（整篇文档 50% 处）；
  2. 当从其他面板（终端、文件树、外部窗口等）将焦点切回文档时，又会再次回弹滚动至正中间；
  3. 根本原因在于 TASK-051 引入的移动端软键盘自动避让引擎（`src/utils/mobileKeyboard.ts`）在监听 `focusin` 时，由于 CodeMirror 6 核心编辑容器 `<div class="cm-content" contenteditable="true">` 带有 `isContentEditable`，被误识别为常规移动端表单输入框，进而对其执行了 `target.scrollIntoView({ block: "center" })`。由于 `.cm-content` 承载整篇文档高度，导致浏览器将文档中心点对齐视口中央；
  4. 此外，`CodeEditor.tsx` 原有的 `statesRef` 声明在组件内部，而外层 `EditorArea.tsx` 带有 `key={activeTab.path}`，导致每次切换 Tab 时状态被销毁重建，未能真正跨 Tab 缓存光标位置与滚动条位置。
- **目标**:
  1. 在 `mobileKeyboard.ts` 中彻底排除 CodeMirror 及其内部所有元素，杜绝外部对 CodeMirror 视口的非预期滚动干预；
  2. 实现模块级单例 `editorCache`，跨 Tab 与焦点切换持久化保存 `EditorState`（撤销历史、选区及光标位置）与视口滚动高度（`scrollTop`, `scrollLeft`）；
  3. 在 `editorStore.ts` 的 `closeTab` / `closeOtherTabs` / `closeAllTabs` 触发时自动清理对应的缓存条目，保障内存及时释放。

---

## 2. 详细设计与实现细节
1. **彻底阻断外部滚动劫持 (`src/utils/mobileKeyboard.ts`)**:
   - 在 `isEditableElement` 中增加 CodeMirror 编辑器元素的判定与排除：
     `if (el.closest(".cm-editor") || el.classList.contains("cm-content") || el.closest(".cm-scroller")) return false;`
   - 使 CodeMirror 拥有完全独立的视口与光标定位管理，杜绝任何 `block: "center"` 的居中滚动干扰。
2. **模块级状态与滚动条位置缓存 (`src/utils/editorCache.ts` & `src/components/Editor/CodeEditor.tsx`)**:
   - 提取独立的轻量缓存模块 `src/utils/editorCache.ts`，定义 `EditorCacheEntry { state: EditorState; scrollTop: number; scrollLeft: number }`；
   - 在 `CodeEditor.tsx` 初始化时优先从 `getEditorCache(tab.path)` 读取已有状态，若内容一致则复用 `EditorState`（100% 保持历史记录与光标选区），并通过 `requestAnimationFrame` 精确恢复 `view.scrollDOM.scrollTop` 与 `scrollLeft`；
   - 在组件卸载（切 Tab）前，通过 `setEditorCache` 完整记录当前视图的最新状态与滚动条偏移量。
3. **标签关闭与生命周期自愈 (`src/stores/editorStore.ts`)**:
   - 在 `closeTab(path)` 中调用 `clearEditorCache(path)`；
   - 在 `closeOtherTabs(path)` 中遍历清理其他非活动标签的缓存；
   - 在 `closeAllTabs()` 中彻底清理全部缓存，防止无用状态残留。

---

## 3. 验收标准
- [x] 点击文档任意行或内容区域，光标精准停留于点击处，视口保持稳定，绝不自动滚动到文档正中间。
- [x] 从文件树、终端、状态栏或系统外部窗口切换焦点回编辑器时，视口与光标稳定保持在原位。
- [x] 在多个打开的文件 Tab 之间来回切换时，光标位置、文字选区与垂直滚动偏移量（scrollTop）100% 保持。
- [x] 移动端普通表单输入框原有的软键盘向上避让机制不受任何影响。
- [x] 关闭标签时，对应的状态与滚动缓存自动清理释放。
- [x] `pnpm tsc --noEmit`、`pnpm build` 与 `cargo test` 100% 顺利通过。
