# TASK-004: SFTP 核心文件服务与基础文件操作实现

## Objective
基于 `russh-sftp` 实现远程 SFTP 核心文件服务 (`SftpService`)，支持目录列表读取 (`readdir`)、文件内容读写 (`read_file` / `write_file`)、重命名/移动 (`rename`)、删除 (`remove_file` / `remove_dir`)、新建目录 (`create_dir`) 以及文件元数据获取 (`stat` / `mtime`)，为 Project Explorer 与 CodeMirror 提供后端底层支持。

## Scope
- 集成 `russh-sftp::client::SftpClient` 与 SSH 通道绑定
- 定义 `FileEntry` 数据模型（文件名、绝对路径、是否目录、大小、修改时间 mtime）
- 实现 `SftpService`，管理 SFTP 会话通道与文件操作 API
- 实现保存冲突检测辅助方法（比对远端当前 `mtime` 与打开时 `mtime`）
- 暴露 Tauri 2 IPC 接口：`sftp_read_dir`, `sftp_read_file`, `sftp_write_file`, `sftp_create_file`, `sftp_create_dir`, `sftp_rename`, `sftp_remove`
- 编写单元测试验证数据转换与文件操作逻辑

## Allowed Files
- `src-tauri/Cargo.toml`
- `src-tauri/src/sftp/**/*`
- `src-tauri/src/core/types.rs`
- `src-tauri/src/lib.rs`
- `docs/AI/tasks/TASK-004.md`

## Dependencies
- 前置依赖: TASK-003 (SSH 异步连接管理器就绪)

## Inputs and Outputs
- **Inputs**: Server ID, Remote Path, File Content, New Path
- **Outputs**: `FileEntry` 数组、文件字符串内容、保存结果（成功或冲突错误）

## Acceptance Criteria
1. `FileEntry` 结构体完备，支持文件名、大小、目录标识与 mtime 序列化。
2. `SftpService` 能够通过 `ConnectionManager` 获取连接并开立独立 SFTP Subsystem 通道。
3. 提供目录读取、文件读取、文件写入与冲突检测逻辑。
4. 单元测试全部通过，`cargo check` 无错误。

## Verification Commands
```bash
cargo test --manifest-path src-tauri/Cargo.toml sftp::
cargo check --manifest-path src-tauri/Cargo.toml
```

## Risks and Assumptions
- 风险: 远程不同操作系统权限差异；处理 SFTP 返回的 PermissionDenied 与 NotFound 错误并转化为规范的 `AppError`。

## Status
DONE
