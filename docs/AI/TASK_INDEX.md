# Remora MVP 任务索引 (TASK_INDEX.md)

本文档跟踪 Remora MVP 的所有细粒度任务拆分、依赖关系及当前状态。

---

## 1. 任务全景与状态索引

| 任务 ID | 任务名称 | 依赖 | 状态 | 对应说明文件 |
| :--- | :--- | :--- | :--- | :--- |
| **TASK-000** | 初始化 AI 工作文档体系与架构深度优化 | 无 | **DONE** | 本次会话完成 |
| **TASK-001** | 初始化 Tauri 2 + React + TS + Tailwind 项目骨架 | TASK-000 | **DONE** | `docs/AI/tasks/TASK-001.md` |
| **TASK-002** | SQLite 本地存储层与数据模型实现 (rusqlite) | TASK-001 | **DONE** | `docs/AI/tasks/TASK-002.md` |
| **TASK-003** | SSH 异步连接管理器与认证状态机 (russh) | TASK-001 | **DONE** | `docs/AI/tasks/TASK-003.md` |
| **TASK-004** | SFTP 核心文件服务与基础文件操作实现 | TASK-003 | **DONE** | `docs/AI/tasks/TASK-004.md` |
| **TASK-005** | 远程 PTY 终端会话与 Tauri 2 Channel 二进制流 | TASK-003 | **DONE** | `docs/AI/tasks/TASK-005.md` |
| **TASK-006** | VS Code 风格响应式多面板布局系统 (Splitter) | TASK-001 | **DONE** | `docs/AI/tasks/TASK-006.md` |
| **TASK-007** | Project Explorer 远程文件树与按需懒加载组件 | TASK-004, TASK-006 | **DONE** | `docs/AI/tasks/TASK-007.md` |
| **TASK-008** | CodeMirror 6 代码编辑、多 Tab 缓存与 Ctrl+S 保存 | TASK-004, TASK-006 | **DONE** | `docs/AI/tasks/TASK-008.md` |
| **TASK-009** | xterm.js 集成终端组件与 CJK/IME 适配 | TASK-005, TASK-006 | **DONE** | `docs/AI/tasks/TASK-009.md` |
| **TASK-010** | 后台文件传输管理器 (TransferManager) 与拖拽上传 | TASK-004, TASK-007 | **DONE** | `docs/AI/tasks/TASK-010.md` |
| **TASK-011** | SSH 断线自动重连联动、终端恢复与防丢码冲突检测 | TASK-003, TASK-008, TASK-009 | **DONE** | `docs/AI/tasks/TASK-011.md` |
| **TASK-012** | 全流程端到端集成测试、性能基准与打包校验 | TASK-001 ~ TASK-011 | **DONE** | `docs/AI/tasks/TASK-012.md` |
| **TASK-013** | 远程服务器代理配置与终端环境变量自动注入 | TASK-002, TASK-005, TASK-009, TASK-012 | **DONE** | `docs/AI/tasks/TASK-013.md` |
| **TASK-014** | 远程代理 No Proxy (Bypass List) 默认内置扩展与配置支持 | TASK-013 | **DONE** | `docs/AI/tasks/TASK-014.md` |
| **TASK-015** | 跨平台自动化 Release 构建脚本 (build.sh) 与打包产物分发目录支持 | TASK-014 | **DONE** | `docs/AI/tasks/TASK-015.md` |
| **TASK-016** | UI 界面容器布局与溢出缺陷全面优化修复 | TASK-006, TASK-013, TASK-014 | **DONE** | `docs/AI/tasks/TASK-016.md` |
| **TASK-017** | SSH 命令行快速解析导入与代理示例复制填充 | TASK-002, TASK-003, TASK-013, TASK-016 | **DONE** | `docs/AI/tasks/TASK-017.md` |
| **TASK-018** | 修复 Linux Keyring 与 Tokio 运行时冲突及 SSH 私钥波浪号展开 | TASK-002, TASK-003, TASK-017 | **DONE** | `docs/AI/tasks/TASK-018.md` |
| **TASK-019** | 多 SSH 服务器并发连接状态维护、活动服务器激活切换与远程项目目录打开工作流 | TASK-002, TASK-003, TASK-004, TASK-007, TASK-017, TASK-018 | **DONE** | `docs/AI/tasks/TASK-019.md` |
| **TASK-020** | 修复集成终端中文/CJK 输入法重复与多次输入缺陷 | TASK-009, TASK-019 | **DONE** | `docs/AI/tasks/TASK-020.md` |
| **TASK-021** | 多窗口协同、Ubuntu 桌面集成与跨平台自动发布与更新体系 | TASK-015, TASK-020 | **DONE** | `docs/AI/tasks/TASK-021.md` |
| **TASK-022** | 终端空闲超时断连检测、超时防挂死与无感自动重连优化 | TASK-005, TASK-009, TASK-011, TASK-020 | **DONE** | `docs/AI/tasks/TASK-022.md` |
| **TASK-023** | 目录文件拖拽上传交互根治、同名冲突检测与替换/重命名弹窗处理 | TASK-004, TASK-007, TASK-010 | **DONE** | `docs/AI/tasks/TASK-023.md` |
| **TASK-024** | 远端服务器安全删除回收站机制与代码编辑器语法高亮美化 | TASK-004, TASK-007, TASK-008, TASK-023 | **DONE** | `docs/AI/tasks/TASK-024.md` |
| **TASK-025** | 全局快捷输入与分组管理系统 (Quick Snippets & Groups) | TASK-002, TASK-005, TASK-006, TASK-009 | **DONE** | `docs/AI/tasks/TASK-025.md` |
| **TASK-026** | 快捷输入批量导入与导出功能 (Quick Snippets Import & Export) | TASK-025 | **DONE** | `docs/AI/tasks/TASK-026.md` |
| **TASK-027** | SSH 私钥管理与连接凭证选配支持 (SSH Private Key Management & Selection) | TASK-002, TASK-003, TASK-017, TASK-019 | **DONE** | `docs/AI/tasks/TASK-027.md` |
| **TASK-028** | 手机端响应式三板块 Tab 视图与终端辅助键盘适配 (Mobile Responsive 3-Tab Layout & Keyboard) | TASK-006, TASK-008, TASK-009 | **DONE** | `docs/AI/tasks/TASK-028.md` |
| **TASK-029** | Android 移动端工程集成与 GitHub Release 自动打包发布 APK 体系 (Android Build & Release CI) | TASK-021, TASK-027, TASK-028 | **DONE** | `docs/AI/tasks/TASK-029.md` |
| **TASK-030** | 移动端安全区避让与侧栏自适应修复及终端会话保活联动增强 (Mobile Safe Area & Session Persistence) | TASK-028, TASK-029 | **DONE** | `docs/AI/tasks/TASK-030.md` |
| **TASK-031** | 修复局域网/移动端SSH心跳断连、终端通道死锁泄漏(OpenSSH no more sessions)与一键TMUX无缝恢复 | TASK-030 | **DONE** | `docs/AI/tasks/TASK-031.md` |
| **TASK-032** | 多终端Tab独立TMUX会话隔离与设备命名空间区分 (Terminal Tab & Device TMUX Session Isolation) | TASK-031 | **DONE** | `docs/AI/tasks/TASK-032.md` |
| **TASK-033** | 独立TMUX会话管理体系(解耦普通终端、远端会话列表可视化与任意交互管理) | TASK-031, TASK-032 | **DONE** | `docs/AI/tasks/TASK-033.md` |
| **TASK-034** | 修复终端重连无响应与通道复用失效、后台切回自愈与TMUX会话自动续连 | TASK-031, TASK-033 | **DONE** | `docs/AI/tasks/TASK-034.md` |
| **TASK-035** | TMUX 单会话单终端独占约束与前置会话名识别 (TMUX Single Terminal Enforcement & Prefix Session Title) | TASK-033, TASK-034 | **DONE** | `docs/AI/tasks/TASK-035.md` |
| **TASK-036** | Android 移动端与全平台 SQLite 本地持久化与凭证持久落盘修复 (Android & Multiplatform SQLite Data & Credential Persistence Fix) | TASK-029, TASK-035 | **DONE** | `docs/AI/tasks/TASK-036.md` |
| **TASK-037** | 修复 GitHub Actions Release 自动构建与发布失败 (Fix GitHub Actions Release Workflow Failure) | TASK-021, TASK-029 | **DONE** | `docs/AI/tasks/TASK-037.md` |
| **TASK-038** | 修复前端全局对象报错 [object Object] 与同步移动端原生应用图标 (Fix Global [object Object] Error Formatting & Sync Android Mobile App Icons) | TASK-029, TASK-036, TASK-037 | **DONE** | `docs/AI/tasks/TASK-038.md` |
| **TASK-039** | 优化 GitHub Actions Release 流水线自动引用项目版本 (Optimize Release Workflow to Auto-Reference Project Version) | TASK-037 | **DONE** | `docs/AI/tasks/TASK-039.md` |
| **TASK-040** | 根治工作区长时间闲置后断连无法查看文件夹内容、SFTP僵尸会话死锁自愈与前台恢复自动重连 | TASK-034, TASK-036 | **DONE** | `docs/AI/tasks/TASK-040.md` |
| **TASK-041** | 移动端Tab切换终端保活、TMUX会话防退化与无感静默接入 | TASK-035, TASK-038, TASK-040 | **DONE** | `docs/AI/tasks/TASK-041.md` |

