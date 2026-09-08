# TASK-021: 多窗口协同、Ubuntu 桌面集成与跨平台自动发布与更新体系

---

## 1. 任务背景与目标

Remora 作为面向 Linux 远程开发的高效桌面客户端，在进入正式发布阶段时需满足以下核心交付标准：
1. **多机器轻松安装**: 产出标准 Linux `.deb`（支持 Ubuntu/Debian 双击或 `dpkg -i` 快速安装，自动生成启动器图标）以及免安装独立运行包。
2. **运行自动检测升级 (Auto-Update)**: 集成 Tauri 2 官方 Updater 机制，应用启动时自动检测 GitHub 最新版本并提供平滑升级能力。
3. **发布到 GitHub**: 提交所有工程更新至 `main` 分支（使用已激活的 `xzsean666` 身份），创建 GitHub Actions 跨平台自动打包工作流，并通过 `gh release` 发布 Release 产物。
4. **Ubuntu 桌面图标右键 New Window**: 配置 FreeDesktop `.desktop` Action，使在 Ubuntu Dock 或桌面启动器右键 Remora 图标时显示 **“新建窗口 (New Window)”** 动作，点击立即拉起新窗口。
5. **应用内随时 New Window**: 应用内提供快捷键（`Ctrl+Shift+N`）及侧边栏独立操作按钮，点击即通过主进程拉起全新独立的 Webview 窗口，各自管理独立连接与会话。

---

## 2. 详细技术方案

### 2.1 后端多窗口机制与单实例协同 (`tauri-plugin-single-instance`)
- 在 `src-tauri/Cargo.toml` 引入 `tauri-plugin-single-instance = "2"`。
- 在 `src-tauri/src/lib.rs` 中注册该插件：
  - 当外部以参数（如 `remora --new-window`）启动已运行的应用时，插件截获该参数并回调主进程，调用 `open_new_window(app)` 新建窗口，同时聚焦新窗口；
  - 若未带参数，则将已有的窗口置顶并聚焦；若无任何窗口则新建窗口。
- 暴露 `create_new_window` Tauri Command，供前端在应用内直接通过 IPC 触发。

### 2.2 Ubuntu 桌面右键快捷操作 (`desktop.template`)
- 编写 `src-tauri/templates/desktop.template`，遵循 FreeDesktop Desktop Entry 规范：
  ```ini
  [Desktop Entry]
  Categories={{categories}}
  {{#if comment}}
  Comment={{comment}}
  {{/if}}
  Exec={{exec}} %U
  Icon={{icon}}
  Name={{name}}
  Terminal=false
  Type=Application
  StartupWMClass=remora
  Actions=new-window;

  [Desktop Action new-window]
  Name=New Window
  Name[zh_CN]=新建窗口
  Exec={{exec}} --new-window %U
  Icon={{icon}}
  ```
- 在 `tauri.conf.json` 中配置 `bundle.linux.deb.desktopTemplate: "templates/desktop.template"`。
- 提供本地桌面快捷注册脚本 `scripts/install-desktop.sh`，方便当前机器立即体验右键效果。

### 2.3 自动更新体系 (`tauri-plugin-updater`)
- 在 `src-tauri/Cargo.toml` 引入 `tauri-plugin-updater = "2"`。
- 在 `package.json` 引入 `@tauri-apps/plugin-updater = "^2"`。
- 生成 Updater 密钥对，公钥配置于 `tauri.conf.json`，更新源配置为 `https://github.com/xzsean666/Remora/releases/latest/download/latest.json`。
- 创建 `src-tauri/capabilities/default.json` 授权 `core:default` 与 `updater:default`。
- 前端启动时挂载静默检查更新，发现新版本时弹出优雅的更新通知条，用户确认后一键下载、校验并重启升级。

### 2.4 GitHub 发布工作流 (`.github/workflows/release.yml`)
- 建立标准的 GitHub Actions 流水线，监听 `v*` 标签推送；
- 自动化完成代码检出、Node/Rust 环境构建、生成 `.deb` 与 AppImage、签名更新产物并创建 GitHub Release。

---

## 3. 验收标准
- [x] 后端支持 `create_new_window` 并支持 `single-instance` 唤醒新窗口。
- [x] 前端支持快捷键 `Ctrl+Shift+N` 与 ActivityBar 按钮快速新建独立窗口。
- [x] `.desktop` 模板支持 Ubuntu Dock 右键“新建窗口 (New Window)”。
- [x] 成功打包 `.deb` 安装包。
- [x] GitHub 自动构建流水线 `.github/workflows/release.yml` 准备完毕。
- [x] 所有测试、编译及代码检查 100% 通过，推送至 GitHub。
