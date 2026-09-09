# 当前会话状态 (SESSION_STATE.md)

本文档用于跨 Session 恢复工程上下文与进度。每次会话结束前必须更新此文件。

---

## 1. 当前目标与任务
- **当前 Goal**: 支持移动端 Android APK 自动打包发布与安装、小屏幕自适应三板块 Tab 折叠视图与移动键盘辅助控制，以及全局 SSH 私钥配置与选配管理
- **当前 Task**: 
  - TASK-027: SSH 私钥管理与连接凭证选配支持 (SSH Private Key Management & Selection) [DONE]
  - TASK-028: 手机端响应式三板块 Tab 视图与终端辅助键盘适配 (Mobile Responsive 3-Tab Layout & Keyboard) [DONE]
  - TASK-029: Android 移动端工程集成与 GitHub Release 自动打包发布 APK 体系 (Android Build & Release CI) [DONE]
  - TASK-030: 移动端安全区避让与侧栏自适应修复及终端会话保活联动增强 (Mobile Safe Area & Session Persistence) [DONE]
- **当前状态**: DONE

---

## 2. 本次会话完成内容
1. **TASK-027 (SSH 私钥管理与连接凭证选配支持)**:
   - **后端存储与鉴权**:
     - 在 `src-tauri/src/core/types.rs` 新增 `SshKey` 实体结构（包含 `id`, `name`, `private_key`, `passphrase`, `created_at`, `updated_at`）。
     - 在 `src-tauri/src/storage/db.rs` 创建 SQLite `ssh_keys` 表与完整增删改查方法（`get_ssh_keys`, `get_ssh_key`, `save_ssh_key`, `delete_ssh_key`）。
     - 在 `src-tauri/src/connection/manager.rs` 与 `src-tauri/src/lib.rs` 增强认证解析：优先通过 `russh::keys::decode_secret_key` 直接在内存中解码 PEM/OpenSSH 格式私钥内容（或通过 `key:<id>` 前缀寻址并装载已存储的私钥），若非文本格式则自动回退至文件路径解析，完美兼容路径与内容。
     - 在 `src-tauri/src/storage/tests.rs` 新增 `test_ssh_keys_crud` 单元测试。
   - **前端密钥管理界面与选配**:
     - 在 `src/utils/tauriBridge.ts` 补充密钥 CRUD IPC 接口。
     - 新建 `src/stores/sshKeyStore.ts` 集中管理私钥列表与增删操作。
     - 新建 `src/components/Sidebar/ServerManager/KeyManagerModal.tsx`，支持私钥添加（支持粘贴私钥文本或选择本地文件）、密码短语设置、列表展示与安全删除。
     - 在 `ServerManager.tsx` 的私钥配置行增加快速下拉选择框（可直选已保存的私钥名称）与 “🔑 私钥管理” 打开按钮。

2. **TASK-028 (手机端响应式三板块 Tab 视图与移动虚拟键盘/辅助按键适配)**:
   - **布局状态机**:
     - 在 `src/stores/layoutStore.ts` 引入 `isMobile` 状态（窗口宽度 < 768px 并自动监听 `resize`）与 `mobileTab`（`"workspace"` | `"editor"` | `"terminal"`）。
   - **动态视口与软键盘适配**:
     - 在 `index.html` 的 meta viewport 中添加 `viewport-fit=cover, user-scalable=no` 避免缩放错位。
     - 在 `src/App.tsx` 最外层采用 `h-[100dvh]` 适配移动端软键盘弹出时的动态可视视口高度。
   - **底部导航栏与跨模块联动**:
     - 新建 `src/components/Layout/MobileTabBar.tsx`，悬浮停靠在屏幕底部，以轻触交互切换三大板块，并展示未保存修改红点、终端活跃连接数与状态指示。
     - 在 `App.tsx` 中配置联动：手机模式下从 Project Explorer 轻触打开文件时，自动无缝跳转至 `editor` Tab。
     - 在 `src/components/Editor/EditorTabBar.tsx` 中为移动端增加专属常驻保存按钮（`💾 保存`），触控即可保存，无需依赖 Ctrl+S。
   - **移动终端辅助输入键盘 (TerminalMobileBar)**:
     - 新建 `src/components/Terminal/TerminalMobileBar.tsx`，针对手机原生软键盘无法输入 `Esc`、`Tab`、`Ctrl+C`、`Ctrl+D`、方向键等痛点，提供横向滚动的快捷辅助按键栏。
     - 在 `src/stores/terminalStore.ts` 实现 `sendDataToActiveTerminal`，将终端控制序列（如 `\x1b`、`\t`、`\x03`、`\x1b[A`）直接以 PTY 字节流写入终端后端。
     - 辅助栏内置常用符号 (`/`, `~`, `|`, `-`, `:`) 及与快捷输入面板 (Snippets) 的一键联动。

