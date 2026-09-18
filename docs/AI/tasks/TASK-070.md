# TASK-070: 远端文件浏览文件夹打包下载与 .gitignore 规则过滤支持 (Remote Folder Archive Download with .gitignore Rule Exclusion)

---

## 1. 任务元信息
- **Task ID**: TASK-070
- **Goal**: 远端文件浏览文件夹打包下载与 .gitignore 规则忽略支持 (Remote Folder Archive Download with .gitignore Rule Exclusion)
- **状态**: DONE
- **依赖任务**: TASK-004, TASK-007, TASK-010, TASK-047, TASK-057
- **创建时间**: 2026-09-18
- **完成时间**: 2026-09-18

---

## 2. 需求背景与目标

在远程开发中，用户经常需要将整个项目或指定文件夹下载到本地进行备份、离线分析或分享。当前 Remora 的 Project Explorer 仅支持单文件下载，对文件夹禁用下载功能；而且直接下载文件夹不仅在 SFTP 树形遍历上耗时长、效率低，还会不可避免地将庞大的构建产物和缓存目录（如 `node_modules/`、`target/`、日志文件等）一并下载，导致网络堵塞和本地磁盘浪费。

本任务目标：
1. 在文件浏览器上下文菜单中为文件夹及工作区根目录提供“Download Folder (打包下载)”入口；
2. 远端自适应识别 `.gitignore` 规则：优先利用 Git 引擎（`git ls-files --cached --others --exclude-standard`）精确剔除被 `.gitignore` 排除的文件并打包；脱离 Git 时使用 GNU tar `--exclude-vcs-ignores` 及常见模式兜底；
3. 打包解压后保持规范目录结构（带顶级文件夹名包裹），产物保存为标准 `.tar.gz`；
4. 流式下载到本地默认下载目录 `~/Downloads/Remora`，支持重名防覆盖自动递增；
5. 深度融入 `TransferManager` 传输中心，实时展示进度条与速度；
6. 传输完成或取消后，远端临时归档自动执行 `rm -f` 清理，零磁盘垃圾残留。

---

## 3. 详细设计与实现方案

### 3.1 远端自适应打包引擎与 Base64 参数安全传递
在 `TransferManager` 中，远程打包脚本使用 Base64 编码路径，防止空格和引号注入：
- 检查目标目录是否处于 Git 工作区 (`git -C "$DIR" rev-parse --is-inside-work-tree`)；
- 若处于 Git 工作区，执行：
  ```bash
  git -C "$DIR" ls-files -z --cached --others --exclude-standard | \
    tar -czf "$ARCHIVE" -C "$DIR" --null -T - --transform "s,^,$SAFE_FOLDER_NAME/,"
  ```
  该命令能够 100% 遵守 `.gitignore` 规则，天然过滤 `.git/` 仓库自身目录，且完整保留 modified 文件与新建的 untracked 未忽略文件；
- 若非 Git 仓库，检测并使用 GNU tar `--exclude-vcs-ignores --exclude-vcs`，自动读取目录中的 `.gitignore` 文件；
- 兜底使用常见排除规则（`--exclude='.git' --exclude='node_modules' --exclude='target'` 等）。

### 3.2 传输状态流转与远端垃圾清理
1. `TransferItem` 初始化：`direction: Download`, `filename: "<folder>.tar.gz"`, `status: Pending`;
2. 打包阶段：异步调用 SSH exec 执行打包，获取打包后实际字节数并更新 `total_bytes`，状态转为 `Transferring`;
3. 下载阶段：基于 SFTP 流式传输至本地，每 100ms 驱动进度和传输速率广播；
4. 完成/中止清理：无论成功完成、用户手动取消或中途异常，均自动向远端发送 `rm -f "$ARCHIVE"` 清理临时归档。

### 3.3 前端右键菜单与交互体验
- `ContextMenu.tsx`: 当右键目录时展示 `Download Folder (打包下载)`，使用 `Archive` 图标；
- `FileTreeNode.tsx`: 支持目录右键触发 `downloadFolder`；
- `ProjectExplorer.tsx`: 工作区根目录空白处或右键菜单支持全工作区一键打包下载；
- `transferStore.ts` & `tauriBridge.ts`: 导出 `downloadFolder` 并在 TransferPanel 实时可视化。

---

## 4. 验收标准
1. [x] 文件浏览器右键文件夹展示 `Download Folder (打包下载)` 菜单项；
2. [x] 触发后远端完成打包，并流式下载至 `~/Downloads/Remora/<folder>.tar.gz`；
3. [x] 严格排除 `.gitignore` 中忽略的文件与构建目录（如 `node_modules`、日志文件等）；
4. [x] 打包产物带根目录名，解压后目录结构完整；
5. [x] 传输管理器中展示任务状态、百分比进度与传输速率；
6. [x] 本地同名文件自动递增防覆盖；
7. [x] 远端临时文件无残留，自动清理完成；
8. [x] TypeScript 0 错误，前端构建成功，Rust 单元测试全部通过。

---

## 5. 验证命令与测试记录
- **TypeScript 静态检查**:
  `pnpm exec tsc --noEmit` -> 0 错误
- **前端打包编译**:
  `pnpm build` -> `✓ built in 11.73s`
- **Rust 后端全量测试**:
  `cargo test` -> 41 个单元测试全部 PASS，1 个 E2E 全流程测试 PASS（0 failed）
- **打包与排除规则验证**:
  验证包含 `.gitignore` 规则的目录（`*.log`、`node_modules/`、`dist/`），打包生成的 tar.gz 成功精准排除忽略文件，未被忽略的文件与子目录正常保留。
