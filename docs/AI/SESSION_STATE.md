# 当前会话状态 (SESSION_STATE.md)

本文档用于跨 Session 恢复工程上下文与进度。每次会话结束前必须更新此文件。

---

## 1. 当前目标与任务
- **当前 Goal**: TMUX 单会话单终端独占、会话名前置识别与 Android 移动端进程退出数据/凭据持久化
- **当前 Task**: 
  - TASK-031: 修复局域网/移动端SSH心跳断连、终端通道死锁泄漏(OpenSSH no more sessions)与一键TMUX无缝恢复 [DONE]
  - TASK-032: 多终端Tab独立TMUX会话隔离与设备命名空间区分 (Terminal Tab & Device TMUX Session Isolation) [DONE]
  - TASK-033: 独立 TMUX 会话管理体系（解耦普通终端、远端会话列表可视化与任意交互管理） [DONE]
  - TASK-034: 修复终端重连无响应与通道复用失效、后台切回自愈与TMUX会话自动续连 [DONE]
  - TASK-035: TMUX 单会话单终端独占约束与前置会话名识别 (TMUX Single Terminal Enforcement & Prefix Session Title) [DONE]
  - TASK-036: Android 移动端与全平台 SQLite 本地持久化与凭证持久落盘修复 (Android & Multiplatform SQLite Data & Credential Persistence Fix) [DONE]
- **当前状态**: DONE

---

## 2. 本次会话完成内容
1. **TMUX 单会话单终端独占与旧终端自动清理 (TASK-035)**:
   - 在 `terminalStore` 中实现 `openTmuxSession` 与 `closeTmuxTerminals`。
   - 当用户在 TMUX 会话管理器中点击“进入”或“新建并打开”某个会话时，自动查找该服务器下该 TMUX 会话的全部旧终端，主动调用 `safeInvoke("terminal_close")` 销毁旧底层通道并就地替换/移除，彻底杜绝重复终端累积堆积。
   - 在 TMUX 管理器中销毁/终止某个会话时，联动清理对应的前端终端标签。

2. **TMUX 终端会话名称前置显示与标签栏区分 (TASK-035)**:
   - 标题格式规范为 `<sessionName> (tmux) [server]`（或无服务器时的 `<sessionName> (tmux)`），确保会话名称排在最首位，杜绝此前被较长的服务器名截断遮盖的缺陷。
   - 在 `TerminalTabBar` 中为 TMUX 终端添加专属的琥珀色 `Layers` 图标，并在大屏上提升标签宽度上限（`max-w-[140px] sm:max-w-[200px]`）。

3. **Android 移动端应用划掉杀死后数据清空严重缺陷根治 (TASK-036)**:
   - **根本原因**: `StorageService::default_db_path()` 先前使用 `dirs::data_dir()`，该 crate 在 Android 上无法识别应用沙盒路径返回 `None`，导致创建 `./remora` 权限被拒并静默降级到 `StorageService::new_in_memory()` 内存数据库；`KeyringService` 在缺少 SecretService 的 Android 平台也仅存储在内存 `memory_fallback`，应用进程被系统杀掉后所有数据即刻蒸发。
   - **Tauri 2 官方沙盒路径支持**: 在 `src-tauri/src/lib.rs` 的 `setup` 阶段，通过 `app.path().app_data_dir()` 获取标准跨平台持久化目录（Android 下为 `/data/user/0/com.remora.app/files`），并在启动时自动检测并平滑迁移旧桌面端数据库文件。
   - **Keyring 持久化文件回退**: 为 `KeyringService` 引入 `with_data_dir(app_data_dir)`，在 OS Keyring 不可用的 Android 平台将凭据以安全隔离方式自动持久化至沙盒私有文件 `.credentials.dat`，跨进程重启不丢密码。

4. **全量验证与 Android APK 归档**:
   - `cargo test --manifest-path src-tauri/Cargo.toml`: 25 项单元测试（新增跨进程凭证持久化测试） + 1 项 e2e 测试全数通过。
   - `pnpm tsc --noEmit`: 前端 0 报错。
   - `pnpm build`: 生产打包成功。
   - `./build.sh --apk`: 成功构建通用架构 Release APK：`release/android/remora-universal-release-v0.1.8.apk`。

---

## 3. 修改与创建的文件
- **新建文件**:
  - `docs/AI/tasks/TASK-035.md`
  - `docs/AI/tasks/TASK-036.md`
- **修改文件**:
  - `src/stores/terminalStore.ts`
  - `src/components/Terminal/TmuxManagerModal.tsx`
  - `src/components/Terminal/TerminalTabBar.tsx`
  - `src-tauri/src/storage/db.rs`
  - `src-tauri/src/security/keyring.rs`
  - `src-tauri/src/storage/tests.rs`
  - `src-tauri/src/lib.rs`
  - `docs/AI/TASK_INDEX.md`
  - `docs/AI/SESSION_STATE.md`

---

## 4. 已运行的验证命令及结果
- `cargo test --manifest-path src-tauri/Cargo.toml`: 25 单元测试 + 1 e2e 测试 100% 全部通过。
- `pnpm tsc --noEmit`: 前端 TypeScript 类型检查 0 报错。
- `pnpm build`: Vite 生产打包 100% 成功。
- `./build.sh --apk`: 自动化生成并归档 `release/android/remora-universal-release-v0.1.8.apk`。

---

## 5. 未解决问题与剩余风险
- 无。TMUX 会话唯一终端独占、名称前置展示、Android 进程彻底退出后本地配置与凭证 100% 持久恢复均已完全闭环。
