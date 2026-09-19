# TASK-073: Source Control 远程状态感知与待推送/待拉取提交可视化管理 (Source Control Remote Sync Status & Ahead/Behind Commits Visualization)

---

## 1. 任务元信息
- **Task ID**: TASK-073
- **Goal**: Source Control 远程状态感知与待推送/待拉取提交可视化管理 (Source Control Remote Sync Status & Ahead/Behind Commits Visualization)
- **状态**: DONE
- **依赖任务**: TASK-045, TASK-060, TASK-064
- **创建时间**: 2026-09-19
- **完成时间**: 2026-09-19

---

## 2. 需求背景与用户痛点

用户在日常使用 Remora 进行远程开发时提出明确需求：
> "在source control tab我已经commit了,但是我不知道我commit了好多个,还有我不知道我是不是没有推送等等,或者是否有新的需要pull,都没有显示,我不知道当前状态,所以帮我完善一下."

深入剖析当前实现（TASK-045 与 TASK-060）存在的痛点：
1. **本地领先提交数 (Ahead Commits) 缺失**：用户在本地完成 commit 后，界面没有任何地方指示当前本地领先远程多少个提交（Ahead 数量），用户不知道到底 commit 了几个、是否堆积了过多未推送提交；
2. **远程落后提交数 (Behind Commits) 缺失**：没有反映远端是否有新的 commit 需要 pull，用户无法直观感知远端分支的更新状态；
3. **未推送提交列表 (Outgoing Commits) 盲盒体验**：用户在点击 Push 前，无法在界面上查阅待推送的具体提交记录（短 Hash、提交标题、提交时间、作者），更无法点击查看每个 commit 的改动差异；
4. **远程同步状态模糊**：原先仅有 Push、Pull、Sync 三个朴素按钮，没有实时角标计数（如 `Pull (1)`、`Push (2)`、`Sync (1↓ 2↑)`），也没有“已与远程保持最新”或“未关联远程分支”的状态胶囊提示；
5. **缺少远端状态主动探测 (Fetch)**：仅在本地查询 git status，若远端有更新但本地未执行 fetch，本地不会感知到远端最新 commit。

---

## 3. 详细设计与实现方案

### 3.1 Rust 后端状态扩展与单次极速探测
1. **数据结构升级 (`GitCommitInfo` 与 `GitStatusResult`)**:
   - 在 `src-tauri/src/lib.rs` 中新增 `GitCommitInfo` 结构：
     - `hash: String` (完整哈希)
     - `short_hash: String` (7位短哈希)
     - `subject: String` (提交信息第一行)
     - `author: String` (作者名)
     - `date_relative: String` (相对时间如 `5 minutes ago`)
   - 在 `GitStatusResult` 结构中新增核心字段：
     - `upstream: Option<String>` (远端追踪分支，如 `origin/main`)
     - `ahead: u32` (本地领先提交数，即待推送提交数)
     - `behind: u32` (远端领先提交数，即待拉取提交数)
     - `outgoing_commits: Vec<GitCommitInfo>` (本地待推送提交列表)
     - `incoming_commits: Vec<GitCommitInfo>` (远端待拉取提交列表，上限 20)
     - `recent_commits: Vec<GitCommitInfo>` (最近提交历史，上限 10)
2. **Bash 探测脚本深度优化与 15ms 零延迟**:
   - 在 `git_get_status` 中，通过单条组合 Shell 脚本一次性探测：
     - `git rev-parse --abbrev-ref @{upstream}` 精确获取上游分支；
     - 若配置了 upstream，使用 `git rev-list --left-right --count HEAD...@{upstream}` 直接解析 `ahead` 和 `behind`；
     - 若未配置 upstream，智能探测 `origin/$BRANCH` 或 `merge-base` 兼容新分支；
     - 使用 `git log @{upstream}..HEAD` 精准提取 `outgoing_commits`；
     - 使用 `git log HEAD..@{upstream}` 提取 `incoming_commits`；
     - 使用 `git log -n 5` 提取 `recent_commits`。
3. **新增专用 Tauri 命令**:
   - `git_fetch`: 支持执行远端获取（带 20s 动态超时与错误拦截），在不合并分支的前提下刷新远端追踪引用；
   - `git_show_commit`: 支持传入 `commit_hash` 获取该提交的完整提交信息与 unified diff (`git show --stat -p <hash>`)，截断保护防止大结果卡死。

### 3.2 前端状态层升级 (`gitStore.ts` & `tauriBridge.ts`)
1. **状态驱动与响应式管理**:
   - `useGitStore` 扩展字段：`upstream`, `ahead`, `behind`, `outgoingCommits`, `incomingCommits`, `recentCommits`, `isFetching`, `selectedCommit`, `commitDetail`, `commitDetailLoading`；
