# Remora MVP - 项目总目标 (GOAL.md)

---

## 1. 项目定位与愿景

**Remora** 是一个轻量级的 **SSH Remote Workspace** 桌面客户端。

体验类似 VS Code，但主要面向远程 Linux 服务器开发。
核心设计理念：
> **连接 SSH → 打开远程项目目录 → 像 VS Code 一样进行远程开发。**

相比于 VS Code Remote-SSH（庞大的远程 node agent 服务注入、高内存占用、网络抖动易断联、环境依赖复杂），Remora 的定位是：
- **极致轻量**: 无需在远程服务器安装任何 Node.js 服务端 Daemon 或私有 Agent。纯标准 SSH + SFTP 协议驱动。
- **专注意图**: 专注将 "远程项目文件浏览 + 轻量编辑 + 稳定多终端 + 文件极速传输" 做到极致。
- **弱网鲁棒**: 断网自动指数退避重连、本地缓冲区保护（不丢代码）、SFTP 会话自动恢复。

---

## 2. 核心功能矩阵 (MVP Scope)

1. **SSH Connection & Security**:
   - 支持 Password、SSH 私钥 (RSA/Ed25519)、SSH Agent (`SSH_AUTH_SOCK`)、`~/.ssh/config` 导入与命令行快速分词解析。
   - 支持多台 SSH 服务器并发保持连接与后台会话隔离。
   - 支持在多个在线服务器中自由切换当前活动工作区服务器 (Active Server Switching)。
   - 凭证使用系统安全存储 (OS Keyring / SecretService 隔离线程)，敏感信息严禁明文落地。
   - TCP Keepalive、心跳检测与断线自动重连。

2. **Remote Project Root & Multi-Workspace Workflow**:
   - 以远程目录作为 Workspace Root（如 `/home/sean/projects/my-app`）。
   - 提供通用“打开项目/文件夹”交互弹窗，支持自定义输入路径、家目录/默认工作区快捷填充与最近历史一键直达。
   - Project Explorer 树形聚焦于当前活动服务器的项目，记住各服务器独立的工作区。
   - 最近打开项目 (Recent Projects) 持久化存储与快速切换。

3. **Project File Explorer**:
   - 树形折叠展开与按需懒加载 (Lazy Loading)。
   - 文件与文件夹基础操作：新建、重命名、删除、刷新。
   - 常见开发临时目录智能折叠/隐藏 (`.git`, `node_modules`, `target` 等)。

4. **File Preview & Code Editor**:
   - 单击快速预览 (Preview Tab)，双击常驻编辑 (Edit Tab)。
   - 基于 CodeMirror 6：语法高亮、行号、搜索、快捷键、Dirty 状态检测 (`*` 标记)。
   - `Ctrl + S` 保存远程文件。
   - 冲突检测：远程文件修改时间比对，避免覆盖他人改动。
   - 断网保护：未保存本地 Buffer 绝不丢失。

5. **Integrated Remote Terminal**:
   - 基于 xterm.js 与 Rust SSH PTY Channel。
   - 默认自动 `cd` 到当前远程项目根目录。
   - 支持 ANSI 颜色、Unicode、CJK 中日韩字符正常渲染与 IME 输入法合成。
   - 终端尺寸动态同步 (`SIGWINCH` / `window-change`)。
   - 支持多终端 Tab。

6. **File Transfer & Drag-and-Drop**:
   - 本地桌面文件/文件夹拖拽至远程 Explorer 指定目录自动上传。
   - 远程文件下载至本地。
   - 后台非阻塞传输管理器 (Transfer Manager)，提供进度条、取消与重试能力。

7. **Responsive & Flexible UI**:
   - VS Code 经典三栏布局：Activity Bar、Sidebar (Explorer/Servers)、Editor、Terminal (Bottom Panel)。
   - Sidebar 左右自由拉伸拖拽、Terminal 上下自由拉伸拖拽。
   - 支持 Panel 折叠/展开，自适应各种屏幕分辨率与 DPI 缩放。
   - 布局尺寸持久化存储。

---

## 3. 非目标 (Non-Goals / MVP Out of Scope)

为了确保 MVP 周期聚焦与高质量交付，以下特性在 MVP 阶段**明确不做**：
- ❌ 内置语言服务器协议 (LSP / Language Server Protocol)
- ❌ 交互式调试器 (Debugger / DAP)
- ❌ 完整 Git 差异可视化客户端 (通过集成 Terminal 使用 git 命令)
- ❌ 扩展插件系统 / 插件市场 (Extensions / Marketplace)
- ❌ Docker / K8s 管理界面
- ❌ 数据库可视化客户端
- ❌ AI 补全集成 (聚焦于轻量编辑基础体验)
- ❌ 复杂的跨多个服务器多根工作区 (Multi-root Workspace)
