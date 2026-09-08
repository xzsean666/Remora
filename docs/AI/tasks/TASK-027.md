# TASK-027: SSH 私钥管理与连接凭证选配支持 (SSH Private Key Management & Selection)

---

## 1. 任务背景与目标

在原有实现中，Remora 连接 SSH 服务器仅支持在输入框内填入私钥本地文件路径（如 `~/.ssh/id_rsa`）。但在移动端 Android 环境下，应用处于沙盒存储中，用户无法方便地定位或使用文件系统路径；且对于桌面端用户而言，多服务器往往复用同一套私钥，每次手动输入文件路径繁琐且难以管理。

本任务目标：
1. **统一私钥存储体系 (SQLite `ssh_keys`)**:
   - 在 SQLite 中创建 `ssh_keys` 表，持久化存储私钥标识名称、私钥文本内容（PEM / OpenSSH 格式）、可选密码短语（passphrase）、公钥/指纹与时间戳。
   - 实现 `StorageService` 的 `get_ssh_keys`, `get_ssh_key`, `save_ssh_key`, `delete_ssh_key` 完整 CRUD 操作并编写单元测试覆盖。
2. **后端认证自动解析与多格式兼容**:
   - 改造 `ConnectionManager::connect` 与 `lib.rs` 的 `connect_server`。
   - 当连接指定为私钥认证时，支持传入已存私钥标识（形如 `key:<id>`）或直接传入私钥内容；后端优先从 `ssh_keys` 库中拉取真实私钥内容并自动填充密码短语。
   - 使用 `russh::keys::decode_secret_key` 直接在内存中解析 RSA / Ed25519 / OpenSSH 私钥字符串；若为本地路径则保留 `expand_home_dir` 与 `load_secret_key` 回退，保持桌面端完全向后兼容。
3. **前端集中管理模态框 (`KeyManagerModal`)**:
   - 在 ServerManager 顶部栏提供醒目的“私钥管理 (🔑)”入口。
   - 弹窗展示所有已配置私钥，包含算法类型标识（OpenSSH、RSA、Ed25519 等）、密码保护状态与创建时间。
   - 支持多行文本粘贴录入与“上传私钥文件 (.pem / .key / id_rsa)”一键读取填充。
4. **服务器配置表单无缝联动**:
   - 在添加/编辑服务器的私钥认证方式下，增加“选择已保存私钥”下拉菜单，支持一键选取，并支持直接唤起管理弹窗。

---

## 2. 验收标准

1. SQLite `ssh_keys` 表及 CRUD 操作在后端经受单元测试验证通过。
2. 前端可正常创建、查看、删除 SSH 私钥，支持文件上传与文本粘贴。
3. 配置 SSH 服务器时，可自由在“已保存私钥”与“自定义文件路径/内容”之间选择或切换。
4. 连接服务器时，后端能根据选配的私钥成功进行 SSH 密钥认证。
5. `cargo test`、`pnpm tsc`、`pnpm build` 100% 成功。

---

## 3. 状态与验证结果

- **状态**: **DONE**
- **验证结果**:
  - `cargo test --manifest-path src-tauri/Cargo.toml test_ssh_keys_crud`: 新增单元测试 100% 通过。
  - `cargo test --manifest-path src-tauri/Cargo.toml`: 全量 24 组单元测试 + 1 组 e2e 测试全部通过。
  - `pnpm tsc --noEmit`: 前端类型检查 0 报错。
  - `pnpm build`: 生产编译顺利完成。