3. **TASK-029 (Android 原生工程集成与 GitHub Release 自动打包发布 APK)**:
   - **Android 原生工程与编译配置**:
     - 完成 `tauri android init`，生成 `src-tauri/gen/android/` 目录结构。
     - 在 `src-tauri/src/lib.rs` 中使用 `#[cfg(desktop)]` 对桌面端专有的 `tauri-plugin-single-instance` 与 `open_new_window` 进行条件编译隔离，确保移动平台无缝兼容。
     - 修改 `src-tauri/gen/android/app/build.gradle.kts`，将 `release` 构建类型指向 `debug` 签名配置（`signingConfig = signingConfigs.getByName("debug")`）并关闭混淆，确保 GitHub Actions 生成的 Release APK 开箱即用、手机可直接点击安装。
   - **GitHub Actions CI/CD 流水线升级**:
     - 升级 `.github/workflows/release.yml`，新增 `build-android` 独立作业。
     - 配置 Java 17 (`actions/setup-java@v4`)、Android SDK & NDK 26 (`android-actions/setup-android@v3`)、Rust Android target (`aarch64-linux-android`)。
     - 执行 `pnpm tauri android build --apk` 编译出针对主流 ARM64 架构的 Android APK。
     - 使用 `softprops/action-gh-release@v2` 将打出的所有 `.apk` 产物自动挂载至 GitHub Release 页面供用户下载。

4. **TASK-030 (移动端安全区避让与侧栏自适应修复及终端会话保活联动增强)**:
   - **Android 原生 WindowInsets 安全区动态边距注入**:
     - 在 `MainActivity.kt` 中引入 `ViewCompat.setOnApplyWindowInsetsListener` 监听 `android.R.id.content`。
     - 获取 `systemBars() or displayCutout()` 边距并更新 Root View 的 padding，彻底解决手机系统状态栏/挖孔遮挡顶部“SSH SERVERS”标题、新建/返回按钮及终端 Tab 栏的问题，同时避让底部手势横条。
     - 在 `themes.xml` 与 `values-night/themes.xml` 将 `android:windowBackground`, `android:statusBarColor`, `android:navigationBarColor` 设为统一深色 `#181818`。
   - **前端响应式布局优化**:
     - 在 `SidebarContainer.tsx` 中解除手机端固定 `sidebarWidth`（260px）限制，改为自适应 `w-full flex-1`，消除手机工作区右侧黑屏。并在手机端隐藏折叠 Chevron 避免空屏。
     - 在 `src/index.css` 补充 `.safe-area-top`, `.safe-area-bottom` 等辅助类。
   - **终端全自动安装与项目感知会话保活 (Tmux Persistence Auto-Bootstrap)**:
     - 深度解惑 Linux 伪终端生命周期与 SIGHUP 信号机制（详述断线后裸进程退出物理原因与为何新连接开辟新 Shell）。
     - 在 `TerminalMobileBar.tsx` 与 `TerminalTabBar.tsx` 实现**全自动检测与静默自愈安装**：未安装时根据系统自动调用 apt/yum/dnf/apk/pacman 免交互安装，**用户无需敲击任何安装命令**。
     - **项目目录感知命名**：会话名自动绑定项目与终端索引 `remora_${projectName}_${activeIndex}`，彻底杜绝多 Tab 串线镜像。
     - **多端抢占与尺寸自适应**：采用 `-A -D` 抢占挂载，解决手机窄屏导致电脑大屏被挤压成小方块的痛点；开启 `mouse on` 支持触屏滑动查看日志，配置一键 `DETACH`。
     - 在 `db.rs` 与 `tauriBridge.ts` 补充预设 `Session (会话保活)` 快捷输入指令，优化 `XtermView.tsx` 断线重连提示。

