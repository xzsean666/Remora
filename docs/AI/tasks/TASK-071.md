# TASK-071: 桌面端文件展示页面开关控制与 Markdown 渲染黑屏崩溃修复 (Desktop File Editor Toggle Control & Markdown Viewer Black Screen Crash Fix)

---

## 1. 任务元信息
- **Task ID**: TASK-071
- **Goal**: 桌面端文件展示页面开关控制与 Markdown 渲染黑屏崩溃修复 (Desktop File Editor Toggle Control & Markdown Viewer Black Screen Crash Fix)
- **状态**: DONE
- **依赖任务**: TASK-006, TASK-008, TASK-067
- **创建时间**: 2026-09-18
- **完成时间**: 2026-09-18

---

## 2. 需求背景与目标

在桌面端使用 Remora 时，存在两项影响使用体验与稳定性的核心痛点：
1. **文件展示页面缺少开关控制**:
   在桌面端左侧 ActivityBar，用户拥有控制文件浏览侧边栏 (`Project Explorer`) 与底部终端面板 (`Terminal`) 的开关，但中央的主文件展示页面 (`EditorArea`) 始终常驻显示，无法手动收起或隐藏。在进行深度终端操作、跑日志、构建编译或服务监控时，用户强烈希望能够收起文件展示区域，让终端占据整屏视口；而在需要查看或编辑文件时，又可以随时打开。
2. **浏览 Markdown 文件时黑屏崩溃 Bug**:
   在打开包含表格（如 `TASK_INDEX.md`、`README.md` 等）的 Markdown 文件时，界面瞬间陷入黑屏。经排查，`MarkdownViewer.tsx` 中的表格渲染器使用了 `(Marked.prototype.defaults.renderer?.table as any)?.call(this, token)`，而在 `marked@^18.0.13` 体系中 `Marked.prototype.defaults` 为 `undefined`，直接触发 `TypeError: Cannot read properties of undefined (reading 'renderer')`；且由于全局缺乏 React Error Boundary，未捕获异常导致 React 19 顶层组件完全卸载，页面直接陷入整屏黑屏崩溃。

本任务目标：
1. 彻底根除 Markdown 表格解析异常与黑屏崩溃问题，建立 `ErrorBoundary` 容灾隔离与防黑屏保护机制；
2. 在桌面端 ActivityBar 与编辑器栏实现文件展示页面（Editor Area）的自由开关控制 (`isEditorOpen`)；
3. 当文件展示收起时，终端面板自适应撑满全部主工作区高度（`flex-1`），无需手动拖拽 Splitter；
4. 当在文件树、搜索面板或 Git 视图点击打开任何文件时，系统自动拉起并恢复文件展示区域。

---

## 3. 详细设计与实现方案

### 3.1 Markdown 渲染器修复与全链路防崩溃隔离
1. **重构表格自定义渲染器**:
   - 正确从 `marked` 导出 `Renderer` 原型：
     ```ts
     import { Marked, Renderer } from "marked";
     // ...
     table(token: any) {
       let defaultTable = "";
       try {
         defaultTable = Renderer.prototype.table.call(this, token);
       } catch {
         defaultTable = "";
       }
       return `<div class="table-wrapper my-4 overflow-x-auto rounded-lg border border-vscode-border/70 shadow-xs">${defaultTable}</div>`;
     }
     ```
2. **文档解析全面防护 (`htmlContent` / `headings`)**:
   - 将 `marked.parse` 与 `marked.lexer` 包裹于全局 `try...catch` 中；
   - 对 `token.raw`、`token.text` 与 `token.tokens` 进行空安全断言与类型保护；
   - 即使传入极其畸形的数据，渲染器也能安全降级为格式化纯文本呈现，绝不抛出未捕获错误。
3. **React 19 错误边界组件 (`ErrorBoundary.tsx`)**:
   - 创建通用的文档视图错误边界，捕获任意子组件在 Render 阶段抛出的未捕获异常；
   - 包裹 `EditorArea` 中的视图层（MarkdownViewer、CodeEditor、ImageViewer、CsvViewer、ParquetViewer 等）；
   - 发生异常时渲染暗色卡片，显示清晰错误信息，并提供“重新加载”、“切换至源码编辑”与“关闭标签页”按钮，彻底根除 React 卸载导致的整屏黑屏。

