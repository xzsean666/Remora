# TASK-002: SQLite 本地存储层与数据模型实现

## Objective
在 Rust 后端实现基于 SQLite (`rusqlite`) 的本地持久化存储层，包括数据库表结构初始化（Servers, Projects, Recent Projects, Layout & Preferences），并实现数据访问层与 Tauri IPC 命令。

## Scope
- 集成 `rusqlite` 与迁移管理
- 实现 `ServerConfig` 数据模型与 CRUD
- 实现 `Project` 及 `RecentProject` 数据模型与 CRUD
- 实现 `Preferences`（包括窗口/面板尺寸布局）键值存储
- 实现安全密码存储接口（配合 `keyring`）
- 编写 Rust 单元测试验证存储逻辑

## Allowed Files
- `src-tauri/Cargo.toml`
- `src-tauri/src/storage/**/*`
- `src-tauri/src/security/**/*`
- `src-tauri/src/core/**/*`

## Dependencies
- 前置依赖: TASK-001 (项目骨架就绪)

## Inputs and Outputs
- **Inputs**: 数据模型定义与存储需求
- **Outputs**: 具备完整 CRUD 能力与单元测试覆盖的 StorageService 模块

## Acceptance Criteria
1. 应用启动时自动在用户应用数据目录创建或打开 `remora.db` 并执行 schema 初始化。
2. 单元测试覆盖 Server、Project、RecentProject 的新增、查询、更新、删除操作全部通过。
3. 凭据敏感字段（密码/密钥口令）不写入数据库明文列。

## Verification Commands
```bash
cargo test --manifest-path src-tauri/Cargo.toml storage::
```

## Risks and Assumptions
- 风险: 各操作系统用户数据目录路径差异；使用 `tauri::path::app_data_dir` 保持标准统一。

## Status
DONE
