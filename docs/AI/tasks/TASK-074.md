# TASK-074: 修复 Android 平台 arboard 依赖条件编译并触发 GitHub Actions 全平台构建发布 (Fix arboard Android Dependency Conditional Compilation & Trigger GitHub Actions Build)

---

## 1. 任务元信息
- **Task ID**: TASK-074
- **Goal**: 跨平台自动化全量构建发布与 Android 条件编译适配 (Cross-Platform Automated Release Pipeline & Android Compatibility)
- **状态**: IN_PROGRESS
- **依赖任务**: TASK-050, TASK-065, TASK-066
- **创建时间**: 2026-09-20
- **完成时间**: 待定

---

## 2. 需求背景与问题剖析

在最近一次手动触发 GitHub Actions 流水线（`release.yml`，Run ID: 35071598097）构建 `Release Remora` 时：
1. **桌面端构建成功**：`ubuntu-22.04`（生成 Linux DEB 安装包）和 `windows-latest`（生成 Windows NSIS / MSI 安装包）顺利完成；
2. **移动端 Android 构建中断**：`build-android` 作业在编译 `aarch64-linux-android` 目标架构时，Rust 依赖库 `arboard` 报出 8 项致命错误：
   ```
   error[E0425]: cannot find type `Get` in module `platform`
   error[E0425]: cannot find type `Set` in module `platform`
   error[E0425]: cannot find type `Clear` in module `platform`
   error: could not compile `arboard` (lib) due to 8 previous errors
   ```
3. **根本原因**：`arboard` 为桌面操作系统（X11、Wayland、Win32、macOS）原生剪贴板库，官方并未实现 Android 平台支持。在 TASK-065 中引入 `arboard = "3"` 时未做 `not(target_os = "android")` 目标平台条件隔离，导致 Android APK 构建受阻。

---

## 3. 详细设计与实现方案

### 3.1 Cargo.toml 条件依赖隔离
将 `arboard` 依赖从全平台 `[dependencies]` 迁移至：
```toml
[target.'cfg(not(target_os = "android"))'.dependencies]
arboard = "3"
```
确保仅在桌面操作系统（Linux, Windows, macOS）编译 `arboard`。

### 3.2 Rust 代码层多端条件编译适配 (`src-tauri/src/lib.rs`)
针对调用 `arboard::Clipboard` 的 `read_clipboard_image_native` 命令实现双轨隔离：
1. **非 Android 平台 (`#[cfg(not(target_os = "android"))]`)**:
   保持原有桌面多端系统剪贴板原生图片提取与 PNG 编码逻辑；
2. **Android 平台 (`#[cfg(target_os = "android")]`)**:
   提供安全空实现桩（直接返回 `Ok(None)`），前端在移动端自适应回退到 HTML5 剪贴板读取，杜绝编译中断与运行时崩溃。

### 3.3 CI/CD 自动化构建触发与监控
1. 校验 GitHub CLI 活跃认证账号为 `xzsean666`；
2. 提交并推送修改至 GitHub 远端 `main` 分支；
3. 执行 `gh workflow run release.yml -f target=all` 触发 GitHub Actions 全平台（Linux + Windows + Android）自动化构建；
4. 跟踪工作流启动状态并记录 Run ID。

---

## 4. 验收标准

1. [x] `src-tauri/Cargo.toml` 中 `arboard` 仅在非 Android 平台编译依赖；
2. [x] `src-tauri/src/lib.rs` 包含 Android 平台的 `read_clipboard_image_native` 桩实现；
3. [x] 本地 `cargo check` 与 `cargo test` 42 个单元测试及 E2E 集成测试 100% 绿灯通过；
4. [x] 本地前端 `pnpm run build` 成功无类型错误；
5. [ ] 成功推送到远端并在 GitHub Actions 触发全量发布构建。
