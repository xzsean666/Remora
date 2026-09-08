# TASK-013: 远程服务器代理配置与终端环境变量自动注入

## Objective
在 Remora 中支持为每个远程服务器配置 Remote Proxy（如远程主机本机的 `127.0.0.1:1080`、`http://127.0.0.1:7890` 或 `socks5://127.0.0.1:1080`）。当用户打开该服务器的集成终端时，自动在远程 Shell 会话中注入并导出代理环境变量（`http_proxy`, `https_proxy`, `all_proxy`, `no_proxy`, `HTTP_PROXY`, `HTTPS_PROXY`, `ALL_PROXY`, `NO_PROXY`），使远程终端中的 curl、git、apt、wget 等网络工具直接走远程自身代理。并在前端界面提供代理输入、编辑已有服务器及终端状态提示。

## Scope
1. **数据模型扩展 (`ServerConfig`)**:
   - 在 `ServerConfig` 中增加 `remote_proxy: Option<String>` 字段。
   - SQLite 数据库表迁移：在 `servers` 表中追加 `remote_proxy TEXT` 字段，兼容老数据库。
   - `StorageService` 的 `get_servers`, `get_server`, `save_server` 支持读取与持久化 `remote_proxy`。
2. **远程终端代理环境注入 (`TerminalSession`)**:
   - 实现 `build_startup_cmd(initial_dir, remote_proxy)` 函数：
     - 代理格式规范化（自动补全 `http://` 协议头；支持 `http://`, `https://`, `socks5://` 等）。
     - 防转义与安全性过滤（过滤换行符、转义双引号）。
     - 注入全套大小写标准环境变量：`http_proxy`, `https_proxy`, `all_proxy`, `HTTP_PROXY`, `HTTPS_PROXY`, `ALL_PROXY`, `no_proxy="localhost,127.0.0.1"`, `NO_PROXY="localhost,127.0.0.1"`。
     - 结合 `initial_dir` 与 POSIX `printf` 友好提示：`[Remora] Remote proxy active: <proxy>`。
   - `terminal_open` IPC 命令自动查找该 server 的 `remote_proxy` 配置并传递给终端启动流程。
3. **前端 UI 与交互升级**:
   - `ServerManager.tsx`:
     - 增加 `Remote Proxy (Optional)` 输入框，包含格式提示与说明。
     - 增加已配置服务器卡片的 "编辑" (Edit) 按钮，支持用户随时修改现有服务器的代理设置。
     - 在服务器卡片上展示已配置代理的徽标 (Badge)。
   - `connectionStore.ts` & `terminalStore.ts`:
     - 连接服务器时记录当前激活服务器的 `remote_proxy`。
     - 终端会话记录 `remoteProxy` 属性，并在终端 Tab 栏 (`TerminalTabBar.tsx`) 上展示代理指示图标与 Tooltip。
4. **自动化测试与验证**:
   - 编写 `TerminalSession::build_startup_cmd` 单元测试，覆盖纯目录、带 http 代理、带 socks5 代理、无协议前缀、特殊字符转义等多种情况。
   - 更新 `storage::tests`, `connection::tests`, `e2e_integration` 测试用例。
   - 执行 `cargo test` 与 `pnpm run build` 确保前后端编译与测试 100% 通过。

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
- `src/stores/connectionStore.ts`
- `src/stores/terminalStore.ts`
- `src/components/Terminal/TerminalPanel.tsx`
- `src/components/Terminal/TerminalTabBar.tsx`
- `docs/AI/tasks/TASK-013.md`
- `docs/AI/TASK_INDEX.md`
- `docs/AI/ARCHITECTURE.md`
- `docs/AI/SESSION_STATE.md`

## Dependencies
- TASK-002, TASK-005, TASK-009, TASK-012

## Acceptance Criteria
1. `ServerConfig` 数据结构与 SQLite 存储无缝支持 `remote_proxy` 字段，且平滑兼容无该字段的旧数据库。
2. 支持输入 `127.0.0.1:1080`、`http://127.0.0.1:1080`、`socks5://127.0.0.1:1080` 等多种格式，自动规范化并注入大小写 proxy 环境变量。
3. 远程终端启动时成功执行环境变量 export，不破坏已有 `cd <initial_dir>` 机制，且给出清晰提示。
4. 前端服务器管理器支持新增和编辑代理配置，并在卡片和终端标签上直观展示代理状态。
5. 所有单元测试、端到端测试与 TypeScript 前端打包校验 100% 通过。

## Verification Results
- `RUSTUP_HOME=/home/sean/.rustup cargo test --manifest-path src-tauri/Cargo.toml`:
  - 13 个单元测试全部通过（包含 `terminal::tests::test_build_startup_cmd_variants` 和 `storage::tests::test_server_crud` 对 `remote_proxy` 的覆盖）。
  - 1 个端到端集成测试 `tests/e2e_integration.rs` 通过（验证数据库创建、存储并读取包含 `remote_proxy` 的服务器配置）。
- `pnpm run build`:
  - 全量 TypeScript 严格类型检查与 Vite 生产构建通过。

## Status
DONE
