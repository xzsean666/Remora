# TASK-048: 跨平台多端构建体系与 GitHub Actions 手动全量发布 (Multiplatform Build System & Manual Release Workflow)

## 任务元数据
- **任务 ID**: TASK-048
- **任务名称**: 跨平台多端构建体系与 GitHub Actions 手动全量发布 (Multiplatform Build System & Manual Release Workflow)
- **创建时间**: 2026-09-12
- **依赖任务**: TASK-015, TASK-021, TASK-029, TASK-037, TASK-039
- **状态**: DONE

---

## 1. 任务背景与核心需求

1. **本地多端打包可行性限制与技术调查**:
   - 用户希望支持本地 Windows 打包与 macOS 打包；若本地 macOS 无法实现，则通过 GitHub Actions 打包。
   - **核心技术约束分析**:
     - **macOS 打包**: Tauri 2 桌面应用强制依赖 Apple 专有 SDK（Cocoa、WebKit 运行时框架）。根据 Apple 开发者协议，Apple SDK 仅允许在 macOS 物理系统上使用与链接；在 Linux 宿主机上跨平台编译 macOS 桌面应用属于 Tauri 官方明确不支持的行为，且无法生成合规的 DMG 镜像与公证产物。因此，macOS 打包必须在 macOS 原生系统或 GitHub Actions macOS 虚拟机中运行。
     - **Windows 打包**: Linux 交叉编译 Windows Tauri 2 同样受限于 Windows WebView2 运行时及 MSVC / NSIS 链接器生态；
     - **最佳落地方案**: 为 Windows 本地开发者提供原生 PowerShell 构建脚本 `build.ps1`，并在 Linux `build.sh` 中增加友好错误提示与引导；全量多端打包则统一依托 GitHub Actions 提供的标准原生虚拟机矩阵（Ubuntu 22.04, Windows Latest, macOS Latest, Android NDK）。
2. **GitHub Actions 必须支持且仅支持手动触发，覆盖四大平台**:
   - 移除原先的 Tag Push 自动触发，改为纯手动触发（`workflow_dispatch`）；
   - 一次手动触发必须覆盖四大平台的完整打包：
     - **Linux**: Debian / Ubuntu 安装包 (`.deb`) 与通用二进制 (`.AppImage`)
     - **Windows**: Windows 微软安装包 (`.msi`) 与 NSIS 安装包 (`.exe`)
     - **macOS**: 苹果磁盘镜像包 (`.dmg`)
     - **Android**: 安卓移动端安装包 (`.apk`)

---

## 2. 解决方案与核心实现

### 2.1 本地 Windows 原生构建脚本与跨平台参数引导
- **创建 [build.ps1](file:///ssd0/git/Remora/build.ps1)**:
  - 专门面向 Windows 开发者与本地工作站的 PowerShell 一键打包脚本；
  - 自动检测 Node.js、pnpm、Rust、Cargo 工具链，自动读取与递增版本号；
  - 调用 `pnpm tauri build` 构建 Windows NSIS / MSI 安装包；
  - 自动将生成产物归档至 `release/desktop/` 并生成 `SHA256SUMS.txt` 校验和文件。
- **优化 [build.sh](file:///ssd0/git/Remora/build.sh)**:
  - 新增 `--windows` 与 `--mac` 参数；
  - 当检测到在非原生系统（如在 Linux 尝试构建 Windows 或 macOS）时，输出清晰友好的诊断说明与建议操作，引导使用 GitHub Actions 云打包或 Windows `build.ps1`。
- **优化 [src-tauri/tauri.conf.json](file:///ssd0/git/Remora/src-tauri/tauri.conf.json)**:
  - 将 `bundle.targets` 设置为 `"all"`，确保各操作系统平台均能识别并构建其对应的原生包格式。

### 2.2 GitHub Actions 纯手动触发全矩阵流水线重构
- **重构 [.github/workflows/release.yml](file:///ssd0/git/Remora/.github/workflows/release.yml)**:
  - **纯手动触发**: 彻底移除 `push.tags` 配置，仅保留 `workflow_dispatch`；支持可选传入自定义版本 Tag，为空时自动解析 `package.json` 中的当前版本号；
  - **三端桌面并行矩阵 (Matrix)**:
    - `ubuntu-22.04`: 构建 `deb,appimage`，安装 Linux WebKit2GTK 依赖；
    - `windows-latest`: 构建 `msi,nsis`，目标 `x86_64-pc-windows-msvc`；
    - `macos-latest`: 构建 `dmg`，目标支持通用苹果架构；
  - **Android 构建流水线**:
    - 在桌面构建后自动执行，利用 Java 17、Android SDK 34 与 NDK 26 编译生成 Android Universal APK；
  - **统一发布到单个 Release**:
    - 汇总 Linux (deb, AppImage)、Windows (msi, exe)、macOS (dmg)、Android (apk) 四大平台全部构建产物，一次性发布到同一个 Release 页面供用户下载。

---

## 3. 验收标准
1. `release.yml` 移除了除 `workflow_dispatch` 以外的所有自动触发器，实现 100% 手动触发。
2. 流水线覆盖 `deb`, `apk`, `mac`, `windows` 四大平台打包矩阵。
3. `build.ps1` 本地 Windows 构建脚本完备，语法合规。
4. `build.sh` 支持 `--windows` 与 `--mac`，在 Linux 宿主机运行时输出清晰友好的跨平台指引。
5. 项目原有编译与全量单元测试保持 100% 通过。
