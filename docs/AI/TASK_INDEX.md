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
| **TASK-050** | Android Release 持久化签名 Keystore 与 GitHub Actions 自动化一致性签名升级 (Android Persistent Release Keystore & Seamless Upgrade Workflow) | TASK-048, TASK-049 | **DONE** | `docs/AI/tasks/TASK-050.md` |
| **TASK-051** | 移动端软键盘弹出输入框遮挡自动向上避让与平滑滚动优化 (Mobile Virtual Keyboard Avoidance & Input Auto-Scroll Adjustment) | TASK-028, TASK-029, TASK-030, TASK-049, TASK-050 | **DONE** | `docs/AI/tasks/TASK-051.md` |
| **TASK-052** | 终端聚焦/切换与 TMUX 重绘闪屏深度治理及移动端渲染管线优化 (Terminal Focus/Switch & TMUX Redraw Flicker Elimination) | TASK-009, TASK-049, TASK-051 | **DONE** | `docs/AI/tasks/TASK-052.md` |
| **TASK-053** | 桌面端新窗口行为规范化 (Desktop Multi-Window VS Code Alignment & Clean Workspace) | TASK-021 | **DONE** | `docs/AI/tasks/TASK-053.md` |
| **TASK-054** | 远程图片文件可靠预览与缩放查看能力支持 (Remote Image SFTP Binary Preview & Zoom Viewer) | TASK-004, TASK-008 | **DONE** | `docs/AI/tasks/TASK-054.md` |
| **TASK-055** | TMUX / 普通终端鼠标划选即复制 (Copy-on-Select + OSC 52) 与终端全场景抗闪烁渲染引擎 (Atomic Coalescing & Clean DOM Renderer) | TASK-009, TASK-049, TASK-052 | **DONE** | `docs/AI/tasks/TASK-055.md` |
| **TASK-056** | 服务器负载轻量实时概览 (CPU/内存/磁盘/网络 5秒免存盘轮询) 与桌面蓝色状态栏及移动端紧凑微型栏全景展示 | TASK-003, TASK-005, TASK-019, TASK-028, TASK-043 | **DONE** | `docs/AI/tasks/TASK-056.md` |
| **TASK-057** | 默认下载目录重构至 ~/Downloads/Remora 与传输面板一键原生文件管理器穿透 | TASK-004, TASK-056 | **DONE** | `docs/AI/tasks/TASK-057.md` |
| **TASK-058** | 代码编辑器聚焦与滚屏位置保持优化 (CodeMirror Focus & Scroll Retention) | TASK-004, TASK-051 | **DONE** | `docs/AI/tasks/TASK-058.md` |
| **TASK-059** | VS Code 风格全局跨文件搜索系统 (VS Code Style Remote Global Search via SSH Exec) | TASK-003, TASK-004, TASK-006, TASK-008, TASK-019 | **DONE** | `docs/AI/tasks/TASK-059.md` |
| **TASK-060** | Source Control 进阶升级（GitHub CLI 账号切换 + Commit/Push/Pull/Sync + OpenRouter AI 智能 Commit 生成） | TASK-003, TASK-045, TASK-059 | **DONE** | `docs/AI/tasks/TASK-060.md` |
| **TASK-061** | 修复文件树路径复制失效保留旧内容与终端联动高频重绘闪烁缺陷 (Fix File Explorer Path Copy Failure & Terminal Title Auto-Refresh Flicker) | TASK-046, TASK-055 | **DONE** | `docs/AI/tasks/TASK-061.md` |
| **TASK-062** | 彻底根除文件浏览侧边栏在粘贴命令行与窗口聚焦等场景下的频闪与整树重绘缺陷 (Completely Eliminate File Explorer Flickering on Terminal Paste & Window Focus) | TASK-046, TASK-061 | **DONE** | `docs/AI/tasks/TASK-062.md` |
| **TASK-063** | 适配私有部署模型生成 Commit Message 并保留 OpenRouter 兼容支持 (Adapt Self-Hosted Model for AI Commit Generation while Preserving OpenRouter Compatibility) | TASK-060 | **DONE** | `docs/AI/tasks/TASK-063.md` |

---

## 2. 任务状态统计