### 3.2 文件展示页面自由开关与智能自适应布局
1. **状态模型扩展 (`layoutStore.ts` & `core/types.rs`)**:
   - `LayoutPreferences` 增加 `editor_visible: Option<bool>`，实现跨会话持久化（向前与向后 100% 兼容 SQLite）；
   - `layoutStore` 引入 `isEditorOpen: boolean` (默认 `true`)，并提供 `toggleEditor()` 与 `setEditorOpen(open: boolean)`。
2. **ActivityBar 左侧开发展示开关 (`ActivityBar.tsx`)**:
   - 在左侧底栏紧邻终端开关新增 `FileCode` 图标按钮；
   - 悬停提示：`Toggle File Editor / 关闭文件展示 (Ctrl+Alt+E)` 与 `打开文件展示`；
   - 状态联动：展示活跃高亮与点击切换。
3. **EditorTabBar 快捷收起按钮 (`EditorTabBar.tsx`)**:
   - 在标签栏右侧提供带有 `PanelTopClose` 图标的一键收起按钮，允许用户随手折叠文件视窗。
4. **App.tsx 视口响应式布局引擎**:
   - 当 `isEditorOpen: true` 且 `isTerminalOpen: true`: 编辑器与终端并存，Splitter 自由拖拽；
   - 当 `isEditorOpen: false` 且 `isTerminalOpen: true`: 编辑器收起，Splitter 隐藏，终端面板直接以 `flex: 1` 占满主工作区，实现极致的纯终端沉浸工作流；
   - 当两者均收起时: 呈现居中优雅提示卡片，提供“打开文件展示”与“打开终端面板”的快捷按钮；
   - 快捷键支持: 增加 `Ctrl+Alt+E` / `Cmd+Alt+E` 全局快捷键快速切换。
5. **打开文件自动唤醒 (`editorStore.ts` & `App.tsx`)**:
   - 在 `openFile` 调用入口无缝注入 `setEditorOpen(true)`；
   - 无论从文件树、全局搜索结果、Git 更改项还是最近文件点击，均自动拉起文件展示页面，体验平滑自然。

---

## 4. 验收标准
1. [x] 桌面端左侧 ActivityBar 具备独立的文件展示页面开关，支持自由切换开启与关闭；
2. [x] 在标签栏右侧具备便捷收起按钮，并支持 `Ctrl+Alt+E` 快捷键切换；
3. [x] 文件展示页面关闭时，终端面板自适应占据 100% 高度 (`flex-1`)；两者均关闭时显示居中快捷指引；
4. [x] 在文件树或搜索中点击任意文件时，文件展示页面自动重新打开；
5. [x] 含有表格、Alert、复杂代码块等任意 Markdown 文件正常渲染，无任何黑屏或控制台未捕获错误；
6. [x] 引入 `ErrorBoundary` 隔离保护，彻底阻断子组件崩溃向上传播导致的整屏黑屏；
7. [x] TypeScript `tsc --noEmit` 0 报错，`pnpm build` 成功构建，41 项 Rust 单元测试与 1 项集成测试全部通过。

---

## 5. 变更文件清单
- **新建文件**:
  - `src/components/Common/ErrorBoundary.tsx`
  - `docs/AI/tasks/TASK-071.md`
- **修改文件**:
  - `src/components/Editor/MarkdownViewer.tsx`
  - `src/components/Editor/EditorArea.tsx`
  - `src/components/Editor/EditorTabBar.tsx`
  - `src/components/ActivityBar/ActivityBar.tsx`
  - `src/stores/layoutStore.ts`
  - `src/stores/editorStore.ts`
  - `src/App.tsx`
  - `src-tauri/src/core/types.rs`
  - `src-tauri/src/storage/tests.rs`
  - `docs/AI/TASK_INDEX.md`
  - `docs/AI/SESSION_STATE.md`
