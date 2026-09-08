# TASK-014: 远程代理 No Proxy (Bypass List) 默认内置扩展与配置支持

## Objective
在 Remora 远程服务器配置中增加 No Proxy (Bypass List) 选项，并内置包含 Docker 内部 IP 网段 (`172.16.0.0/12` 及常用子网)、内网私有网段 (`10.0.0.0/8`, `192.168.0.0/16`)、回环地址 (`localhost`, `127.0.0.1`, `::1`) 以及本地域名 (`*.local`, `.internal`) 的完整默认白名单。在前端表单中默认预填，在终端 Shell 注入时完整导出至 `no_proxy` 与 `NO_PROXY` 环境变量，确保 Docker 容器间通讯及内部网络不经过外部代理。

## Scope
1. **数据模型扩展 (`ServerConfig`)**:
   - `ServerConfig` 新增 `remote_no_proxy: Option<String>`。
   - SQLite 数据库表迁移：`servers` 表追加 `remote_no_proxy TEXT` 字段，支持平滑向下兼容。
   - `StorageService` 的 CRUD 支持 `remote_no_proxy`。
2. **终端环境变量注入升级 (`TerminalSession`)**:
   - 定义常量 `DEFAULT_NO_PROXY = "localhost,127.0.0.1,::1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,*.local,.internal"`。
   - `build_startup_cmd` 支持接收 `remote_no_proxy: Option<&str>`，若为空则自动回退至丰富的 `DEFAULT_NO_PROXY`。
   - 在远程 Shell 启动时，同时导出 `no_proxy` 与 `NO_PROXY`。
   - `terminal_open` 命令自动从存储中关联服务器的 `remote_no_proxy`。
3. **前端 UI 默认预填与编辑**:
   - `ServerManager.tsx`:
     - 新增 `No Proxy (Bypass List)` 输入框。
     - 增加默认值：`localhost,127.0.0.1,::1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,*.local,.internal`。
     - 表单重置与新建服务器时自动预填默认值，用户可直接保存或按需微调。
     - 服务器卡片与编辑模态框完整联动。
4. **自动化测试与文档更新**:
   - 编写单元测试验证 `DEFAULT_NO_PROXY` 及自定义 `no_proxy` 的导出。
   - 更新 `storage::tests`, `connection::tests`, `terminal::tests`, `tests/e2e_integration.rs`。
   - 全量通过 `cargo test` 与 `pnpm run build`。
   - 更新技术文档（`TASK_INDEX.md`, `ARCHITECTURE.md`, `SESSION_STATE.md`）。

## Allowed Files
- `src-tauri/src/core/types.rs`
- `src-tauri/src/storage/db.rs`
- `src-tauri/src/storage/tests.rs`
- `src-tauri/src/connection/tests.rs`
- `src-tauri/src/terminal/session.rs`
- `src-tauri/src/terminal/manager.rs`
- `src-tauri/src/terminal/tests.rs`
- `src-tauri/src/lib.rs`
- `src-tauri/tests/e2e_integration.rs`
- `src/components/Sidebar/ServerManager/ServerManager.tsx`
- `docs/AI/tasks/TASK-014.md`
- `docs/AI/TASK_INDEX.md`
- `docs/AI/ARCHITECTURE.md`
- `docs/AI/SESSION_STATE.md`

## Dependencies
- TASK-013

## Acceptance Criteria
1. 内置默认 No Proxy 完整覆盖 Docker 内部网段 (`172.16.0.0/12`)、私有局域网 (`10.0.0.0/8`, `192.168.0.0/16`)、回环 (`localhost,127.0.0.1,::1`) 及内部域名。
2. 前端添加服务器时默认自动填入上述丰富白名单，用户可自由编辑。
3. 远程终端启动时，`no_proxy` 和 `NO_PROXY` 准确导出配置的或默认的白名单。
4. 所有后端测试与前端打包验证 100% 通过。

## Verification Results
- `RUSTUP_HOME=/home/sean/.rustup cargo test --manifest-path src-tauri/Cargo.toml`:
  - 13 个单元测试全部通过（包含 `terminal::tests::test_build_startup_cmd_variants` 覆盖 `DEFAULT_NO_PROXY` 与自定义 no_proxy）。
  - 1 个端到端集成测试 `tests/e2e_integration.rs` 通过（验证数据库存储与读取 `remote_no_proxy`）。
- `pnpm run build`:
  - TypeScript 类型校验与 Vite 生产打包通过。

## Status
DONE
