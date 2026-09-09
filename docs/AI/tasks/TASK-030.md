# TASK-030: 移动端安全区避让与侧栏自适应修复及终端会话保活联动增强

## 1. 任务背景与目标
用户在 Android 手机真机运行 Remora 时发现两个关键问题与疑惑：
1. **手机端顶部与底部避让问题**: 手机端顶部内容（如“SSH SERVERS”头部、返回/添加按钮、终端 Tab 栏与关闭按钮）被 Android 手机系统状态栏（Header/Notch）直接压住遮挡，无法正常触控点击；同时底部也需要为手机手势导航条预留空间。此外，在手机端工作区侧边栏被桌面固定宽度（260px）限制，导致右侧出现大块空白黑边。
2. **SSH 断线重连与命令后台运行疑惑**: 用户执行命令期间若断线重连，期望了解服务器是否一直在执行命令，以及为何重连后是一个全新的空白 Terminal 无法直接接续。需要彻底解答其底层原理，并在代码层面提供会话保活（Tmux Persistence）的最佳实践与便捷操作入口。

## 2. 详细实现方案

### 2.1 Android 原生安全区 (WindowInsets) 动态注入
- 在 `src-tauri/gen/android/app/src/main/java/com/remora/app/MainActivity.kt` 中：
  - 监听根视图 `findViewById(android.R.id.content)` 的 WindowInsets。
  - 获取 `WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()` 的精确像素边距。
  - 通过 `view.updatePadding(insets.left, insets.top, insets.right, insets.bottom)` 为 WebView 动态设置上下左右外边距，彻底避开顶部状态栏/刘海与底部手势横条。
- 在 `res/values/themes.xml` 与 `res/values-night/themes.xml` 中将 `android:windowBackground` 设置为 `#181818`，使状态栏与底栏背景浑然一体。

### 2.2 前端响应式自适应优化
- 在 `SidebarContainer.tsx` 中，当 `isMobile === true` 时，去除固定 `width: sidebarWidth`（260px），自适应使用 `w-full flex-1` 占满屏幕。
- 在移动端隐藏桌面专属的侧边栏折叠 Chevron。
- 在 `src/index.css` 补充 safe-area 兼容类。

### 2.3 终端全自动安装与项目感知会话保活 (Tmux Persistence Auto-Bootstrap)
- **原理解惑**: 详尽阐释 Linux SSH 伪终端生命周期（PTY master 关闭触发内核向进程组分发 `SIGHUP` 信号导致进程退出；新连接启动全新 PTY 与 Shell）。
- **全自动检测与自愈安装 (Zero Manual Installation)**:
  - 在 `src/components/Terminal/TerminalMobileBar.tsx` 与 `src/components/Terminal/TerminalTabBar.tsx` 中：
  - 点击 `TMUX` 或桌面 `保活` 按钮时，自动静默检测远端服务器是否安装 `tmux`。
  - 若未安装，自动检测包管理器（apt-get / yum / dnf / apk / pacman），自动以 root 或 sudo 执行静默免交互安装，安装完成后立即自动拉起会话，**用户完全无需手动输入任何安装命令**！
- **项目目录感知会话命名 (Project-Aware Session Naming)**:
  - 会话名自动绑定项目目录与终端索引：`remora_${projectName}_${activeIndex}`（如 `remora_web3-chat-worker_1`）。
  - 彻底杜绝多个 Terminal Tab 镜像串线的严重漏洞，且多项目各自隔离。
- **多端抢占与尺寸自适应 (Multi-Device Takeover & Adaptive Window Size)**:
  - 启动参数配置 `-A -D`：手机与电脑跨屏切换时，新连接端自动接管会话并剔除旧端，避免手机窄屏将电脑大屏挤压成小方块。
  - 注入 `set -g mouse on` 支持手机触控上下滑动翻阅日志；注入 `set -g window-size latest` 动态响应多端尺寸。
  - 移动辅助键盘配置一键 `DETACH` 按键（`\x02d`）。

## 3. 验收标准
1. Android APK 在手机真机运行，顶部状态栏不再遮挡任何可点击组件；底部为手势横条留出合理间距。
2. 手机端工作区自适应满屏，消除右侧空缺。
3. 终端虚拟键盘具备 `TMUX` 一键保活按钮，且预置保活指令群组生效。
4. TypeScript 与 Rust 编译及 APK 构建通过。

## 4. 验证结果
- `cargo test --manifest-path src-tauri/Cargo.toml`: 24 组单元测试 + 1 组 e2e 测试全数通过。
- `pnpm tsc --noEmit`: 0 类型报错。
- `pnpm build`: 生产打包构建通过。
- `./build.sh --apk`: Android APK 成功编译输出至 `release/android/remora-app-universal-release.apk` (29MB)。
- **任务状态**: **DONE**

