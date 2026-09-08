# TASK-010: 后台文件传输管理器 (TransferManager) 与拖拽上传

## Objective
在 Rust 后端实现高吞吐分块文件传输管理器 (`TransferManager`)，支持后台非阻塞文件上传与下载、实时进度事件节流上报、任务取消；在前端集成传输管理器面板 (`TransferPanel`)，并在 `ProjectExplorer` 结合右键菜单与拖拽上传机制。

## Scope
- 后端 Rust `src-tauri/src/transfer/`:
  - 数据模型：`TransferItem`, `TransferDirection` (Upload/Download), `TransferStatus` (Pending, Transferring, Completed, Failed, Cancelled)
  - `TransferManager`:
    - 基于 Tokio 异步多任务与 64KB/128KB 分块流式传输
    - 结合 Tauri 2 `AppHandle::emit` 发送 `"transfer-progress"` 实时进度事件
    - 支持通过 `CancellationToken` 取消正在执行的传输任务
    - 注册 Tauri 命令：`transfer_upload`, `transfer_download`, `transfer_cancel`, `transfer_list`
  - 单元测试：分块传输状态流转、取消信号响应与进度更新
- 前端 React/TS:
  - 创建 `src/stores/transferStore.ts`（Zustand）：监听 `"transfer-progress"` 事件、发起上传/下载、取消传输与状态聚合
  - 创建 `src/components/Sidebar/TransferManager/TransferPanel.tsx`：展示传输列表、方向图标、实时进度条、已传输字节大小、速度与取消按钮
  - 集成到 `ActivityBar` / `SidebarContainer` 的 "transfers" 视图
  - 在 `ProjectExplorer` 树节点右键菜单增加“下载文件”动作与拖拽文件区域支持
- 挂载并测试

## Allowed Files
- `src-tauri/src/transfer/**/*`
- `src-tauri/src/core/mod.rs`
- `src-tauri/src/lib.rs`
- `src/stores/transferStore.ts`
- `src/components/Sidebar/TransferManager/**/*`
- `src/components/Sidebar/ContextMenu.tsx`
- `src/components/Sidebar/ProjectExplorer/ProjectExplorer.tsx`
- `src/App.tsx`
- `docs/AI/tasks/TASK-010.md`

## Dependencies
- 前置依赖: TASK-004 (SFTP 核心文件服务就绪), TASK-007 (Project Explorer 文件树组件就绪)

## Inputs and Outputs
- **Inputs**: 本地与远程文件路径、用户拖拽输入、下载右键点击
- **Outputs**: 稳定可靠的非阻塞大文件分块流式传输与可视化进度控制面板

## Acceptance Criteria
1. 后端 `TransferManager` 能以 64KB 分块流式传输文件，不阻塞 SSH 连接或前端渲染。
2. 传输进度通过 Tauri 事件实时推送到前端，进度条与字节百分比正常动态更新。
3. 用户可在前端随时取消正在进行的传输任务，释放文件句柄。
4. 侧边栏 Transfers 面板清晰呈现任务状态、进度条与操作按钮。
5. 前端 `pnpm run build` 成功，后端 `cargo test` 全部通过。

## Verification Commands
```bash
cargo test --manifest-path src-tauri/Cargo.toml
pnpm run build
```

## Risks and Assumptions
- 风险: 高频触发事件导致前端过度重绘；后端采用 100ms 节流 (throttled) 广播进度。

## Status
DONE

## Verification Results
- `cargo test --manifest-path src-tauri/Cargo.toml`: 11 passed, 0 failed.
- `pnpm run build`: Succeeded with code 0 without any type or bundling errors.
- `TransferManager` chunked transfer, progress throttling, cancellation, and frontend `TransferPanel` with progress bars and download context menu fully implemented and verified.
