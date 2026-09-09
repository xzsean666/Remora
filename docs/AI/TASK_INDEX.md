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

---

## 2. 任务状态统计

- **已完成 (DONE)**: 35
- **进行中 (IN_PROGRESS)**: 0
- **待处理 (TODO)**: 0
- **阻塞中 (BLOCKED)**: 0
- **总任务数**: 35

---

## 3. 项目执行总结

- Remora 核心功能、远程代理注入、前后端集成、自动化构建发布体系全部就绪。
- **TASK-027** 圆满完成：实现基于 SQLite `ssh_keys` 表的集中式私钥管理，支持 RSA/Ed25519/OpenSSH 内存直接解码与本地文件路径双向兼容，在服务器连接中支持一键选配已存私钥。
- **TASK-028** 圆满完成：小屏幕与手机端下全自适应三板块 Tab 切换（工作区、代码编辑器、远程终端一次只展示一个板块），文件点击自动跳转编辑器，视口动态自适应虚拟键盘（`100dvh`），并为终端提供专属移动辅助按键栏（Esc, Tab, Ctrl, Alt, 方向键等）。
- **TASK-029** 圆满完成：完成 Tauri 2 Android Gradle 原生工程初始化，添加后端桌面与移动平台条件编译隔离，并在 GitHub Actions Release 流水线中集成 Android APK 自动打包、签名与发布资产分发。
- **TASK-030** 圆满完成：通过 Android 原生 WindowInsets 监听动态注入安全区边距（状态栏、挖孔屏、导航手势条），彻底消除手机 Header 压住遮挡按钮缺陷；侧栏手机端自适应铺满消除多余黑边；内置移动端终端 `TMUX` 一键保活快捷键与预设 Session 快捷指令群组。
- **TASK-031** 圆满完成：通过 `channel.split()` 读写半通道分离彻底消灭终端死锁与 OpenSSH 会话通道泄漏（根治 `error: no more sessions`）；开启 `nodelay` 并将心跳优化为 `20s * 6次` 解决局域网/手机省电误杀；终端 Reconnect 自动联动 SSH 重新建联自愈；终端断线状态下点击 `TMUX` 自动缓冲并在连通后自动重放挂载已存在会话；并在 Android 原生启用常亮屏锁防止闲置灭屏。
- **TASK-032** 圆满完成：在终端会话实体中分配并持久化稳定槽位号（`slotNumber: 1, 2, 3...`）；构建基于设备与槽位的双重独立命名空间（`remora_mobile_${projectName}_${slotNumber}` / `remora_pc_${projectName}_${slotNumber}`）；彻底消除先前 `head -n 1` 抢占逻辑，各 Tab 独立自建 TMUX 会话，仅针对 Slot 1 保留对服务端历史已存 `remora_git_1` 的继承兼容，消除多 Tab 打开 TMUX 相互劫持串线缺陷。
- **TASK-033** 圆满完成：将普通终端与 TMUX 彻底解耦，普通终端回归纯净的标准远程交互 Shell，不再硬编码绑定到预设 magic slot；抽取独立的跨端 TMUX 会话管理体系，通过 Rust 后端 `exec_command` 及 `tmux_list_sessions` 实现本地可视化获取远端所有活跃 TMUX 会话（会话名、窗口数、附着状态、创建时间），支持在当前终端接入、新标签页打开、快捷新建以及销毁废弃会话。
- **TASK-034** 圆满完成：彻底根治终端断连后点击 Reconnect 无响应假死问题；修复 Tauri 2 Channel 销毁后重复调用导致的静默丢包缺陷；优化 Rust 后端 `open_channel` 僵尸链路 3 秒快速失败并在 `terminal_open` 中自动自愈重连 SSH（告别手动到 Config 列表点击连接）；重连时就地以新 ID 干净置换死终端，彻底抹除脏 DOM 与旧缓冲区残留；持久化 TMUX 会话关联，重连后 100% 自动 re-attach 续连对应 TMUX 现场，绝不回退至普通 Shell；增加 App 切回前台（`visibilitychange`/`focus`）自动恢复自愈机制。全部 35 项任务圆满达成！


