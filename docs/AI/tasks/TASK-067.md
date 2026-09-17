# TASK-067: IDE 默认 Markdown 富文本阅读渲染与源码/分屏编辑模式支持 (Default Markdown Reader View & Source/Split Edit Modes)

## 1. 任务信息
- **ID**: TASK-067
- **状态**: DONE
- **目标**: 完善 Remora 远程代码编辑器的 Markdown 浏览与编辑生态，默认以高品质富文本阅读视图打开 Markdown 文件，支持 GitHub 风格 Alert 提示块、语法高亮代码块、一键复制、GFM 表格、任务清单与浮动大纲目录；同时提供一键切换的源码编辑模式（CodeMirror 6）与桌面端双向分屏实时预览模式。

---

## 2. 背景与核心诉求
1. **默认阅读需求**: 用户在远程项目浏览和查阅文档（如 `README.md`、开发规范、任务说明等）时，原先作为纯代码打开，呈现为单调的等宽源码与行号，缺乏标题层级、格式化排版和可读性；
2. **高端渲染展示**: Markdown 富文本排版需与 IDE 的 VS Code 深色暗色主题无缝融合，提供清晰的标题锚点、GitHub Alert 徽标卡片（`> [!NOTE]`, `> [!TIP]` 等）、带语言标签与一键复制代码块、表格自适应滚动、任务复选框及大纲目录（TOC）；
3. **编辑模式无缝切换**: 具备快速进入源码编辑模式的能力，支持基于 CodeMirror 6 的语法高亮与快捷键保存，并提供桌面端实时双向分屏对照编辑（左侧编辑，右侧实时更新）。

---

## 3. 核心技术实现

1. **扩展文件类型与模式状态机 (`editorStore.ts` & `tauriBridge.ts`)**:
   - 在 `tauriBridge.ts` 增加 `isMarkdownFilePath` 检测工具，支持 `.md`、`.markdown`、`.mdown`、`.mkd` 等扩展名；
   - 在 `editorStore.ts` 将 `EditorTab.fileType` 扩展为 `"text" | "image" | "markdown"`；
   - 视图模式 `viewMode` 扩展为 `"preview" | "source" | "split"`；
   - 在 `openFile` 打开 Markdown 文件时，默认赋予 `viewMode: "preview"`（若携带跳转定位 `targetPosition` 则自适应进入 `"source"`）；
   - 暴露 `setMarkdownViewMode` 与 `toggleMarkdownViewMode`。

2. **高品质 Markdown 富文本渲染器 (`MarkdownViewer.tsx`)**:
   - 采用轻量且强大的 `marked` (v18) 解析引擎与 `highlight.js` (v11) 代码高亮库；
   - **GitHub Alerts 提示块**：自动识别 `> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`, `> [!WARNING]`, `> [!CAUTION]` 并渲染为带专用色彩边框、背景及精致 SVG 图标的提示卡片；
   - **代码块语法高亮与一键复制**：顶栏显示语言标签 Badge（如 `TYPESCRIPT`、`RUST`、`BASH`），提供浮层一键复制按钮与 "Copied!" 状态交互反馈；
   - **GFM 表格**：自适应包裹在横向滚动容器中，支持表头深色强调与隔行斑马纹；
   - **锚点标题与浮动大纲目录 (TOC)**：解析 Markdown 中 H1-H3 标题，提供可一键折叠的大纲抽屉侧栏，点击平滑滚动定位至对应标题；
   - **文档指标微状态栏**：计算中英文字数、行数及预估阅读时间；
   - **外部链接安全拦截**：自动调用 `@tauri-apps/plugin-opener` 或系统默认浏览器打开外部网页。

3. **三模合一编辑与分屏体系 (`EditorArea.tsx`)**:
   - Markdown 文件激活时显示顶栏模式切换胶囊：`📖 阅读`、`✏️ 编辑`、`◫ 分屏`；
   - 支持全局快捷键 `Ctrl+E` / `Cmd+E` 及 `Ctrl+Shift+V` 随时快速切换阅读与编辑；
   - 分屏模式下左侧为 CodeMirror 6 源码编辑，右侧为实时渲染预览；
   - 在 `MarkdownViewer` 引入 60ms 防抖更新机制，确保在分屏高速输入时 CodeMirror 保持 60fps 丝滑输入体验；
   - 保存机制（`Ctrl+S` 与顶部保存按钮）在编辑模式与分屏模式下无缝工作，更新远程 SFTP。

---

## 4. 验收标准
- [x] 打开任何 `.md` 文件默认以富文本阅读视图呈现，而非等宽纯文本；
- [x] 富文本排版优良，完整支持标题层级、GFM 表格、任务复选框、引用块、代码块语法高亮与复制代码按钮；
- [x] 支持 GitHub 风格 Alert 提示块（`[!NOTE]`, `[!TIP]`, `[!WARNING]` 等）；
- [x] 支持浮动大纲目录 (TOC)，可直达对应标题锚点；
- [x] 提供顶栏模式切换器，可一键切换至编辑模式，使用 CodeMirror 6 修改并 `Ctrl+S` 保存至远程；
- [x] 桌面端支持分屏对照模式，左侧修改右侧实时更新；
- [x] 支持 `Ctrl+E` / `Cmd+E` 快捷键切换模式；
- [x] TypeScript 类型校验零报错，Vite 前端构建 100% 成功，Cargo 测试全量通过。
