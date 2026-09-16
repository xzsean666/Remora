# TASK-060: Source Control 进阶升级（GitHub CLI 账号切换 + Commit/Push/Pull/Sync + OpenRouter AI 智能 Commit 生成）

## 1. 任务背景与目标

在日常远程开发过程中，源代码控制（Source Control）是最高频的核心能力之一。用户提出：
1. **GitHub CLI (`gh`) 活跃账号感知与平滑切换**：直观看到当前活跃的 GitHub 账号（如 `xzsean666` / `0xcube-666`），并能在界面上轻松下拉切换；
2. **核心 Git 工作流操作**：提供常用的提交（Commit，含 Stage All）、推送（Push，含自动设置 upstream）、拉取（Pull）与一键双向同步（Sync）；
3. **AI 智能 Commit Message 自动生成**：
   - 只要在 GitHub Build 或本地 `.env` 中提供 `OPEN_ROUTER_API_KEY` 与 Base URL，即可一键解析当前 Git Diff 与变更状态，快速生成标准的 Conventional Commit 描述；
   - 选用极速且免费的大上下文模型 `nvidia/nemotron-3.5-lightning:free`，并通过 `"reasoning": { "max_tokens": 0 }` 压制思考冗余，1.5 秒内极速生成；
   - 支持中英文双语一键切换（默认英文）；
   - 前端提供轻量配置弹窗，支持随心查看或覆盖自定义 API Key、Base URL 与 Model。

---

## 2. 核心架构与功能设计

1. **Rust 安全后端 (`src-tauri/src/connection/manager.rs` & `src-tauri/src/lib.rs`)**:
   - `exec_command_with_timeout`: 为长耗时 Git 网络传输操作提供可配置超时时间（30~45s），避免默认 8s 超时误杀；
   - `gh_get_auth_status` & `gh_switch_account`: 执行 `gh auth status 2>&1` 与 `gh auth switch --user <user>`，精准解析多账号列表与 `Active account: true`；
   - `git_commit`: 使用 Base64 管道通过 stdin (`echo "<b64>" | base64 -d | git commit -F -`) 传输提交文本，彻底杜绝单双引号、反引号、美元符与多行换行带来的 Shell 命令注入隐患；
   - `git_push`, `git_pull`, `git_sync`: 提供安全 Git 网络操作，针对未设 upstream 的分支自动 fallback 至 `git push -u origin HEAD`；
   - `git_get_summary_diff`: 安全合并提取 `git status --short` 与 `git diff HEAD`，经 4000 字符安全截断，专供 AI 生成使用。

2. **AI Commit Message 服务 (`src/services/aiCommitService.ts` & `src/components/Sidebar/Git/AiConfigModal.tsx`)**:
   - 规范 Conventional Commits Prompt 工程，精准支持英文祈使句与中文描述；
   - 默认采用 OpenRouter 极速免费模型 `nvidia/nemotron-3.5-lightning:free`，大上下文，高可用；
   - 在 `vite.config.ts` 注入构建时环境变量，与运行时 `localStorage` 无缝双层级联；
   - 提供极简 AI 配置弹窗，支持可视化查看、修改 Key 与选择推荐免费模型。

3. **VS Code 风格界面升级 (`src/components/Sidebar/Git/GitPanel.tsx` & `src/stores/gitStore.ts`)**:
   - 分支栏下方集成 GitHub CLI 账号行，直观展示活跃账号与下拉菜单一键切换；
   - 快捷动作工具栏：[Pull] [Push] [Sync] 并提供对应状态徽标与动画反馈；
   - Commit 区域：语言徽标切换（`EN` / `中文`）、AI 魔法生成按钮（✨）、设置齿轮、多行输入与 `Ctrl+Enter` 快捷提交。

4. **CI/CD 构建流水线注入 (`.github/workflows/release.yml`)**:
   - 在 Release 流水线的桌面端和 Android 构建步骤中注入 `OPEN_ROUTER_API_KEY`、`AI_BASE_URL` 与 `AI_MODEL`，实现云端打包默认内置 AI 驱动。

---

## 3. 验收标准与验证命令

- `cargo test --manifest-path src-tauri/Cargo.toml` 34 个单元测试（含 2 个 gh 解析测试）+ 1 个 E2E 测试全部 100% 通过；
- `pnpm tsc --noEmit` 前端 TypeScript 严格检查 0 报错；
- `pnpm build` 前端 Vite 生产构建 100% 成功；
- 真实调用 OpenRouter 接口，生成英文与中文 Conventional Commit 速度在 1.5s 以内且格式完全合规。
