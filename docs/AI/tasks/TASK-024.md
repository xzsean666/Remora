# TASK-024: 远端服务器安全删除回收站机制与代码编辑器语法高亮美化

---

## 1. 任务背景与目标

用户在实际开发过程中提出两个关键诉求：
1. **删除文件是否有回收站功能**：此前版本在 Project Explorer 中删除文件时，右键点击 Delete 直接调用底层 SFTP 物理删除，不仅没有任何二次防误触确认，且远程服务器完全没有回收站机制，一旦误删无法找回；对于非空文件夹更是因为底层 SFTP 直接调用 `remove_dir` 而报错删除失败。
2. **读文件代码美化（拒绝纯黑白）**：此前 CodeMirror 6 编辑器仅配置了基本主题样式，缺少具体的编程语言语法解析器，导致无论打开 Rust、TypeScript、Python、JSON 还是 Markdown、Shell 脚本，全部呈现为灰白单色，阅读体验欠佳。

本任务目标：
- **远端服务器回收站机制与安全删除**：
  - 后端在 `SftpService` 中实现安全移入回收站功能 `trash`：遵循 Linux 官方 FreeDesktop XDG Trash 规范，自动解析远端用户主目录，将目标移至 `~/.local/share/Trash/files`，支持时间戳防同名覆盖，并生成标准 `[Trash Info]` 元数据，支持跨挂载点 fallback 容灾。
  - 增强 `remove` 实现：针对目录实现递归遍历删除，彻底修复非空目录删除报错缺陷。
  - 前端打造 VS Code 风格的安全删除确认弹窗 (`DeleteConfirmModal`)，默认推荐“移至回收站”，并提供“永久删除”与“取消”选项。
- **编辑器多语言语法高亮与阅读美化**：
  - 引入 `@codemirror/language-data` 动态语言支持体系，按需动态加载 140+ 种编程语言语法解析器。
  - 配合 One Dark 主题色彩（关键字高亮紫、字符串绿、函数蓝、数值橙、注释灰等），告别纯黑白，呈现现代化 IDE 代码阅读体验。
  - 状态栏右侧动态联动当前激活文件的编程语言类型指示（如 Rust, TypeScript, Python, JSON, Markdown 等）。

---

## 2. 详细技术方案

### 2.1 远端服务器回收站 (FreeDesktop XDG Trash)
- **路径解析**: 调用 `sftp.canonicalize(".")` 精准解析远端用户 Home 根目录，构建标准路径：
  - 文件区: `<home>/.local/share/Trash/files`
  - 元数据区: `<home>/.local/share/Trash/info`
- **自动递归建目录**: `ensure_remote_dir_recursive` 逐级校验并创建必要目录结构。
- **重名时间戳消歧**: 若回收站已存在同名项，通过 `<stem>_<YYYYMMDD_HHMMSS>.<ext>` 自动重命名，保障多版本不覆盖。
- **元数据记录**: 生成规范的 `.trashinfo` 文件：
  ```ini
  [Trash Info]
  Path=<original_path>
  DeletionDate=<iso_timestamp>
  ```
- **容灾 Fallback**: 若因跨磁盘分区或权限问题导致移动至 Home 失败，自动在当前目录父级创建 `.remora_trash` 接收，确保数据不丢失。
- **递归物理删除修复**: `remove_remote_dir_recursive` 采用深度优先后序遍历，递归清空所有子文件与子目录后再删除目录本体。

### 2.2 前端删除确认与交互 (DeleteConfirmModal)
- 在 `useFileTreeStore` 状态中增加 `deleteTarget: { path, name, isDir }` 与 `requestDelete`, `cancelDelete`, `confirmDelete`。
- 用户在文件树节点点击“Delete”或按快捷键时，调起 `DeleteConfirmModal`。
- 弹窗直观展示待删除项的名称、类型和完整路径，给出清晰的操作说明：
  - **移至回收站 (推荐/默认)**: 调用 `sftp_trash`，文件随时可在终端或文件系统中恢复。
  - **永久删除**: 调用 `sftp_remove`，彻底抹除。
  - **取消**: 关闭弹窗，无任何副作用。支持 Escape 取消与 Enter 默认移至回收站。

### 2.3 编辑器语法高亮与状态栏指示
- 引入 `@codemirror/language-data`：
  - 利用 `LanguageDescription.matchFilename(languages, tab.path)` 智能识别文件扩展名与特殊文件（如 `Cargo.toml`, `Dockerfile`, `.env` 等）。
  - 利用 `Compartment` 实现语言模块异步按需加载，Vite 自动将 100+ 语言进行 Code Splitting，不增加主包体积。
  - 接入 `oneDarkHighlightStyle`，提供鲜艳对比度的专业着色。
- 状态栏联动：在 `StatusBar.tsx` 动态响应当前激活标签页的语言名称，右侧展示语言标识 Badge（如 `TypeScript`, `Rust`, `JSON`, `Python` 等）。

---

## 3. 验收标准

1. 用户右键点击任意文件或目录的“Delete”菜单时，弹出 `DeleteConfirmModal` 确认框，不再直接无预警删除。
2. 点击“移至回收站”后，文件被移动到远程服务器的 `~/.local/share/Trash/files`，同名文件附带时间戳防冲撞，并在终端中能够找回。
3. 点击“永久删除”时，文件被彻底删除；对于包含多层子文件和文件夹的非空目录，能够完整递归删除且不报错。
4. 打开不同编程语言文件（如 `.rs`, `.ts`, `.py`, `.json`, `.md`, `.sh`, `.yaml`, `.html` 等）时，文本具备鲜明专业的语法高亮着色，告别纯黑白文本。
5. 底部状态栏能够准确显示当前打开文件的语言名称。
6. 后端 21 组单元测试 + 1 组 e2e 测试通过，前端 TypeScript 检查与打包编译全部通过。

---

## 4. 状态与验证结果

- **状态**: **DONE**
- **验证结果**:
  - `cargo check --manifest-path src-tauri/Cargo.toml`: 0 错误 0 告警通过。
  - `cargo test --manifest-path src-tauri/Cargo.toml`: 21 项单元测试 + 1 项 e2e 测试全部 100% 通过（新增回收站元数据格式化与重名时间戳处理测试）。
  - `pnpm tsc --noEmit`: 前端 TypeScript 类型检查 0 报错通过。
  - `pnpm build`: Vite 生产打包通过，各语言按需动态分包产物正常生成。
