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

---

## 2. 任务状态统计

- **已完成 (DONE)**: 24
- **进行中 (IN_PROGRESS)**: 0
- **待处理 (TODO)**: 0
- **阻塞中 (BLOCKED)**: 0
- **总任务数**: 24

---

## 3. 项目执行总结

- Remora 核心功能、远程代理注入、前后端集成、自动化构建发布体系 (`build.sh`) 全部就绪。
- **TASK-016** 圆满完成：全面修复 UI 界面容器约束、弹窗高度超限溢出、长文本横向溢出与滚动条治理。
- **TASK-017** 圆满完成：实现添加 SSH 服务器时直接粘贴命令行智能解析回填（支持 -i, -p, -l, -o, user@host:port 等复杂语法），并在 Remote Proxy 区域提供可视、可复制、一键填入的常用代理示例及全角冒号自动兼容。
- **TASK-018** 圆满完成：彻底消除 Linux 环境下 Keyring 库引发的 Tokio 嵌套运行时 Panic (`Cannot start a runtime from within a runtime`)，实现 OS Keyring 专用隔离线程与 Panic 容灾降级；增加 SSH 私钥路径波浪号 (`~/`) 智能用户目录展开与细粒度认证错误反馈。
- **TASK-019** 圆满完成：支持配置多台 SSH 服务器并发连接并独立维护状态；连接 SSH 纯粹建立网络会话而不自动强开任何目录；在 Project Explorer 与打开文件夹弹窗中全面实现根据 SSH 服务器分类查看与管理最近打开的 Project（含快捷连接、设为当前激活、删除历史及 1-Click 打开）；在多在线服务器间自由激活切换工作区。全部 20 项任务均已圆满达成！