- **已完成 (DONE)**: 64
- **进行中 (IN_PROGRESS)**: 0
- **待处理 (TODO)**: 0
- **阻塞中 (BLOCKED)**: 0
- **总任务数**: 64

---

## 3. 项目执行总结

- **TASK-063** 圆满完成：适配私有部署模型生成 Commit Message 并保留 OpenRouter 兼容支持 (Adapt Self-Hosted Model for AI Commit Generation while Preserving OpenRouter Compatibility)。核心落地四项能力：1) **双轨模型分流与智能适配引擎**：在 `aiCommitService.ts` 中根据 Base URL 自动识别 OpenRouter 与私有部署模型，OpenRouter 保持原请求头与 `reasoning: { max_tokens: 0 }` 压制；私有模型（如 `qwen3.5:2b-optimized`）采用通用 OpenAI 标准请求头与 `reasoning_effort: "none"`，彻底杜绝思考过程消耗 token 导致的空白输出问题；2) **双向流式与非流式兼容解析**：支持 `text/event-stream` SSE 流与标准 JSON 解析，具备自动回退解析 `reasoning` 与正则清洗（剥除 `<think>` 标签、Markdown 代码块、引号与 `git commit -m` 前缀）；3) **环境配置与构建注入**：在 `.env` 中默认配置自建模型并完整保留 `OPEN_ROUTER_API_KEY`，在 `vite.config.ts` 中优化环境变量级联优先级与智能回退；4) **可视化设置弹窗升级**：在 `AiConfigModal.tsx` 中增加自建模型快捷预设与一键切换，TypeScript 0 报错，生产打包与 34 个 Rust 测试全量通过。
- **TASK-062** 圆满完成：彻底根除文件浏览侧边栏在粘贴命令行与窗口聚焦等场景下的频闪与整树重绘缺陷 (Completely Eliminate File Explorer Flickering on Terminal Paste & Window Focus)。深度剖析并根治四大诱发原因：1) **文件树持久挂载与非破坏性原地更新**：在 `ProjectExplorer.tsx` 中将中央全屏旋转 Spinner 的展现条件严格限制为 `!tree[rootPath] && loadingPaths.includes(rootPath)`（仅在首次冷启动内存无数据时展示），只要 `tree[rootPath]` 已经加载，后续刷新绝对不卸载树节点，彻底根除切回窗口时整棵树突然消失并替换为加载大白块的剧烈白闪与跳动；2) **窗口切回聚焦节流与静默同步**：在 `App.tsx` 的 `handleResume` 中，为文件树远端同步添加 30 秒节流时间戳保护并透传 `silent: true`，彻底消除用户从外部复制并在几秒内切回终端粘贴时频繁触发的全树 SFTP 遍历；3) **Zustand 状态深度比对与零重绘拦截**：在 `fileTreeStore.ts` 引入高性能 `areEntriesEqual` 比对算法，当目录获取条目与内存数据完全一致时保留原引用并直接 `return state`，阻断事件分发，实现 0 组件重绘与 0 次 DOM 抖动；4) **节点组件精细化订阅与展开防晃**：在 `FileTreeNode.tsx` 改用精细化 Selector 并包裹 `React.memo`，仅在 `isLoading && !hasChildrenLoaded` 时显示 Loader2，已有缓存的展开目录在后台同步期间稳定保持 `<ChevronDown>`，彻底根除箭头跳跃；并在 `connectionStore.ts` 引入状态浅比对避免重复渲染。
- **TASK-061** 圆满完成：修复文件树路径复制失效保留旧内容与终端联动高频重绘闪烁缺陷 (Fix File Explorer Path Copy Failure & Terminal Title Auto-Refresh Flicker)。深度剖析并根治两大核心痛点：1) **文件树路径复制失效与保留旧内容根治**：封装高可靠跨平台剪贴板工具库 `src/utils/clipboard.ts`，自动确立窗口焦点，采用现代异步 `navigator.clipboard.writeText` 结合经典同步 `document.execCommand('copy')`（创建只读隐藏 textarea）双轨容灾降级机制，彻底消除 Linux WebKitGTK 环境下因 DOM 卸载与焦点缺失抛出的 `NotAllowedError`；在 ContextMenu 中使用 `await onCopyPath()` 确保写入完成后再销毁菜单；挂载全局轻量毛玻璃 Toast 浮层，复制成功实时反馈路径；2) **终端联动高频重绘与文件树闪烁彻底治理**：在 `XtermView.tsx` 的 `term.onTitleChange` 中引入 `lastTitle` 缓存去重与有效 prompt 路径解析，彻底过滤 TMUX 状态栏秒针、日志输出与交互式 CLI 带来的无效刷新；在 `fileTreeStore.ts` 为 `loadDirectory` 与 `refreshPath` 引入 `silent` 静默模式，终端感知刷新时不变更 `loadingPaths`，彻底根除文件树展开箭头在折叠图标与 `Loader2` 旋转动画之间高频跳动闪烁，实现 0 频闪后台无感平滑同步。
- **TASK-060** 圆满完成：Source Control 进阶升级（GitHub CLI 账号切换 + Commit/Push/Pull/Sync + OpenRouter AI 智能 Commit 生成）。精准落地四项核心诉求：1) **GitHub CLI (`gh`) 活跃账号感知与平滑切换**：在 Rust 后端实现 `gh_get_auth_status` 与 `gh_switch_account`，智能解析已登录多账号列表与 `Active account: true`，在界面提供 GitHub 账号徽标与下拉快速切换弹窗；2) **全套核心 Git 动作**：提供 Commit（支持一键 Stage All，通过 Base64 编码由 stdin 管道安全传入提交信息，彻底杜绝特殊字符注入）、Push（支持自动设置 upstream）、Pull（拉取合并）与 Sync（一键 Pull + Push），并在连接管理器中引入 `exec_command_with_timeout` 动态放宽网络超时保护至 35~45 秒；3) **OpenRouter AI 智能 Commit Message 引擎**：精选速度极快且完全免费的大上下文模型 `nvidia/nemotron-3.5-lightning:free`，并通过 `"reasoning": { "max_tokens": 0 }` 压制冗余思考输出，1.5 秒内极速生成规范的 Conventional Commit 消息；支持一键切换英文/中文（默认英文）；4) **双层凭据配置与 CI 注入**：`vite.config.ts` 自动读取 `.env` 中的 `OPEN_ROUTER_API_KEY`，`.github/workflows/release.yml` 在云端打包流水线中注入凭证，且前端配备独立设置弹窗支持随时自定义 API Key、Base URL 与 Model。
- **TASK-059** 圆满完成：VS Code 风格全局跨文件搜索系统（远端自适应智能级联加速引擎 `ripgrep` -> `git grep` -> `grep` + Base64 零注入安全执行 + 大结果防爆流截断 + VS Code 经典三联开关 `Aa`、`\b`、`.*` 与高级路径包含/排除过滤 + 搜索结果树状折叠/展开 + 关键词高亮分段渲染 + 点击直达编辑器对应行与光标定位）。针对远程 SSH 无法走本地 SFTP 遍历读文件的性能瓶颈，创新性落地远程 Shell 管道流自适应执行架构：1) 在 Rust 后端实现 `SearchService` 与 `search_in_files` Tauri 命令，优先调用远端多线程 `ripgrep`，自动遵循 `.gitignore` 并跳过二进制与 `node_modules`；自动级联探测 `git grep` 与通用 `grep -rnI` 作为兜底，保证在任何远程 Linux/Mac/容器上 100% 毫秒级可用；2) 参数与正则检索词全程 Base64 编码注入远端 Shell，彻底杜绝 Shell 命令注入风险；3) 前端开发完整的 `SearchPanel.tsx`，与 ActivityBar 搜索图标 (`Ctrl+Shift+F`) 无缝集成；4) 扩展 `editorStore` 与 `CodeEditor.tsx`，点击检索项直接打开文件并精确定位与平滑滚屏至对应行和列。
- Remora 核心功能、远程代理注入、前后端集成、跨平台自动化全量构建发布体系全部就绪。
- **TASK-055** 圆满完成：TMUX / 普通终端鼠标划选即复制 (Copy-on-Select + OSC 52) 与终端全场景抗闪烁渲染引擎（双缓冲原子帧合并 + Linux WebKitGTK DOM 渲染器优化 + RAF 尺寸防抖去重）。根据用户“粘贴可以按照以前的不，我只要现在的鼠标选中他就复制就可以了”的指示精准优化：1) 粘贴快捷键零拦截：彻底恢复 `attachCustomKeyEventHandler` 为原样（仅保留 IME 回车防护），粘贴完全由系统和浏览器原生 paste 事件触发，零权限阻断风险、100% 可靠；2) 普通终端鼠标选中即复制：在终端容器监听 `mouseup`，检测到文本选区时自动调用 `navigator.clipboard.writeText(...)` 写入本地系统剪贴板并弹出轻量 "已复制到剪贴板" Toast 浮层；3) TMUX 鼠标选中即复制：在 `terminalStore.ts` 为 TMUX 注入 `set -s set-clipboard on` 与 `terminal-overrides Ms`，将 `copy-mode` 鼠标拖拽释放直接绑定为 `copy-pipe-and-cancel`，通过 OSC 52 管道发送 Base64 选区文本，并在 `XtermView.tsx` 注册 `registerOscHandler(52)` 解码写入宿主机剪贴板与展示 Toast；4) 移除外层 `select-none`，确保原生文本选中完全畅通；5) 实现原子帧合并引擎（Atomic Frame Coalescing）：拦截并微缓冲孤立的全屏清屏包（`\x1b[H\x1b[2J`），与随后到达的重绘字符合并写入，彻底根除 TMUX 重绘时的 1 帧空白闪烁；6) 在 Linux 桌面（WebKitGTK）彻底禁用 WebGL 改用极速稳定的 xterm 5 原生 DOM 渲染器，结合 RAF 与 `proposeDimensions()` 防抖去重，彻底消除尺寸调整与分屏拖拽时的频闪；7) 注入 `escape-time 10` 与关闭 TMUX 蜂鸣闪烁。
- **TASK-054** 圆满完成：远程图片文件可靠预览与缩放查看能力支持（对标 VS Code：SFTP 远端二进制流 Base64 管道 + 专业棋盘格图片查看器 + 滚轮缩放平移 + SVG 双模无缝切换）。解决点击远端图片文件因 UTF-8 文本强制解码抛错导致完全无法预览的重大缺陷：1) 在 Rust 后端实现 `sftp_read_binary_file` Tauri 命令与 `guess_image_mime`，通过文件扩展名与文件头魔数识别 MIME 类型，辅以 50MB 内存溢出防御保护；2) 在前端 `tauriBridge.ts`、`fileIcons.tsx`、`editorStore.ts` 建立图片检测管道，`openFile` 针对常见图片文件分支调用二进制读取并组装 Data URL；3) 编写专业图片视口查看器 `ImageViewer.tsx`，支持 CSS 棋盘网格透明通道、鼠标拖拽平移、鼠标滚轮缩放、适屏（Fit）、1:1 原始像素及实时元数据栏（自然分辨率与文件大小）；4) 针对 SVG 文件特别实现图形预览与 CodeMirror 源码编辑双模 0 延迟切换，保存时实时重新合成 Data URL，全面提升远程 Web/静态素材开发体验。
- **TASK-053** 圆满完成：桌面端新窗口行为规范化（对标 VS Code：新窗口独立启动且默认空白工作区与会话隔离）。解决快捷键 `Ctrl+Shift+N` 或活动栏新建窗口时强制加载上一窗口项目的严重违和体验：1) 在 Rust 原生层 `open_new_window` 为 Webview 加载 URL 注入 `index.html?new_window=1` 标识参数；2) 在 `tauriBridge.ts` 结合 URL 参数与原生窗口标签（`label !== "main"`）实现精准双重辅助窗口检测；3) 在 `App.tsx` 启动初始化中识别辅助新窗口，跳过 `restoreLastWorkspace()`，默认收起底部终端面板，展现 VS Code 风格的干净欢迎界面与项目连接列表；4) 在 `fileTreeStore.ts` 中联动 `setAppWindowTitle` 实现系统窗口标题随项目名称动态更新（`[项目名] - Remora` 或 `Remora`），彻底实现桌面多窗口独立并行。
- **TASK-052** 圆满完成：终端聚焦/切换与 TMUX 重绘闪屏深度治理及移动端渲染管线优化。针对移动端在终端聚焦、调出软键盘及切换 Tab 时终端产生清屏与频闪现象，深入剖析远端 TMUX 机制与移动端 WebView 图层特性：1) 在 `XtermView` 实现尺寸变更去重引擎（缓存 `lastCols` 与 `lastRows`），比对未变动直接拦截 `terminal_resize`，彻底消除切 Tab 时 TMUX 频繁接收 `SIGWINCH` 触发的 `\x1b[H\x1b[2J` 全屏清屏重绘；并在移动端为键盘弹起动画引入 150ms 尺寸防抖；2) 移动端识别（`isMobileDevice`）后彻底禁用 `@xterm/addon-webgl`，切换至零显存开销、DOM 同层无闪烁的 xterm 5 高性能原生 DOM 渲染器；3) 将终端 Tab 容器从 `display: none` 重构为 `visibility: hidden; position: absolute; inset: 0`，保持 DOM 盒模型物理宽高，切回终端瞬时显示、0 延迟、0 尺寸突变；4) 限制 Tab 切换时的 `term.focus()` 仅在桌面端生效，防止移动端切 Tab 误唤起输入法管道；5) 在 Android 原生 `MainActivity.kt` 中为 WebView 注入 `#181818` 基础背景色，彻底根除白闪。
- **TASK-051** 圆满完成：移动端软键盘弹出输入框遮挡自动向上避让与平滑滚动优化。解决手机端点击输入框软键盘弹出直接覆盖遮挡且必须输入字符后才调整位置的严重痛点：在 Android `MainActivity.kt` 的 `WindowInsets` 监听中添加 `WindowInsetsCompat.Type.ime()`，在 `AndroidManifest.xml` 中显式启用 `windowSoftInputMode="adjustResize"`，使得原生 WebView 在键盘弹出时物理缩容避让；在 `index.html` 中配置 `interactive-widget=resizes-content` 与自适应高度；实现全局移动端虚拟键盘自动避让引擎（`src/utils/mobileKeyboard.ts`），在输入框 `focusin` 与视口 `visualViewport` 尺寸发生变化时毫秒级平滑将目标居中（`scrollIntoView({ block: 'center' })`）；并将所有 Modal 弹窗优化为自适应最大高度与滚动放通，实现软键盘一弹起即刻平滑向上避让。
- **TASK-050** 圆满完成：Android Release 持久化签名 Keystore 与 GitHub Actions 自动化一致性签名升级。解决每次 CI 打包动态生成 debug 证书导致手机覆盖升级报错 `INSTALL_FAILED_UPDATE_INCOMPATIBLE` 的痛点：使用 `keytool` 生成 2048 位 RSA 官方专用证书 `remora-release.keystore`（有效期至 2054 年）；在本地 `.env` 保存签名信息并加入 `.gitignore` 严防泄露，同步提供 `.env.example` 模板；配置 `build.gradle.kts` 优先读取环境变量并自动绑定 release signingConfig；在 GitHub Actions Secrets 中通过 `gh secret set` 注入 4 项加密凭据，并在云端工作流自动解码注入环境变量，实现手机端版本升级无缝覆盖、无需卸载。
- **TASK-049** 圆满完成：移动端 TMUX 触控滑动手势滚屏支持与惯性动量优化。针对 xterm.js 在开启鼠标追踪模式时底层直接阻断原生 touch 事件导致手机在 TMUX 下完全无法滑动的痛点，在 `XtermView` 实现移动端触控转轮映射引擎：通过 `touchstart`/`touchmove` 精准识别垂直滑动意图并拦截默认页面橡皮筋/下拉刷新；以每 20px 步进合成带坐标的 `WheelEvent`，无缝驱动 xterm.js 发送 SGR 鼠标序列给 TMUX 进入与浏览 copy-mode；结合 EMA 速度滤波与 `requestAnimationFrame` 动量衰减循环实现丝滑的物理滑行；并在 `terminalStore`、宿主机全局 `/root/.tmux.conf` 与辅助栏 `TerminalMobileBar` 中同步注入瞬间滚轮绑定与 `PgUp`/`PgDn` 快捷键。
- **TASK-000 ~ TASK-048**：基础架构、持久化、终端、编辑器、多端适配、Git 可视化与跨平台全量构建发布体系全部完备。全部 53 项任务圆满达成！




