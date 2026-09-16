# TASK-064: 修复新仓库执行 Git Commit 无响应问题与作者身份自适应配置

## 任务信息
- **ID**: TASK-064
- **状态**: DONE
- **目标**: 解决新建 Git 仓库（如 `/ssd0/git/Ollama-Qwen3.5-lite`）未配置 Git `user.name`/`user.email` 时执行 Commit 失败被静默忽略、前端呈现“无反应”的问题；完善全链路错误拦截与首提交 Diff 兼容。

## 背景与问题根因
1. **多账号环境缺少默认作者身份**:
   用户工作机存在多 GitHub 账号（`xzsean666` 与 `0xcube-666`），未设置全局 `user.name`/`email`。新建仓库（如 `Ollama-Qwen3.5-lite`）本地无配置，导致 `git commit` 报 exit code 128 (`Author identity unknown`)。
2. **后端命令执行吞掉非零退出码**:
   `git_commit`、`git_push`、`git_pull`、`git_sync` 等命令执行后直接以 `Ok(output)` 返回，未能校验 exit code；
3. **前端误判成功清空描述**:
   前端收到成功的 resolve，清除 commit message 并重载状态，但在底层仓库并未提交，用户界面表现为“点击 commit 毫无反应”。
4. **无 HEAD 分支首次提交 Diff 报错**:
   在首个 commit 前执行 `git diff HEAD` 会报 `fatal: ambiguous argument 'HEAD'`，导致 AI 生成与 Diff 审查缺少暂存区变更细节。

## 解决策略与落地内容
1. **自动作者身份感知与补全 (`src-tauri/src/lib.rs`)**:
   在 `git_commit` 中检测仓库是否具备作者身份；若缺失，依据仓库路径（`/ssd0/git` vs `/ssd0/ems`）或 `gh` 活跃用户自动配置当前本地仓库（遵循官方 noreply 规范，如 `85156828+xzsean666@users.noreply.github.com`），不污染全局配置。
2. **全链路状态校验与错误透传 (`src-tauri/src/lib.rs`)**:
   在 `git_commit`、`git_push`、`git_pull`、`git_sync` 中注入 `EXIT_CODE=$?` 校验标识 `===REMORA_GIT_ERR:$EXIT_CODE===`。非 0 状态码转换为 `AppError::Internal` 抛向前端，前端保留输入内容并显示醒目错误提示。
3. **Unborn Branch 首提交 Diff 兼容 (`src-tauri/src/lib.rs`)**:
   采用 `(git diff HEAD 2>/dev/null || git diff --cached 2>/dev/null || git diff 2>/dev/null)` 梯级降级策略，彻底解决新仓库没有 HEAD 时 `git diff HEAD` 报错与空 diff 问题。
4. **无提交分支列表回退 (`src-tauri/src/lib.rs`)**:
   在 `git_get_status` 中，当 `branches` 列表为空（首次未提交状态）时，自动回退将 `current_branch` 填入 `branches`。

## 验证与测试结果
1. **真实仓库验证 (`/ssd0/git/Ollama-Qwen3.5-lite`)**:
   - 自动注入 `xzsean666` 与 `85156828+xzsean666@users.noreply.github.com`；
   - 成功完成首次提交：`[main (root-commit) 1c83463] feat(init): 初始化 Ollama Qwen3.5-2B 专属推理加速配置与性能基准测试`；
   - 状态干净（`nothing to commit, working tree clean`），`git log -1` 正常显示作者与提交信息。
2. **错误拦截验证**:
   - 对干净工作区提交执行拦截，准确提取 `nothing to commit, working tree clean` 并抛出 `AppError`，前端保留输入内容。
3. **自动化测试**:
   - `cargo test --manifest-path src-tauri/Cargo.toml`: 35 个 Rust 单元测试 + 1 个 E2E 集成测试全量 100% 通过（0 失败）。
   - `pnpm tsc --noEmit`: 前端 TypeScript 严格检查 0 报错。
   - `pnpm build`: 前端生产打包 100% 成功（耗时 7.21s）。
