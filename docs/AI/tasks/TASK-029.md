# TASK-029: Android 移动端工程集成与 GitHub Release 自动打包发布 APK 体系 (Android Build & Release CI Workflow)

---

## 1. 任务背景与目标

用户希望将 Remora 拓展至移动端，能够为 Android 手机用户生成可直接安装的 `.apk` 安装包，并在后续每次 GitHub Release 发布版本时自动编译并发布 Android APK。

本任务目标：
1. **Tauri 2 Android 原生工程集成**:
   - 使用 `tauri android init` 初始化 Android 原生工程骨架（位于 `src-tauri/gen/android/`）。
   - 配置 `AndroidManifest.xml`，确立网络权限 (`android.permission.INTERNET`) 与 SingleTask 启动模式。
   - 配置 `src-tauri/gen/android/app/build.gradle.kts`：为 Release 打包配置标准签名（fallback 至 debug 签名以确保生成的 APK 无需繁琐手动配签即可直接在各款 Android 手机上安装）。
2. **后端移动端平台兼容性守卫**:
   - 在 `src-tauri/src/lib.rs` 中为桌面端专属插件（如 `tauri-plugin-single-instance`）以及多窗口创建函数 (`open_new_window`) 添加 `#[cfg(desktop)]` 条件编译守卫，避免在 Android 交叉编译中引发缺失或符号冲突。
3. **GitHub Actions 自动化 Release APK 发布流水线**:
   - 在 `.github/workflows/release.yml` 新增 `build-android` 独立构建任务。
   - 自动在 GitHub Actions 运行机上配置 Java 17 (`actions/setup-java@v4`)、Android SDK 与 NDK 26 (`android-actions/setup-android@v3`)，以及 Android 常用 Rust 交叉编译目标架构 (`aarch64-linux-android, armv7-linux-androideabi, x86_64-linux-android, i686-linux-android`)。
   - 自动调用 `pnpm tauri android build --apk` 编译产出 Universal 及各架构 APK。
   - 使用 `softprops/action-gh-release@v2` 将生成的 APK 自动关联并上传至对应的 GitHub Release 资产中，实现“代码打 tag 发布即自动出 APK”。

---

## 2. 验收标准

1. `src-tauri/gen/android` 工程文件完整，Gradle 配置无误。
2. 后端代码包含移动端编译安全条件编译守卫，`cargo check` 与 `cargo test` 正常通过。
3. `.github/workflows/release.yml` 包含完整的 `build-android` 任务定义与资产上传逻辑。
4. Release 说明文档同步包含 Android APK 下载与安装指引。

---

## 3. 状态与验证结果

- **状态**: **DONE**
- **验证结果**:
  - `src-tauri/gen/android` 生成并校准，Gradle 配置 `signingConfig` 满足直接安装需求。
  - `cargo check --manifest-path src-tauri/Cargo.toml`: 0 错误 0 告警通过。
  - `.github/workflows/release.yml` 配置经语法与流程静态校验正确。
