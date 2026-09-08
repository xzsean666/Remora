# TASK-008: CodeMirror 6 代码编辑、多 Tab 缓存与 Ctrl+S 保存

## Objective
在 React 前端集成基于 CodeMirror 6 的代码编辑器与多 Tab 标签页管理系统 (`EditorArea`)，支持单/双击标签切换、未保存 Dirty 标记、`Ctrl + S` 快捷键安全保存至远程 SFTP、远端 mtime 冲突检测提示以及断网本地 Buffer 保护。

## Scope
- 创建 `editorStore.ts`（Zustand）：
  - Tab 数据模型：`EditorTab { path: string; name: string; content: string; savedContent: string; mtime: number; isDirty: boolean; isPreview: boolean; cursor?: { line: number; ch: number } }`
  - 状态：`tabs: EditorTab[]`, `activeTabPath: string | null`
  - 方法：`openFile(path, isPreview)`, `closeTab(path)`, `setActiveTab(path)`, `updateContent(path, content)`, `saveActiveFile()`, `markSaved(path, newMtime)`
- 集成 CodeMirror 6：
  - 基础扩展：行号 (`lineNumbers`), 语法折叠 (`foldGutter`), 高亮活动行 (`highlightActiveLine`), 历史撤销 (`history`), 快捷键绑定 (`defaultKeymap`, `historyKeymap`), 深色主题 (`oneDark`)
  - 快捷键扩展：绑定 `Mod-s` (Ctrl+S / Cmd+S) 触发文件保存
- 实现 TabBar 容器：
  - 标签栏展示：文件名、图标、Dirty 圆点指示、关闭按钮 (`x`)
  - 单击切换 Tab，中键点击关闭 Tab
  - Preview Tab 机制：单击文件树为预览 Tab（斜体），双击转为常驻 Tab
- 保存与冲突检测机制：
  - 调用 `sftp_write_file(serverId, path, content, expected_mtime)`
  - 若触发 Conflict 报错，提示用户并提供覆盖或放弃选项
- 在 `App.tsx` 中将编辑器挂载至主区域

## Allowed Files
- `src/stores/editorStore.ts`
- `src/components/Editor/**/*`
- `src/App.tsx`
- `docs/AI/tasks/TASK-008.md`

## Dependencies
- 前置依赖: TASK-004 (SFTP 核心文件服务就绪), TASK-006 (多面板布局系统就绪)

## Inputs and Outputs
- **Inputs**: 远程文件内容、用户编辑键盘事件、`Ctrl + S` 快捷键
- **Outputs**: 具备多 Tab 缓存、语法高亮与防覆盖安全保存的代码编辑器

## Acceptance Criteria
1. 从文件树双击或单击文件可在编辑区打开对应 Tab 并显示代码内容。
2. 内容变动时正确呈现 Dirty 状态圆点指示。
3. 按下 `Ctrl + S` 成功调用 SFTP 保存并清除 Dirty 标记、更新 mtime。
4. 多 Tab 之间切换内容与光标保持独立缓存。
5. 前端 `pnpm run build` 成功，类型检查无错误。

## Verification Commands
```bash
pnpm run build
```

## Risks and Assumptions
- 风险: 大文件加载卡顿；CodeMirror 6 纯模块化设计已针对超长文件渲染进行了 DOM 复用优化。

## Status
DONE

## Verification Results
- `pnpm run build`: Succeeded with code 0 without any type or bundling errors.
- `cargo test`: 8 passed, 0 failed.
- Editor tabs, Dirty indicator, CodeMirror 6 with oneDark theme and keyboard shortcuts, and conflict modal successfully integrated.
