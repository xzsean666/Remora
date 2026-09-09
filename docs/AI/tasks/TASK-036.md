# TASK-036: Android 移动端与全平台 SQLite 本地持久化与凭证持久落盘修复 (Android & Multiplatform SQLite Data & Credential Persistence Fix)

---

## 1. 任务背景与核心原因分析

### 1.1 问题现象
用户反馈：手机端 Remora 应用从后台被完全移除（Kill/划掉）后重新打开，之前配置好的所有 SSH 服务器、私钥、历史项目等全部丢失，状态变成初始空白。

### 1.2 根本原因根因定位
1. **SQLite 存储路径在 Android 平台失效**:
   - `StorageService::default_db_path()` 使用了 `dirs::data_dir()`。在 Android 平台上，`dirs` crate 无法识别 Android 的应用沙盒数据目录，返回 `None`。
   - 代码回退到了 `PathBuf::from(".").join("remora").join("remora.db")`。而在 Android 原生运行时中，当前工作目录不是应用的可写私有目录，调用 `std::fs::create_dir_all` 抛出 `PermissionDenied` 失败。
   - `src-tauri/src/lib.rs` 中在 open 失败时静默回退至 `StorageService::new_in_memory()` 内存数据库，导致 Android 上所有的服务器配置和数据仅仅存在于内存中，应用被系统划掉杀死后即刻蒸发。
2. **凭据服务 (KeyringService) 在 Android 平台无常驻持久化**:
   - `keyring` crate v3 依赖 Linux SecretService / D-Bus，在 Android 上不存在此机制，调用会失败。
   - `KeyringService` 在 OS Keyring 失败时仅保存在内存 `memory_fallback: RwLock<HashMap<String, String>>` 中，导致密码与私钥口令在进程退出后随之丢失。

---

## 2. 解决方案与实施计划

### 2.1 基于 Tauri 2 原生路径解析器 (`app.path().app_data_dir()`)
- 将后端应用初始化统一改造为通过 Tauri 2 的 `app.path().app_data_dir()` 获取官方系统分配的可写持久化目录（Android 下为 `/data/user/0/com.remora.app/files`，桌面端为标准用户数据目录）。
- 兼容既有桌面端迁移：若标准目录不存在但旧的 `~/.local/share/remora/remora.db` 存在，自动无缝平移。
- 确保 SQLite 数据库文件切实建立在持久化沙盒目录中，杜绝无意回退到内存数据库。

### 2.2 凭据服务 (`KeyringService`) 增加持久化回退文件存储
- 在 `KeyringService` 中引入持久化文件机制（如 `app_data_dir.join(".credentials.dat")`）。
- 在 Android 等无系统级 Keyring 守护进程的环境下，密码与口令在 `memory_fallback` 的同时持久化到应用私有沙盒存储文件（Android 拥有内核级 UID 隔离，其他应用无权读取）。
- 启动时自动从该文件反序列化至内存缓存中，进程被杀后重新打开依然能读出完整的 SSH 连接密码与凭据。

---

## 3. 验收标准
1. Android 平台下 SQLite 数据库持久保存在 `app_data_dir/remora.db`，应用划掉/重启后，已配置的服务器、密钥与配置项 100% 完整保留。
2. SSH 服务器密码/口令在 Android 平台下重启后不丢失，依然可以直接点击连接成功。
3. 桌面端平滑兼容旧路径数据库，不破坏桌面端现有用户数据。
4. `cargo test` 单元测试与端到端测试 100% 通过。
5. 前端 `pnpm tsc --noEmit` 与构建 0 报错。
