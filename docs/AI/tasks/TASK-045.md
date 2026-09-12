# TASK-045: VS Code 风格轻量级 Git 可视化与分支切换管理系统 (VS Code Style Lightweight Git Visualization & Branch Management)

## 任务元数据
- **任务 ID**: TASK-045
- **任务名称**: VS Code 风格轻量级 Git 可视化与分支切换管理系统 (VS Code Style Lightweight Git Visualization & Branch Management)
- **创建时间**: 2026-09-12
- **依赖任务**: TASK-003, TASK-004, TASK-006, TASK-008
- **状态**: DONE

---

## 1. 任务背景与核心问题

用户希望在 Remora 中实现类似 VS Code 的 Git 可视化核心功能：
1. 能够清晰查看当前远程工作区中的 Git 改动文件列表（未跟踪、已修改、已暂存、已删除等状态）；
2. 能够便捷查看改动文件的 Diff 差异对比；
3. 能够查看当前所在分支，并支持在弹窗中选择、搜索、切换已有分支或基于当前分支创建新分支；
4. 兼顾桌面端与移动端交互，保持轻量级无侵入设计（不引入笨重服务端依赖，仅依托 SSH 命令行执行）。

---

## 2. 解决方案与核心架构

### 2.1 后端轻量级复合 Git 远程通道
- 在 [src-tauri/src/lib.rs](file:///ssd0/git/Remora/src-tauri/src/lib.rs) 中实现 3 个一站式 Tauri 指令：
  - `git_get_status(server_id, repo_path)`: 复合执行 `git rev-parse --is-inside-work-tree` 快速判别 Git 仓库；若为仓库则执行 `git symbolic-ref --short HEAD` / `git rev-parse --short HEAD` 获取分支名，`git branch --list` 获取本地分支，以及 `git status --porcelain -uall` 批量提取改动文件列表并解析为结构化数据：
    - `path`: 相对路径
    - `index_status` / `work_tree_status`: 状态码（M/A/D/R/C/? 等）
    - `staged`: 是否暂存
  - `git_checkout(server_id, repo_path, branch, create_new)`: 安全执行 `git checkout [-b] <branch>` 实现分支切换与创建。
  - `git_get_diff(server_id, repo_path, file_path, staged)`: 运行 `git diff [--staged] -- <file_path>` 获取标准 unified diff。

### 2.2 前端 Git 全局状态与多端联动
- 在 [gitStore.ts](file:///ssd0/git/Remora/src/stores/gitStore.ts) 中建立 `useGitStore`：
  - 管理当前分支、分支列表、修改文件数、文件改动列表、加载状态与选中的 Diff 结果；
  - 提供 `refreshGitStatus`、`switchBranch`、`fetchDiff` 等响应式方法。
- 在 [ActivityBar.tsx](file:///ssd0/git/Remora/src/components/ActivityBar/ActivityBar.tsx) 中：
  - 增加标准的 VS Code 风格 `Source Control`（Git）侧边栏入口，带有实时改动文件数量蓝色角标（Badge）。
- 在 [StatusBar.tsx](file:///ssd0/git/Remora/src/components/StatusBar/StatusBar.tsx) 中：
  - 状态栏左侧显示当前分支名（`git-branch` 图标）及改动文件数；点击分支名可直接唤出分支切换选择弹窗。

### 2.3 VS Code 风格侧边栏 Git 面板与 Diff 视窗
- 在 [GitPanel.tsx](file:///ssd0/git/Remora/src/components/Sidebar/Git/GitPanel.tsx) 中：
  - 呈现 Source Control 面板头部（分支指示、一键刷新按钮）；
  - 将改动分为 `Changes` 区域，每个条目带有状态颜色与标签（`M` 黄色修改、`U` 绿色未跟踪、`D` 红色删除等）；
  - 悬停操作：点击条目直接在编辑器打开该文件；点击“Diff”图标唤起对比弹窗；
  - 内置精美 Unified Diff 视窗，使用绿色与红色行内高亮清晰展示增删改动行，支持代码滚动浏览。
- 在 [BranchSwitchModal.tsx](file:///ssd0/git/Remora/src/components/Sidebar/Git/BranchSwitchModal.tsx) 中：
  - 实现命令面板（Quick Open）风格的分支切换弹窗；
  - 实时搜索过滤本地分支；
  - 带有“从当前 HEAD 创建新分支”快捷动作；
  - 分支切换成功后自动刷新工作区文件树与 Git 状态。

---

## 3. 验收标准
1. 在远程 Git 仓库中打开工作区，ActivityBar 显示 Source Control 图标及改动文件徽标；StatusBar 显示当前分支名。
2. 侧边栏 Git 面板完整展示所有改动文件及工作区/暂存区状态，支持点击打开文件和查看 Diff 差异高亮。
3. 支持点击分支名弹窗快速搜索切换分支及创建新分支。
4. 在手机端与桌面端均适配良好；前后端编译与测试 100% 通过。
