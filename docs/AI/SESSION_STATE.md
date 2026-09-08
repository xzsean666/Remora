# 当前会话状态 (SESSION_STATE.md)

本文档用于跨 Session 恢复工程上下文与进度。每次会话结束前必须更新此文件。

---

## 1. 当前目标与任务
- **当前 Goal**: 解决终端空闲超时断连卡死与黄色圆点挂死缺陷，构建超时防挂死、毫秒级断连通知与一键/无感自动重连机制
- **当前 Task**: TASK-022: 终端空闲超时断连检测、超时防挂死与无感自动重连优化
- **当前状态**: IN_PROGRESS

---

## 2. 本次会话完成内容
1. 完成 **TASK-001 ~ TASK-020**: Remora MVP 核心功能、远程代理支持、No Proxy 白名单、自动化构建体系、UI 容器溢出修复、SSH 命令行快速解析导入、Linux Keyring Tokio 冲突彻底解决、私钥波浪号路径展开、多服务器并发连接、按服务器分类的项目管理工作流、集成终端中文/CJK 输入法双重与多次输入缺陷根治。
2. 完成 **TASK-021**:
   - **多窗口架构支持 (Multi-Window Architecture)**:
     - 引入 `tauri-plugin-single-instance = "2"`，主进程拦截外部新进程请求。当外部以参数（如 `remora --new-window`）启动时，自动唤醒现有主进程并开出全新独立 Webview 窗口；无参数时将现有窗口置顶聚焦。
     - 在 Rust 后端实现 `open_new_window` 与 `create_new_window` 指令；前端通过 `createNewWindow` 安全调用。
     - 应用内增加全局快捷键 `Ctrl+Shift+N` (Mac 下 `Cmd+Shift+N`) 随时新建窗口。
     - ActivityBar 底部增加 "New Window (Ctrl+Shift+N)" 操作按钮。
     - SQLite 连接开启 `PRAGMA journal_mode=WAL;` 与 `PRAGMA busy_timeout=5000;`，确保多窗口并发读写不互锁。
   - **Ubuntu 桌面右键菜单深度集成 (Desktop Actions)**:
     - 编写符合 FreeDesktop 规范的 Handlebars 模板 `src-tauri/templates/desktop.template`，声明 `Actions=new-window;` 及 `[Desktop Action new-window]`（包含中英文名称与 `--new-window` 执行参数）。
     - 生成并提供本地快速安装脚本 `scripts/install-desktop.sh`，在当前机器立即注册 `~/.local/share/applications/remora.desktop` 与高清应用图标，Ubuntu Dock 右键即刻呈现“新建窗口”。
   - **一键安装包打包构建 (Linux .deb & Signatures)**:
     - 配置 `tauri.conf.json` 支持 `deb` bundle 与 `createUpdaterArtifacts: true`。
     - 增强 `build.sh`：自动检测/导出 `TAURI_SIGNING_PRIVATE_KEY` 签名密钥，生成并归档 `Remora_0.1.0_amd64.deb`、`.deb.sig` 签名文件及 SHA256SUMS.txt，输出至 `release/linux_x64/`。任何 Linux 机器使用 `sudo dpkg -i Remora_0.1.0_amd64.deb` 即可一键完成系统级安装与桌面快捷方式注册。
   - **自动化检测与升级体系 (Auto-Updater)**:
     - 引入 `tauri-plugin-updater = "2"` 与 `@tauri-apps/plugin-updater = "^2"`。
     - 生成 Minisign 密钥对，公钥内置于 `tauri.conf.json`，更新源配置为 `https://github.com/xzsean666/Remora/releases/latest/download/latest.json`。
     - 在 `src-tauri/capabilities/default.json` 声明权限。
     - 前端启动 3 秒后静默检查更新，发现新版本弹出高对比度顶部通知条（支持“Upgrade & Restart”与忽略）；Settings 面板中亦提供“Check for Updates”手动检测入口。
   - **GitHub 发布流水线与身份鉴权**:
     - 编写 `.github/workflows/release.yml`，推送 `v*` 标签全自动触发构建、打包 deb/AppImage、签名产物并创建 GitHub Release。
     - 解决 DBus 隔离环境下的 Keyring 访问问题，成功激活 `xzsean666` GitHub 账户并完成鉴权。

---

## 3. 修改与创建的文件
- **新建文件**:
  - `docs/AI/tasks/TASK-021.md`
  - `src-tauri/templates/desktop.template`
  - `src-tauri/capabilities/default.json`
  - `scripts/install-desktop.sh`
  - `.github/workflows/release.yml`
- **修改文件**:
  - `src-tauri/Cargo.toml`
  - `src-tauri/tauri.conf.json`
  - `src-tauri/src/lib.rs`
  - `src-tauri/src/storage/db.rs`
  - `package.json`
  - `pnpm-lock.yaml`
  - `src/App.tsx`
  - `src/components/ActivityBar/ActivityBar.tsx`
  - `src/utils/tauriBridge.ts`
  - `build.sh`
  - `docs/AI/TASK_INDEX.md`
  - `docs/AI/SESSION_STATE.md`

---

## 4. 已运行的验证命令及结果
- `cargo check --manifest-path src-tauri/Cargo.toml`: 成功，0 错误 0 告警。
- `cargo test --manifest-path src-tauri/Cargo.toml`: 成功，17 组测试 100% 全部通过。
- `pnpm tsc --noEmit`: 成功执行，前端 TypeScript 类型检查 0 报错。
- `pnpm build`: 成功执行 `tsc && vite build`，前端产物打包完成。
- `./build.sh --deb`: 成功构建出 `Remora_0.1.0_amd64.deb` 与 `.deb.sig` 签名。
- `dpkg-deb -c`: 验证生成的 `.deb` 内部正确包含 `Actions=new-window;` 的 desktop 启动配置。
- `./scripts/install-desktop.sh`: 成功将启动器与图标注册至系统桌面目录。

---

## 5. 未解决问题与剩余风险
- 无。各平台包管理、桌面动作、自动升级与 GitHub 发布流程均已闭环。

---

## 6. 下一步执行计划
- 提交 Git Commit 并推送至 GitHub（`xzsean666/Remora`）。
- 打 tag（如 `v0.1.0`）并在 GitHub 上创建 Release，上传 `.deb`、`.deb.sig` 与校验和文件。

