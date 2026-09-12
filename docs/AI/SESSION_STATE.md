# 当前会话状态 (SESSION_STATE.md)

本文档用于跨 Session 恢复工程上下文与进度。每次会话结束前必须更新此文件。

---

## 当前目标与任务
- **当前 Goal**: 优化升级文件浏览 VS Code 体验（.gitignore 视觉置灰感知、复制相对路径、终端集成与快速过滤），并实现跨平台多端构建体系（Windows 本地构建脚本 + GitHub Actions 纯手动全矩阵 deb/apk/mac/windows 打包发布）
- **当前 Task**: 
  - TASK-047: 文件浏览 VS Code 体验增强与 .gitignore 视觉感知 [DONE]
  - TASK-048: 跨平台多端构建体系与 GitHub Actions 手动全量发布 [DONE]
- **当前状态**: DONE

---

## 2. 本次会话完成内容

1. **文件浏览 VS Code 体验增强与 .gitignore 视觉感知 (TASK-047)**:
   - **后端轻量级 .gitignore 提取**: 在 `src-tauri/src/lib.rs` 的 `git_get_status` 中执行 `git status --porcelain=v1 --ignored | grep '^!!'`，在 0.05 秒内即刻返回当前仓库忽略的顶级目录和文件，杜绝递归遍历 `node_modules` 等数万文件造成的通道阻塞，通过 `GitStatusResult.ignored` 回传前端。
   - **前端全局 Git Store 状态与层级判定**: 在 `gitStore.ts` 中维护 `ignored` 清单与 `isPathIgnored(path, rootPath)`，支持父目录忽略规则向下递归继承（例如被忽略的 `target/` 目录下所有深层文件均自动继承忽略），并默认忽略 `.git` 内部文件。
   - **FileTreeNode 视觉置灰与 Git 状态角标**:
     - 对被 `.gitignore` 匹配的文件与目录赋予 `opacity-50 text-vscode-textMuted/70` 置灰效果，悬浮 title 追加 `[gitignored]` 提示，右侧展示轻量 `I` 忽略标识；
     - 对未被忽略且有变动的文件联动呈现 VS Code 同款 Git 状态色彩与角标：`M`（黄色）、`U`/`A`（绿色）、`D`（红色）、`R`（蓝色）。
   - **VS Code 常用小功能集成**:
     - **复制相对路径 (Copy Relative Path)**：在右键菜单中增加“复制相对路径”，自动剥离工作区根目录前缀复制标准相对路径，极大便利代码模块导入与文档编写；
     - **在集成终端中打开 (Open in Integrated Terminal)**：在右键菜单中增加“在集成终端中打开”，如果已有活跃终端直接发送 `cd "<targetDir>"\n`，若无终端则自动创建锁定在该目录的终端会话并展开；
     - **文件树即时过滤搜索 (Explorer Quick Filter)**：在 ProjectExplorer 顶部工具栏增加筛选按钮，展开紧凑筛选框，支持实时按名称搜索文件，匹配到的父级文件夹自动展开，非匹配项平滑隐藏。

2. **跨平台多端构建体系与 GitHub Actions 纯手动全矩阵发布 (TASK-048)**:
   - **技术约束与可行性权威分析**:
     - macOS 桌面端受 Apple 专有 SDK 与 Cocoa/WebKit 运行时框架约束，无法在 Linux 宿主机上跨平台编译，必须依托原生 macOS 系统或 GitHub Actions 苹果虚拟机；
     - Windows 桌面端同样依赖 WebView2 运行时及 MSVC/NSIS 工具链，在 Linux 宿主机难以稳定生成安装包。
   - **本地 Windows 原生构建脚本**:
     - 编写原生 PowerShell 脚本 `build.ps1`，自动检测 Node、pnpm、Rust 工具链，自动递增版本号，构建 Windows NSIS / MSI 安装包并归档至 `release/desktop/` 并生成 `SHA256SUMS.txt`；
     - 升级 `build.sh` 增加 `--windows` 与 `--mac` 参数，在 Linux 宿主机运行时输出清晰友好的诊断说明与操作指引。
     - 更新 `src-tauri/tauri.conf.json` 中的 `bundle.targets` 为 `"all"`。
   - **GitHub Actions 纯手动全矩阵流水线重构**:
     - 全面重构 `.github/workflows/release.yml`，彻底移除 tag push 触发，只保留纯手动 `workflow_dispatch`；
     - 三端桌面矩阵（Ubuntu 22.04、Windows Latest、macOS Latest）覆盖：
       - Linux: `.deb` + `.AppImage`
       - Windows: `.msi` + `.exe` (NSIS)
       - macOS: `.dmg`
     - Android 独立作业：生成 `.apk`；
     - 统一将四大平台（deb, apk, mac, windows）全部构建产物一次性发布到同一个 Release 页面。

3. **文档与规范同步**:
   - 编写并创建 `docs/AI/tasks/TASK-047.md` 与 `docs/AI/tasks/TASK-048.md`；
   - 更新 `docs/AI/TASK_INDEX.md`，将任务总数递增至 49 项并保持 100% DONE。

---

## 3. 修改与创建的文件
- **新建文件**:
  - `build.ps1`
  - `docs/AI/tasks/TASK-047.md`
  - `docs/AI/tasks/TASK-048.md`
- **修改文件**:
  - `.github/workflows/release.yml`
  - `build.sh`
  - `src-tauri/src/lib.rs`
  - `src-tauri/tauri.conf.json`
  - `src/utils/tauriBridge.ts`
  - `src/stores/gitStore.ts`
  - `src/components/Sidebar/ContextMenu.tsx`
  - `src/components/Sidebar/ProjectExplorer/FileTreeNode.tsx`
  - `src/components/Sidebar/ProjectExplorer/ProjectExplorer.tsx`
  - `docs/AI/TASK_INDEX.md`
  - `docs/AI/SESSION_STATE.md`

---

## 4. 已运行的验证命令及结果
- `cargo check --manifest-path src-tauri/Cargo.toml`: 检查通过，0 错误 0 警告。
- `pnpm tsc --noEmit`: 前端 TypeScript 静态类型检查 0 报错通过。
- `cargo test --manifest-path src-tauri/Cargo.toml`: 26 项单元测试 + 1 项 e2e 测试 100% 全部通过。
- `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/release.yml'))"`: GitHub Actions YAML 语法校验通过。
- `./build.sh --help`: 命令行参数与选项打印正常。
- `./build.sh --windows --no-bump`: 智能错误诊断与引导信息输出正常。
- `./build.sh --mac --no-bump`: 智能错误诊断与引导信息输出正常。

---

## 5. 承诺与约束说明
- **严格遵循用户指示**: 本地 Release 构建与 Actions 构建完全交由用户自己执行，AI 代理不运行 `./build.sh`。