---

## 2. 任务状态统计

- **已完成 (DONE)**: 42
- **进行中 (IN_PROGRESS)**: 0
- **待处理 (TODO)**: 0
- **阻塞中 (BLOCKED)**: 0
- **总任务数**: 42

---

## 3. 项目执行总结

- Remora 核心功能、远程代理注入、前后端集成、自动化构建发布体系全部就绪。
- **TASK-041** 圆满完成：根治手机端从终端切换到工作区或编辑器等其他 Tab 后 TMUX 会话丢失并回退为普通终端的严重缺陷。将移动端三板块由条件卸载重构为 CSS `hidden` 保活机制（Keep-Alive），保证后台 PTY 进程、xterm.js 与 TMUX 会话持续存活不被销毁；在前端终端 Store 中实现 `tmuxSessionName` 一等公民闭环，杜绝任何阶段退化为普通终端；实现“静默无感进入 TMUX（Stealth Attach）”流式过滤器与沉浸式遮罩，精准剥离进入 TMUX 前远端 shell 的 prompt 与 `tmux attach` 命令输入回显，实现 0 打字输入痕迹、直接呈现原生 TMUX 视窗的丝滑体验。
- **TASK-040** 圆满完成：根治长时间离开/休眠后工作区只看到顶层文件夹且无法查看子目录内容的重大缺陷。在 Rust 后端实现 SFTP 僵尸会话死锁自动剔除与双重自愈机制（子系统通道异常自动销毁并重建会话；底层 SSH 连接断开时透明自愈重连并自动重试目录读取）；在前端 `FileTreeNode` 中解决静默吞掉子目录读取错误导致的虚假 `Empty folder` 误报，改为展示明确错误信息与一键重试；在工作区标题栏增加服务器在线/断线状态点与快捷重连横幅；在 `App.tsx` 前台唤醒（`visibilitychange`/`focus`）中增加工作区连接自愈与目录自动刷新，并在 `fileTreeStore` 中持久化记录上次工作区以平滑恢复。
- **TASK-039** 圆满完成：优化 GitHub Actions Release 流水线，彻底移除 `workflow_dispatch` 手动输入 tag 版本的表单。在 GitHub Actions 网页端点击 `Run workflow` 时无需填写任何参数；流水线通过 `jq` / `node` / `grep` 多重安全策略自动从 `package.json` 或 `tauri.conf.json` 中读取工程既有版本号并规范化为 Release Tag（如 `v0.1.9`），实现一键零配置全自动跨平台发布。
- **TASK-038** 圆满完成：彻底消除全局报错呈现 `[object Object]` 问题。在 Rust 后端为核心 `AppError` 实施自定义 `Serialize` 直接序列化为人类可读格式；在前端 `tauriBridge` 中实现兼具 Rust Serde Enum 单键提取、标准 Error 与通用对象降级的 `formatErrorMessage` 并由 `safeInvoke` 全面托管重抛具备友好 `message` 与 `.toString()` 的错误实例；完成 Android 移动端原生应用图标与自适应图标（`mipmap-anydpi-v26`）的全面替换，背景精准匹配 Remora 暗黑品牌色 `#181820`，并在 `build.sh` 中建立构建前自动资源同步保障，彻底根除模板旧图标与绿色机器人残留。
- **TASK-037** 圆满完成：修复 GitHub Actions Release 跨平台流水线。补齐 Linux `libfuse2` 依赖，支持更新器私钥缺失时 `--no-sign` 自动降级，锁定 Android CI 构建版本，建立多平台统一产物归档。
- **TASK-036** 圆满完成：彻底根除 Android 移动端进程完全划掉/Kill 退出后配置信息丢失问题。通过 Tauri 2 `app.path().app_data_dir()` 官方路径解析器将 SQLite 数据库与凭证持久化至 Android 应用专属沙盒目录（`/data/user/0/com.remora.app/files`），解决此前 `dirs::data_dir()` 在移动端返回 `None` 导致静默回退至内存数据库的严重缺陷；为 `KeyringService` 增加私有沙盒文件持久化回退，保证移动端 SSH 密码与私钥口令跨进程重启不丢失。
- **TASK-035** 圆满完成：实现同一 TMUX 会话全局独占单终端约束。用户在 TMUX 会话列表中点击进入已存在的会话时，自动关闭该会话此前打开的旧终端并释放后端通道，防止终端堆积；终端标题优化为 `<sessionName> (tmux) [server]`，确保会话名置于最前，并在标签栏增加专属琥珀色 `Layers` 图标与宽屏自适应显示。
- **TASK-034** 圆满完成：彻底根治终端断连后点击 Reconnect 无响应假死问题；修复 Tauri 2 Channel 销毁后重复调用导致的静默丢包缺陷；优化 Rust 后端 `open_channel` 僵尸链路 3 秒快速失败并在 `terminal_open` 中自动自愈重连 SSH；重连时就地以新 ID 干净置换死终端，彻底抹除脏 DOM 与旧缓冲区残留；持久化 TMUX 会话关联，重连后 100% 自动 re-attach 续连对应 TMUX 现场；增加 App 切回前台自动恢复自愈机制。
- **TASK-028 ~ TASK-033**：完成移动端响应式三板块、Android CI 构建、安全区避让、TMUX 隔离与独立会话管理体系。全部 42 项任务圆满达成！


