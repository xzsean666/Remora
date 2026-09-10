# TASK-040: 根治工作区长时间闲置后断连无法查看文件夹内容、SFTP僵尸会话死锁自愈与前台恢复自动重连

## 任务元数据
- **任务 ID**: TASK-040
- **任务名称**: 根治工作区长时间闲置后断连无法查看文件夹内容、SFTP僵尸会话死锁自愈与前台恢复自动重连 (SFTP Zombie Session Self-Healing & Workspace Idle Recovery)
- **创建时间**: 2026-09-10
- **依赖任务**: TASK-034, TASK-036
- **状态**: DONE

---

## 1. 任务背景与核心诉求

用户反馈：
> "刚刚又发现了个问题，很久后我在回来的时候，工作区就看到文件夹，里面的内容就看不到了，我从新连接就有了，你看看这个是什么问题？"

### 深入分析根因：

1. **`SftpService` 僵尸会话死锁且永不清理 (Rust 后端)**：
   - `SftpService` 在内存中用 `HashMap<String, Arc<Mutex<SftpSession>>>` 缓存 SFTP 会话。当设备长时间闲置、休眠或切后台后，底层的 TCP/SSH 链路已被远端或 NAT 超时关闭，缓存中的 `SftpSession` 实际上已经死亡。
   - 但 `get_or_create_session` 只要在缓存中找到该会话就直接复用，绝不重新打开通道；当后续 `sftp.read_dir()` 抛出 Broken pipe / Channel closed 报错时，`SftpService` **未从缓存中移除死会话**，导致后续所有读取全部持续使用死会话报错。
   - 此外，此前在 `do_connect_server` 重建 SSH 连接时，从未联动清理旧的 SFTP 会话，旧会话依然霸占缓存。

2. **`FileTreeNode` 静默吞掉子目录读取错误 (前端)**：
   - 用户长时间离开后回来，由于顶层目录在前端 Zustand 状态中有缓存，所以能看到最外层的项目或文件夹。
   - 但当用户点击某个未加载的子目录时，`loadDirectory` 调用 `sftp_read_dir` 失败，错误被存入了 `dirErrors[dirPath]`。
   - **`FileTreeNode` 组件完全没有读取 `dirErrors`**！因为 `tree[dirPath]` 为空且 loading 结束，它直接把加载失败的目录误判为 `<div className="italic">Empty folder</div>`！用户看到的就是“只有文件夹，里面的内容全看不到了”，没有任何错误提示或重试按钮。

3. **缺少断连自愈与重试机制 (对比 Terminal)**：
   - 此前在 TASK-034 中，我们为终端 `terminal_open` 增加了 SSH 断线感知与自动重连自愈逻辑，但 `sftp_read_dir` 等文件操作命令没有任何重连自愈与重试机制。
   - 前台唤醒（`App.tsx` 的 `handleResume`）只自动恢复了终端，完全没有对工作区绑定的 SSH 连接与目录进行自愈和刷新。
   - 工作区顶部在打开项目时也不展示服务器连接状态，用户无法直观得知已经断线。

---

## 2. 方案与技术实现

1. **Rust 后端 SFTP 韧性与双重重试机制 (`SftpService`)**:
   - 当 `read_dir`、`read_file`、`stat` 等调用遇到通道关闭或网络错误时，立即调用 `self.close_session(server_id)` 剔除死会话。
   - 在 `SftpService` 内部进行第一次重试：重新通过底层活跃 SSH 链路 `open_channel` 并初始化新 `SftpSession` 执行读取。
   - 在 `do_connect_server` 与 `reconnect_server` 中，统一在握手前/后清空旧的 `sftp.close_session`，杜绝旧引用残留。

2. **SFTP 命令级断网自愈重连 (`lib.rs`)**:
   - 在 `sftp_read_dir` 与 `sftp_stat` 中，对齐 `terminal_open` 的自动自愈逻辑：
     - 若当前服务器状态为 `Disconnected` 或操作初次报错，自动调用 `do_connect_server` 尝试快速重新建联。
     - 建联成功后就地重试 SFTP 读取，实现对前端透明的无感恢复。

3. **前端 `FileTreeNode` 错误友好展示与一键重试**:
   - `FileTreeNode` 读取 `dirErrors[entry.path]`，发生加载错误时显示醒目的红色错误提示与“重试”按钮，杜绝假空目录（`Empty folder`）。

4. **工作区连接状态感知与快捷重连 (`ProjectExplorer.tsx`)**:
   - 在已打开项目顶部标题栏，增加对应服务器的连接状态指示灯（在线绿色、离线红色）。
   - 处于离线状态时提供一键“重新连接”按钮，并在连通后自动刷新工作区目录。

5. **前台唤醒与切回自动自愈 (`App.tsx`)**:
   - 扩展 `handleResume`：当应用从锁屏或切后台恢复可见时，不仅恢复终端，还检测当前工作区服务器的连通状态；若断开则自动发起静默重连，并在重连后调用 `refreshPath(rootPath)` 自动恢复文件树视图。

6. **工作区记忆与跨重启平滑恢复 (`fileTreeStore.ts`)**:
   - 将当前工作区信息记录到本地缓存，并在应用启动时支持自动恢复上一次的项目工作区。

---

## 3. 验收标准

1. 闲置断连后展开文件夹或刷新，后端能够自动无感重连并成功读取目录内容；
2. 若遇到网络错误，子目录清晰展示错误原因和重试按钮，不再误报为 "Empty folder"；
3. 工作区标题栏具备服务器在线/断线状态提示，断线时可一键快捷重新连接并刷新；
4. 应用切回前台自动触发自愈刷新；
5. `cargo test --manifest-path src-tauri/Cargo.toml` 全部通过；
6. 前端 `pnpm tsc --noEmit` 0 错误，`pnpm build` 顺利打包。
