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
| **TASK-042** | 编写项目官方详尽说明文档 (README.md) | TASK-000 ~ TASK-041 | **DONE** | `docs/AI/tasks/TASK-042.md` |
| **TASK-043** | 移动端 Tab 栏胶囊溢出修复与桌面端终端状态栏重叠布局优化 (Mobile Tab Bar & Terminal Layout Optimization) | TASK-028, TASK-030, TASK-041 | **DONE** | `docs/AI/tasks/TASK-043.md` |
| **TASK-044** | TMUX 工作路径自动继承与终端鼠标滚轮日志输出平滑滚动修复 (TMUX Working Dir Inheritance & Terminal Mouse Wheel Scroll Fix) | TASK-009, TASK-031, TASK-033, TASK-041 | **DONE** | `docs/AI/tasks/TASK-044.md` |
| **TASK-045** | VS Code 风格轻量级 Git 可视化与分支切换管理系统 (VS Code Style Lightweight Git Visualization & Branch Management) | TASK-003, TASK-004, TASK-006, TASK-008 | **DONE** | `docs/AI/tasks/TASK-045.md` |
| **TASK-046** | TMUX 右键系统菜单统一与远端文件浏览器实时刷新增强 (TMUX Right-Click Context Menu Consistency & Remote File Explorer Realtime Refresh Enhancement) | TASK-004, TASK-007, TASK-009, TASK-040, TASK-044 | **DONE** | `docs/AI/tasks/TASK-046.md` |
| **TASK-047** | 文件浏览 VS Code 体验增强与 .gitignore 视觉感知 (File Explorer VS Code Experience & .gitignore Dimming Enhancement) | TASK-007, TASK-045, TASK-046 | **DONE** | `docs/AI/tasks/TASK-047.md` |
| **TASK-048** | 跨平台多端构建体系与 GitHub Actions 手动全量发布 (Multiplatform Build System & Manual Release Workflow) | TASK-015, TASK-021, TASK-029, TASK-037, TASK-039 | **DONE** | `docs/AI/tasks/TASK-048.md` |
| **TASK-049** | 移动端 TMUX 触控滑动手势滚屏支持与惯性动量优化 (Mobile TMUX Touch Gesture Scrolling & Momentum Physics) | TASK-009, TASK-041, TASK-044, TASK-046 | **DONE** | `docs/AI/tasks/TASK-049.md` |

---

## 2. 任务状态统计

- **已完成 (DONE)**: 50
- **进行中 (IN_PROGRESS)**: 0
- **待处理 (TODO)**: 0
- **阻塞中 (BLOCKED)**: 0
- **总任务数**: 50

---

## 3. 项目执行总结

- Remora 核心功能、远程代理注入、前后端集成、跨平台自动化全量构建发布体系全部就绪。
- **TASK-048** 圆满完成：跨平台多端构建体系与 GitHub Actions 纯手动全矩阵发布。明确梳理了在 Linux 宿主机上无法合法且稳定交叉编译 macOS（受 Apple 专有 SDK 与 WebKit/Cocoa 框架约束）和 Windows 桌面版的技术成因；为 Windows 本地开发者编写原生 PowerShell 构建脚本 `build.ps1`，支持自动检测 Rust、pnpm 工具链并打包 NSIS/MSI 安装包；升级 `build.sh` 增加 `--windows` 与 `--mac` 智能诊断报错与操作引导；全面重构 GitHub Actions `.github/workflows/release.yml`，彻底移除 tag push 触发改为纯手动 `workflow_dispatch` 触发，通过 Ubuntu 22.04、Windows Latest、macOS Latest 以及 Android 虚拟机全矩阵并行打包，一次性输出并发布 `deb`, `apk`, `mac` (dmg), `windows` (msi/exe) 四大平台全部产物。
- **TASK-047** 圆满完成：文件浏览 VS Code 体验深度增强与 .gitignore 视觉感知。后端 `git_get_status` 增加轻量级 `.gitignore` 忽略清单提取（0.05s 高效无递归）；前端 `gitStore` 建立路径忽略判定树，支持父目录忽略规则向下自动继承；`FileTreeNode` 为忽略文件与目录赋予 VS Code 同款半透明置灰与 `[gitignored]` 提示，同时联动未忽略变动文件的 Git 状态色彩与 `M`、`U`、`D`、`A`、`R` 角标；右键上下文菜单集成“复制相对路径 (Copy Relative Path)”与“在集成终端中打开 (Open in Integrated Terminal)”；ProjectExplorer 工具栏集成即时快速文件过滤搜索框，支持递归匹配并自动展开对应父级目录。
- **TASK-046** 圆满完成：TMUX 右键系统上下文菜单统一与远端文件浏览器实时刷新增强。针对 TMUX 开启鼠标后截获右键转义序列弹出内部纯文本菜单的缺陷，在前端 DOM 捕获阶段拦截 `button === 2` 并调用 `stopImmediatePropagation`，结合接入与创建会话时自动注入 `unbind-key -n MouseDown3*`，彻底在任何远程 Linux 服务器上统一了 TMUX 与普通终端的右键粘贴/复制菜单交互；在文件树刷新层面，重构 `refreshPath` 为顺序 `await loadDirectory` 避免 SFTP 通道互斥锁竞争，支持展开目录始终重拉，后端 SFTP 增加 `~` 波浪号路径自动解析，UI 增加旋转加载动效与防重点击保护，终端并在返回 shell prompt 时 800ms 防抖自动刷新工作区文件树，实时无感感知新产生文件。
- **TASK-045** 圆满完成：实现 VS Code 风格轻量级远程 Git 可视化核心体系。在 Rust 后端实现 `git_get_status`、`git_checkout`、`git_get_diff` 复合指令；在前端建立 `gitStore` 全局管理，在 ActivityBar 增加 Source Control 图标与改动数量 Badge；StatusBar 左侧集成实时分支名与改动计数，支持点击唤出分支搜索、切换与新建弹窗；侧边栏 Git 面板分类呈现修改与未跟踪文件，支持文件点击直接在编辑器打开，并提供精美 Unified Diff 差异高亮对比视窗。
- **TASK-049** 圆满完成：移动端 TMUX 触控滑动手势滚屏支持与惯性动量优化。针对 xterm.js 在开启鼠标追踪模式时底层直接阻断原生 touch 事件导致手机在 TMUX 下完全无法滑动的痛点，在 `XtermView` 实现移动端触控转轮映射引擎：通过 `touchstart`/`touchmove` 精准识别垂直滑动意图并拦截默认页面橡皮筋/下拉刷新；以每 20px 步进合成带坐标的 `WheelEvent`，无缝驱动 xterm.js 发送 SGR 鼠标序列给 TMUX 进入与浏览 copy-mode；结合 EMA 速度滤波与 `requestAnimationFrame` 动量衰减循环实现丝滑的物理滑行；并在 `terminalStore`、宿主机全局 `/root/.tmux.conf` 与辅助栏 `TerminalMobileBar` 中同步注入瞬间滚轮绑定与 `PgUp`/`PgDn` 快捷键。
- **TASK-000 ~ TASK-048**：基础架构、持久化、终端、编辑器、多端适配、Git 可视化与跨平台全量构建发布体系全部完备。全部 50 项任务圆满达成！




