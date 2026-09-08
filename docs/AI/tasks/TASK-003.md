# TASK-003: SSH 异步连接管理器与认证状态机

## Objective
基于 `russh` 实现纯异步的 SSH 会话与通道连接管理器（`ConnectionManager`），支持密码认证、私钥认证、SSH Agent 认证，具备 Keepalive 心跳监测和断线状态感知。

## Scope
- 集成 `russh` 与 `tokio`
- 实现 `ConnectionManager`，管理多 Server 会话连接池
- 实现多种认证方式驱动（密码、OpenSSH 私钥文件、本地 SSH Agent）
- 实现 Keepalive 定时心跳与连接断开事件发射
- 提供 Tauri IPC 接口：`connect_server`, `disconnect_server`, `get_connection_state`

## Allowed Files
- `src-tauri/Cargo.toml`
- `src-tauri/src/connection/**/*`
- `src-tauri/src/core/**/*`

## Dependencies
- 前置依赖: TASK-001 (项目骨架就绪)

## Inputs and Outputs
- **Inputs**: ServerConfig（主机、端口、用户名、认证信息）
- **Outputs**: 稳定的异步 SSH 连接句柄、状态机监听器与通道开立能力

## Acceptance Criteria
1. 支持与标准 OpenSSH Server 成功握手并认证通过。
2. 断网或服务端关闭时能正确触发 `Disconnected` / `Reconnecting` 状态。
3. 提供单元测试或 Mock SSH Server 测试用例验证状态机转换。

## Verification Commands
```bash
cargo test --manifest-path src-tauri/Cargo.toml connection::
```

## Risks and Assumptions
- 风险: 弱网下 TCP 探测耗时较长；需配置合理的 Connect Timeout 和 Keepalive Interval。

## Status
DONE
