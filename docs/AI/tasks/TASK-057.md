# TASK-057: 默认下载目录重构至 ~/Downloads/Remora 与传输面板一键原生文件管理器穿透

## 1. 任务背景与目标
- **背景**: 之前远程文件树右键点击“下载”时，硬编码下载至 `/tmp/${entry.name}`，导致用户无法在本地常用下载目录中找到文件，且系统重启后 `/tmp` 易被清理；同时传输管理面板（Transfers）缺少一键唤起本地文件管理器查看已下载文件的功能。
- **目标**:
  1. 将默认下载路径统一为跨平台的 `~/Downloads/Remora`，并在执行下载时自动递归创建该文件夹；
  2. 后端提供 `open_download_dir` 与 `show_item_in_folder` 原生穿透命令；
  3. 传输面板（Transfers）顶部栏与空状态提供“打开下载目录”一键唤起按钮，已完成传输卡片提供“在文件夹中显示 / 打开位置”快捷按钮。

---

## 2. 详细设计与实现细节
1. **默认路径跨平台解析与目录自愈 (`src-tauri/src/transfer/manager.rs`)**:
   - 使用 `dirs::download_dir().or_else(|| dirs::home_dir().map(|h| h.join("Downloads"))).unwrap_or_else(|| PathBuf::from("."))` 解析平台标准下载目录；
   - 默认拼接子目录 `Remora`；
   - 在 `execute_download` 创建本地文件句柄前，自动提取父目录并执行 `tokio::fs::create_dir_all`，彻底杜绝目录不存在报错。
2. **后端 IPC 接口扩展 (`src-tauri/src/lib.rs`)**:
   - `get_default_download_dir() -> Result<String>`
   - `open_download_dir(app: AppHandle) -> Result<String>`
   - `show_item_in_folder(path: String, app: AppHandle) -> Result<()>`（优先 `reveal_item_in_dir`，回退至打开父级目录）
   - 扩展 `transfer_download` 支持 `local_path: Option<String>`，未提供时自动计算为 `~/Downloads/Remora/<filename>`。
3. **前端状态与交互 (`src/stores/transferStore.ts` & `TransferPanel.tsx`)**:
   - `transferStore` 封装 `openDownloadDir` 与 `showItemInFolder`；
   - `FileTreeNode.tsx` 移除硬编码 `/tmp`；
   - `TransferPanel.tsx` 顶部操作栏集成 `<FolderOpen />`，空状态增加醒目的“打开下载目录”按钮，下载卡片提供定位打开操作。

---

## 3. 验收标准
- [x] 远程文件下载默认存放于 `~/Downloads/Remora`。
- [x] 若目标目录不存在，下载时自动创建。
- [x] Transfers 顶部栏与卡片上可一键在系统文件管理器中打开。
- [x] `cargo test` 与 `pnpm build` 100% 顺利通过。
