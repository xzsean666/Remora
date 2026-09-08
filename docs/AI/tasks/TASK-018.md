# TASK-018: 修复 Linux Keyring 与 Tokio 运行时冲突及 SSH 私钥波浪号路径展开支持

## 任务元数据
- **任务 ID**: TASK-018
- **任务名称**: 修复 Linux Keyring 与 Tokio 运行时冲突及 SSH 私钥波浪号路径展开支持 (Fix Tokio-Keyring Runtime Conflict & SSH Key Tilde Path Expansion)
- **创建时间**: 2026-09-08
- **依赖任务**: TASK-002, TASK-003, TASK-017
- **状态**: IN_PROGRESS

---

## 1. 缺陷背景与问题分析
1. **Linux Keyring 与 Tokio 运行时冲突**:
   - 在 `src-tauri/Cargo.toml` 中，`keyring` 启用了 `linux-native-async-persistent` 与 `tokio` 特性。
   - 这导致底层 `zbus 4.4` 的 `block_on` 尝试在当前线程初始化并驱动一个全新的 Tokio `Runtime`。
   - 当从 Tauri 异步命令（运行在 Tokio `tokio-rt-worker` 线程上）调用 `state.keyring.get_secret()` 时，Tokio 检测到在现有运行时线程内调用 `Runtime::block_on`，触发致命 panic：
     `Cannot start a runtime from within a runtime. This happens because a function (like block_on) attempted to block the current thread while the thread is being used to drive asynchronous tasks.`
2. **私钥波浪号路径展开缺失**:
   - 用户输入私钥路径如 `~/ssh/sean`。
   - 标准库文件读取未展开 `~`，直接读取 `./~/ssh/sean` 产生 `No such file or directory`。
   - 错误产生时连接状态机未正常流转为 `ConnectionState::Failed`，导致 UI 状态失真。

---

## 2. 详细改造方案
1. **更新 Cargo.toml**:
   - 移除 `keyring` 中引发 runtime 冲突的 `linux-native-async-persistent` 与 `tokio` 特性。
   - 切换为 keyring 官方针对 Linux 推荐的同步安全特性：`features = ["apple-native", "windows-native", "linux-native-sync-persistent", "crypto-rust"]`。
2. **重构 KeyringService 线程隔离与 Panic 容灾**:
   - 所有调用底层 `keyring::Entry` 的操作均在独立 OS 线程 (`std::thread::spawn`) 中执行，物理杜绝与 Tokio 运行时的任何冲突。
   - 捕获任何潜在的底层 DBus 异常与 panic，降级至 `memory_fallback`，永不导致进程异常退出。
3. **私钥波浪号展开与状态机流转修复**:
   - 在 `connection/manager.rs` 中引入 `expand_path`，自动将 `~/` 展开为 `dirs::home_dir()`。
   - 在私钥加载失败时将连接状态置为 `ConnectionState::Failed`，提供友好错误提示。

---

## 3. 验收标准
1. `cargo check` 与 `cargo test` 100% 编译通过。
2. `tokio-rt-worker` 不再发生任何 panic。
3. `~/...` 形式的私钥路径能成功解析并尝试加载。
4. 文档 `TASK_INDEX.md` 与 `SESSION_STATE.md` 同步更新。
