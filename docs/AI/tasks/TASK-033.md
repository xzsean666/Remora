# TASK-033: 独立 TMUX 会话管理体系（解耦普通终端、远端会话列表可视化与任意交互管理）

## 1. 任务背景与核心诉求

用户反馈：
> "帮我优化升级一下，现在普通的端口是普通端口，tmux单独给我弄出来，我本地可以看到目前设备的tmux列表，我可以去任意打开tmux,不要绑定terminal了。这样靠谱一点。"

在此前版本中：
1. 客户端尝试通过 slot 算法强行计算 `remora_mobile_${project}_${slot}` 并向活动终端盲注入长脚本，普通终端与 TMUX 强行绑定；
2. 用户在本地无法直观获知当前远端服务器到底已经存在哪些 TMUX 会话（如现有的 `remora_git_1`、`dev`、`ai` 等）；
3. 无法灵活在多个已有会话间切换、新建指定名称的会话或安全销毁废弃会话。

本任务将普通终端与 TMUX 彻底解耦：
- **普通终端回归纯净**：普通终端 Tab 就是纯粹标准的 bash/zsh 交互终端，不附带任何强制绑定逻辑。
- **TMUX 独立可视化管理**：提供专用的 TMUX 会话管理模块与可视化面板，用户在本地即可实时拉取远端 TMUX 会话列表，支持自由接入（Attach）、新建（Create）、在新标签页打开（Open in New Tab）以及销毁（Kill）。

---

## 2. 设计与技术实现

1. **Rust 后端支持 (`ConnectionManager::exec_command`)**:
   - 利用已有经过认证的 SSH 连接，以非阻塞 channel 方式执行非交互命令（带 8s 超时），收集输出并关闭通道。
   - 暴露 Tauri Command：
     - `tmux_list_sessions(server_id: String) -> Result<TmuxListResult>`：探测是否安装 tmux，并以结构化格式拉取所有会话（`name`, `windows`, `attached`, `created_at`）。
     - `tmux_kill_session(server_id: String, session_name: String) -> Result<()>`：安全销毁指定会话。
     - `tmux_new_session(server_id: String, session_name: String) -> Result<()>`：在后台创建新的后台会话。

2. **前端通用组件 (`TmuxManagerModal.tsx`)**:
   - 跨端自适应（支持桌面端浮层与移动端响应式触控抽屉）。
   - 实时展示远端所有活着的 TMUX 会话；
   - 操作支持：
     - **进入会话**：点击会话卡片上的“进入”按钮，自动创建专属的新终端 Tab（命名为 `[tmux] <name>`）并在新终端中附着进入，当前正在使用的普通终端保持原样不受破坏；
     - **快捷新建**：支持自定义名称快速创建并直接以新终端进入；
     - **销毁会话**：二次确认后销毁废弃会话；
     - **自动安装引导**：若服务器无 tmux，提供一键安装指令。

3. **解耦普通终端与工具栏整合**:
   - `TerminalTabBar.tsx` 与 `TerminalMobileBar.tsx` 中的普通终端点击 `+` 创建纯净 shell；
   - 点击 `TMUX` 按钮均统一唤起 `TmuxManagerModal`，赋予用户完全的主动权与掌控感。

---

## 3. 验收标准

1. `cargo test --manifest-path src-tauri/Cargo.toml` 100% 通过。
2. `pnpm tsc --noEmit` 0 错误。
3. `pnpm build` 编译成功。
4. 本地可实时查看远端实际存在的 TMUX 会话列表。
5. 普通终端不再被任何脚本强制拦截或绑定，随时可由用户自主选择进入任意 TMUX 会话。