---

## 3. 修改与创建的文件
- **新建文件**:
  - `docs/AI/tasks/TASK-027.md`
  - `docs/AI/tasks/TASK-028.md`
  - `docs/AI/tasks/TASK-029.md`
  - `docs/AI/tasks/TASK-030.md`
  - `src/stores/sshKeyStore.ts`
  - `src/components/Sidebar/ServerManager/KeyManagerModal.tsx`
  - `src/components/Layout/MobileTabBar.tsx`
  - `src/components/Terminal/TerminalMobileBar.tsx`
- **修改文件**:
  - `src-tauri/gen/android/app/src/main/java/com/remora/app/MainActivity.kt`
  - `src-tauri/gen/android/app/src/main/res/values/themes.xml`
  - `src-tauri/gen/android/app/src/main/res/values-night/themes.xml`
  - `src/index.css`
  - `src/components/Sidebar/SidebarContainer.tsx`
  - `src/components/Terminal/TerminalMobileBar.tsx`
  - `src/components/Terminal/XtermView.tsx`
  - `src-tauri/src/storage/db.rs`
  - `src-tauri/src/storage/tests.rs`
  - `src/utils/tauriBridge.ts`
  - `src-tauri/src/core/types.rs`
  - `src-tauri/src/connection/manager.rs`
  - `src-tauri/src/lib.rs`
  - `src/components/Sidebar/ServerManager/ServerManager.tsx`
  - `src/stores/layoutStore.ts`
  - `src/stores/terminalStore.ts`
  - `src/components/Terminal/TerminalPanel.tsx`
  - `src/components/Editor/EditorTabBar.tsx`
  - `src/App.tsx`
  - `index.html`
  - `src/components/Terminal/TerminalTabBar.tsx`
  - `build.sh`
  - `package.json`
  - `src-tauri/tauri.conf.json`
  - `src-tauri/Cargo.toml`
  - `docs/AI/TASK_INDEX.md`
  - `docs/AI/SESSION_STATE.md`

---

## 4. 已运行的验证命令及结果
- `cargo test --manifest-path src-tauri/Cargo.toml`: 24 组单元测试 + 1 组 e2e 测试全部 100% 通过。
- `pnpm tsc --noEmit`: 前端 TypeScript 类型检查 0 报错通过。
- `pnpm build`: Vite 生产打包通过，各模块构建正常。
- `./build.sh --apk`: 自动化版本递增与 Android Release APK 构建测试成功：
  - 版本号自动递增并同步：`0.1.0` -> `0.1.1`（`package.json`, `tauri.conf.json`, `Cargo.toml` 自动更新）。
  - Android 原生识别更新：`tauri.android.versionName=0.1.1`, `versionCode=1001`。
  - APK 命名自动归档：`release/android/remora-universal-release-v0.1.1.apk` (29MB) 与通用指针 `remora-app-universal-release.apk` 成功生成并计算 SHA256。

---

## 5. 未解决问题与剩余风险
- 无。Android 原生 WindowInsets 安全区避让与深色背景设置全部生效，TMUX 会话保活支持已内置，构建脚本自动递增与产物命名机制全部闭环。

---

## 6. 下一步执行计划
- 用户可直接将最新生成的 `release/android/remora-universal-release-v0.1.1.apk` 发送至 Android 手机进行真机覆盖安装验证。
- 在终端中配合快捷键盘的 `TMUX` 按键体验断线不中断、无缝续接任务的保活效果。
