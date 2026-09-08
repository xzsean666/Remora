# TASK-001: 初始化 Tauri 2 + React + TypeScript + TailwindCSS 项目骨架

## Objective
搭建 Remora 客户端基础工程骨架，集成 Tauri 2、Vite、React 19、TypeScript、TailwindCSS 及 Rust 后端基础环境，确保前后端构建、类型检查与桌面开发容器能够顺利通过。

## Scope
- 配置根目录 `package.json`（严格使用 `pnpm`）
- 配置前端 Vite + React 19 + TypeScript + TailwindCSS 基础项目
- 配置 `src-tauri` 目录、`Cargo.toml` 与基础 `tauri.conf.json`
- 跑通前端构建和 Rust 后端编译，确保前后端 IPC 基础通信链路通畅

## Allowed Files
- `package.json`
- `pnpm-lock.yaml`
- `vite.config.ts`
- `tsconfig.json`
- `tsconfig.node.json`
- `index.html`
- `tailwind.config.js` / `postcss.config.js`
- `src/**/*`
- `src-tauri/**/*`
- `.gitignore`

## Dependencies
- 前置依赖: TASK-000 (架构与开发规范文档就绪)

## Inputs and Outputs
- **Inputs**: 架构规范文档 (`docs/AI/ARCHITECTURE.md`)、用户系统工具链 (pnpm, cargo, node)
- **Outputs**: 可成功执行 `pnpm build` 与 `cargo check` 的标准 Tauri 2 工程骨架

## Acceptance Criteria
1. 使用 `pnpm install` 成功安装前端依赖，无版本冲突。
2. `pnpm run build` 成功输出前端静态资产至 `dist`。
3. `cargo check --manifest-path src-tauri/Cargo.toml` 成功，无编译错误。
4. 前端成功调用一个基础 Tauri IPC Command 并获得响应。

## Verification Commands
```bash
pnpm install
pnpm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

## Risks and Assumptions
- 风险: Tauri 2 在 Linux 环境下可能依赖系统级 `libwebkit2gtk-4.1-dev` 等库；若缺少开发包需及时报告或配置。
- 假设: 开发者本地已就绪 Rust 和 Node.js/pnpm 环境。

## Status
DONE
