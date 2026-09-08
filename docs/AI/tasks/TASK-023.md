# TASK-023: 目录文件拖拽上传交互根治、同名冲突检测与替换/重命名弹窗处理

---

## 1. 任务背景与目标

当前版本在文件拖拽交互上存在关键缺陷：
1. **拖拽无响应**: 用户从操作系统本地文件管理器（如 Nautilus、Windows 资源管理器）或应用内部将文件拖入 Project Explorer 的目录时，界面没有任何高亮感应和事件处理（“直接没有反应”）。
2. **缺少同名冲突检测与提示**: 当拖拽的文件在目标目录已存在同名项时，缺少冲突拦截机制，未提供用户期望的“替换”、“重命名”或“取消”选择流程。

本任务目标：
- 接入 Tauri 2 Webview 原生拖拽事件监听 (`onDragDropEvent`) 与 HTML5 拖拽兼容层，实现精准的目标目录解析（文件夹节点、文件父级、根工作区）。
- 实现鼠标悬停目标目录时的即时视觉高亮反馈。
- 实现拖拽放下的同名文件冲突探测与拦截机制。
- 打造标准优雅的冲突处理弹窗 (`FileConflictModal`)，支持“替换 (Replace)”、“重命名 (Rename，可自定义新文件名或自动递增编号)”与“取消 (Cancel)”。
- 支持无缝启动后台分块传输 (`uploadFile`) 并自动刷新受影响目录。

---

## 2. 详细技术方案

### 2.1 目标目录坐标命中与高亮感应
- 在 `FileTreeNode.tsx` 中为目录节点附加 `data-folder-path={entry.path}`，文件节点附加 `data-parent-path={parentPath}`。
- 在 `ProjectExplorer.tsx` 容器附加 `data-explorer-container="true"`。
- 在 `ProjectExplorer` 挂载 `getCurrentWebview().onDragDropEvent`：
  - `enter` / `over`: 将物理坐标 `position` 依据 `window.devicePixelRatio` 换算为 CSS 视口逻辑坐标。通过 `document.elementFromPoint` 检索命中元素，递归匹配最近的 `[data-folder-path]` 或 `[data-explorer-container]`。
  - 将命中的目标路径设置到状态 `dropTargetDir`，目标文件夹显示 `bg-vscode-selected/30 ring-1 ring-vscode-activityBarActive` 边框高亮。
  - `leave` / `drop`: 清理高亮。

### 2.2 冲突检测与处理队列
- 拖拽放下时获取文件本地路径数组 `paths: string[]`。
- 对每个文件，提取其基本文件名 `filename`，目标路径为 `${targetDir}/${filename}`。
- 调用 `checkFileExists(serverId, targetPath)`（结合 `sftp_stat` 与内存缓存树）检查是否已存在。
- 若不存在冲突，直接推入上传队列：调用 `uploadFile(serverId, localPath, targetPath)`，上传完成后调用 `refreshPath(targetDir)`。
- 若存在同名冲突，暂停该项上传并推入 `conflictQueue`，激活 `FileConflictModal`。

### 2.3 冲突处理模态框 (FileConflictModal)
- 弹窗展示当前冲突文件名称与目标目录。
- 自动计算并填入建议的新文件名（如 `filename (1).ext` 或 `filename_copy.ext`），用户可直接修改输入框内容。
- 三个操作按钮：
  - **替换 (Replace)**: 覆盖远端同名文件，执行上传。
  - **重命名 (Rename)**: 采用输入框中的新文件名上传。
  - **取消 (Cancel)**: 跳过该文件。
- 处理完成后自动进入队列下一项或关闭弹窗，并刷新目标目录。

---

## 3. 验收标准

1. 用户从本地拖拽文件到 ProjectExplorer 中的任意子文件夹时，该文件夹出现清晰的高亮感应框。
2. 释放鼠标后，不存在同名冲突的文件立即开始后台流式上传，目录自动刷新展示。
3. 存在同名文件时，弹出 `FileConflictModal`，点击“替换”能够覆盖原有文件，点击“重命名”可以自定义名称并保存为新文件，点击“取消”正常取消。
4. `cargo check`, `cargo test`, `pnpm tsc --noEmit`, `pnpm build` 全部通过。

---

## 4. 状态与验证结果

- **状态**: **DONE**
- **验证结果**:
  - `cargo check --manifest-path src-tauri/Cargo.toml`: 检查通过，0 错误 0 告警。
  - `cargo test --manifest-path src-tauri/Cargo.toml`: 运行 19 个单元测试与 1 个 e2e 测试全部 100% 通过（新增目录上传与不存在本地文件用例测试）。
  - `pnpm tsc --noEmit`: 前端 TypeScript 类型检查 0 报错通过。
  - `pnpm build`: Vite 生产打包通过，产物正常生成。
  - `suggestNewName` 冲突自增重命名算法验证通过。