2. **后台静默同步与 0ms 首屏直出**:
   - `fetchStatus`: 极速获取本地已知状态并更新 UI；
   - 提供 `fetchRemote`: 后台触发 `git_fetch` 并在完成后原子刷新 status；
   - `commitChanges`, `pushChanges`, `pullChanges`, `syncChanges` 执行完成后自动级联刷新最新状态；
3. **提交差异详情查阅**:
   - 实现 `fetchCommitDetail(serverId, repoPath, commit)`，点击提交项可直达该提交的 diff 视图。

### 3.3 UI 界面视觉与交互革新 (`GitPanel.tsx`)
1. **VS Code 风格 Remote Sync 状态指示条**:
   - **分支与上游分支标识**: 分支栏展示当前分支及对应的 `origin/xxx` 上游分支；
   - **同步状态胶囊**:
     - 若 `ahead > 0`：醒目的天蓝色胶囊 `↑ ${ahead} 待推送`；
     - 若 `behind > 0`：醒目的翡翠绿胶囊 `↓ ${behind} 待拉取`；
     - 若 `ahead === 0 && behind === 0`：清新绿意徽章 `✓ 已与远程保持最新`；
     - 若无 upstream：提示 `未关联远程分支 (推送将自动设置 upstream)`。
2. **操作按钮动态联动与数字角标**:
   - `Pull` 按钮：若 `behind > 0`，突出显示 `Pull (${behind})`；
   - `Push` 按钮：若 `ahead > 0`，突出显示 `Push (${ahead})`；
   - `Sync` 按钮：若有同步需求，显示 `Sync (${behind}↓ ${ahead}↑)`；
   - 增加专用的 `Fetch` (或刷新联动) 操作。
3. **可折叠提交面板 (Accordion Commit Sections)**:
   - **COMMITS TO PUSH (待推送提交)**：
     - 当 `ahead > 0` 时默认展开；
     - 展示待推送的提交列表（Short Hash 徽标、提交 Message、作者与时间）；
     - 点击提交可弹窗查看该提交的代码 Diff；配备快捷 Push 按钮；
   - **COMMITS TO PULL (待拉取提交)**：
     - 当 `behind > 0` 时默认展开；
     - 展示远端待拉取的提交列表，配备快捷 Pull 按钮；
   - **RECENT COMMITS (最近提交记录)**：
     - 默认折叠，支持展开回溯最近提交历史；
4. **Commit 详情与差异弹窗 (CommitDetailModal)**:
   - 暗色高对比度展示提交的 Hash、作者、时间、Message 与代码行差异高亮。

---

## 4. 验收标准
1. 在 Source Control 面板中，本地完成 commit 后，即刻展示未推送提交数 `ahead`（如 `↑ 1 待推送`）；
2. 明确指示当前推送状态与上游追踪分支（如 `origin/main`），若无上游分支明确提示；
3. 远端有新提交时，经 fetch 或刷新能准确反映 `behind` 数量（如 `↓ 2 待拉取`）；
4. 操作按钮 `Push`、`Pull`、`Sync` 动态显示对应数字角标；
5. 在界面上清晰展示待推送提交列表 (Commits to push)，包含短 Hash、提交标题、提交时间，点击可查看该提交的 Diff 详情；
6. 当 `ahead === 0 && behind === 0` 时，展示“已与远程分支保持同步”明确标识；
7. 全程 TypeScript 0 报错，`pnpm run build` 成功，Rust 单元测试与端到端测试 100% 通过。

---

## 5. 验证与测试结论

1. **Rust 后端单元与集成测试**:
   - 运行 `cargo test`: 42 个 Rust 单元测试与 1 个 E2E 全流程测试全量 100% 绿灯通过（包括新增的 `test_parse_git_commit_line` 提交格式精准解析测试）；
2. **前端静态检查与生产构建**:
   - 运行 `pnpm run build`: `tsc` 静态类型检查 0 报错，Vite 打包全部产物成功输出 (`✓ built in 37.17s`)；
3. **真实仓库 Shell 脚本环境验证**:
   - 在真实 `/ssd0/git/Remora` 仓库上执行探测逻辑：正确检测到 `Branch: main`、`Upstream: origin/main`、`Ahead/Behind: 0 0` 及最近提交记录；在临时分支模拟有未推送提交时，精准解析出 `Ahead > 0` 并输出短 Hash、Subject、作者与相对时间；
4. **全部验收指标达成**，正式转为 **DONE**。
