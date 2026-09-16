# TASK-065: 远程目录粘贴剪贴板图片与本地文件支持 (Remote Folder Clipboard Image & File Paste Support)

## 1. 任务信息
- **ID**: TASK-065
- **状态**: DONE
- **目标**: 在远程文件管理器 (Project Explorer) 中支持直接粘贴剪贴板中的图片（如系统截图、浏览器复制图片、Base64 Data URL）或本地文件到指定远程目录，支持右键菜单“粘贴”与 `Ctrl+V` / `Cmd+V` 快捷键，提供 VS Code 级别的智能命名递增与冲突处理。

---

## 2. 背景与核心痛点
1. **缺少粘贴操作入口**: 文件树右键上下文菜单 (`ContextMenu`) 仅有新建、重命名、复制路径等，无“粘贴 (Paste)”项；
2. **缺乏图片二进制写入能力**: 原后端 SFTP 接口仅提供 `sftp_write_file` (UTF-8 文本) 与 `sftp_read_binary_file` (二进制读)，无法直接通过 Base64 将图片二进制数据无损写入远程文件；
3. **快捷键未感知文件树焦点**: 在文件树区域按 `Ctrl+V` 无响应，且需注意不能干扰代码编辑器、集成终端与普通文本输入框内的常规文本粘贴。

---

## 3. 核心实现策略
1. **Rust 后端原子写入与自动重连**:
   - 在 `src-tauri/src/sftp/service.rs` 中实现 `write_binary_file`，利用 `BASE64_STANDARD.decode` 解码并将原始字节写入远程文件；
   - 在 `src-tauri/src/lib.rs` 中暴露 `sftp_write_binary_file` Tauri 命令，并在连接异常时自动断线重连重试；
   - 在 `src-tauri/src/sftp/tests.rs` 中添加 Base64 解码与 PNG 魔数验证单元测试。
2. **前端与系统剪贴板多源提取引擎 (Native + Web Fallback)**:
   - 引入 Rust `arboard` (跨平台系统剪贴板访问) 与 `png` 编码器，实现 Tauri 命令 `read_clipboard_image_native`，突破 Webview 沙箱/权限限制，完美支持从 Slack、微信、系统截屏工具、Chrome 复制的原生位图；
   - 在 `src/utils/clipboard.ts` 封装 `readNativeClipboardImage`、`readClipboardImage`、`blobToBase64` 与 `getImageExtension`；
   - 优先通过原生后端命令提取 OS 剪贴板图像，未找到时降级至原生 `ClipboardEvent` 与 Web `navigator.clipboard.read()`；
   - 支持系统截图 Blob、复制的本地文件（带 `path` 走上传、纯内存走二进制写入）、Base64 Data URL 及文件 URL；
   - 增加防并发重入与时间戳去抖机制，防止 `keydown` 与 `paste` 双重触发。
3. **VS Code 级智能命名与冲突处理**:
   - 针对无名/通用截图自动命名为 `image.png`，若已存在自动递增为 `image-1.png`、`image-2.png`，不打断用户工作流；
   - 针对具名文件同名冲突无缝复用 `FileConflictModal` 弹窗（替换 / 重命名 / 取消）。
4. **右键菜单与快捷键联动**:
   - 在 `ContextMenu.tsx` 中增加带 `ClipboardPaste` 图标与 `Ctrl+V` 徽标的“粘贴 (Paste)”项；
   - 在 `FileTreeNode.tsx` 与 `ProjectExplorer.tsx` 根目录中透传目标路径；
   - 全局监听 `Ctrl+V` / `Cmd+V` 与 `paste` 事件，避让输入框、CodeMirror 与终端，精准解析当前选中目标目录；
   - 粘贴完成后自动展开目标目录、刷新文件列表、高亮选中新图片并弹出轻量 Toast。

---

## 4. 验收标准
- [x] 后端 `sftp_write_binary_file` 实现并具备自动重连能力；
- [x] 后端集成 `arboard` + `png` 实现 `read_clipboard_image_native`，原生支持 Slack 等外部桌面客户端复制的图片；
- [x] 剪贴板图片（Slack / 微信 / 截图或复制的图片）在文件夹右键菜单点击“粘贴”能正确存为远程图片；
- [x] 在文件树区域按 `Ctrl+V` / `Cmd+V` 能够将剪贴板图片粘贴到当前选中目录或根目录；
- [x] 截图多张连续粘贴自动生成 `image.png`、`image-1.png`、`image-2.png`，不打断用户；
- [x] 粘贴完成后目标文件夹自动展开、树节点刷新并显示新图片；
- [x] 代码编辑器、终端与普通输入框的输入和粘贴行为 100% 正常不受干扰；
- [x] `pnpm tsc --noEmit` 0 报错，`cargo test` 36 项测试全量通过，`pnpm build` 构建成功。
