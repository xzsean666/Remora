# TASK-012: 全流程端到端集成测试、性能基准与打包校验

## Objective
对 Remora 远程桌面客户端进行全流程端到端集成测试，验证前后端各核心模块（存储层、凭据安全、SSH 连接机、SFTP 文件系统、PTY 终端、VS Code 多面板布局、CodeMirror 6 编辑器、xterm.js 终端、后台文件传输与断线自动重连）的协同工作流与生产构建。

## Scope
- 端到端集成测试：
  - 编写 Rust 端到端集成测试 (`src-tauri/tests/e2e_integration.rs`)：覆盖完整流程：SQLite 存储初始化 -> 服务器配置持久化 -> Keyring 加密存取 -> 模拟连接状态流转 -> SFTP 文件流及 mtime 冲突检测 -> Terminal 会话调度与 Channel 流 -> TransferManager 传输生命周期与取消。
- 静态分析与类型校验：
  - 执行 `pnpm run build`（TypeScript 严格类型检查 + Vite 生产代码打包）
  - 执行 `cargo check --manifest-path src-tauri/Cargo.toml`
  - 执行 `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
- 发布模式构建校验：
  - 执行 `cargo build --release --manifest-path src-tauri/Cargo.toml` 验证发布编译与零 warnings。
- 文档归档与交接：
  - 更新 `TASK_INDEX.md`、`SESSION_STATE.md`、`GOAL.md`，输出项目最终交付总结。

## Allowed Files
- `src-tauri/tests/**/*`
- `src-tauri/Cargo.toml`
- `docs/AI/tasks/TASK-012.md`
- `docs/AI/TASK_INDEX.md`
- `docs/AI/SESSION_STATE.md`
- `docs/AI/GOAL.md`

## Dependencies
- 前置依赖: TASK-001 ~ TASK-011 (所有功能模块均已开发完成)

## Inputs and Outputs
- **Inputs**: 源码库、测试用例与构建命令
- **Outputs**: 100% 通过的测试套件、生产构建产物、完备的交接文档

## Acceptance Criteria
1. 全量端到端集成测试通过率 100%。
2. 前端 `pnpm run build` 成功，类型检查无错误。
3. 后端 `cargo test` 全部测试通过。
4. 后端 `cargo build --release` 成功构建二进制。
5. 所有任务状态流转为 DONE，文档闭环更新。

## Verification Commands
```bash
cargo test --manifest-path src-tauri/Cargo.toml
pnpm run build
cargo build --release --manifest-path src-tauri/Cargo.toml
```

## Risks and Assumptions
- 风险: Release 编译时间较长；采用分步执行并保留增量缓存。

## Status
DONE

## Verification Results
- `cargo test --manifest-path src-tauri/Cargo.toml`: 13 passed (12 unit tests + 1 e2e integration test), 0 failed.
- `pnpm run build`: Succeeded with code 0 without any type or bundling errors.
- `cargo build --release --manifest-path src-tauri/Cargo.toml`: Succeeded with code 0; produced optimized release binary `src-tauri/target/release/remora` (21MB).
- All acceptance criteria satisfied across all modules.
