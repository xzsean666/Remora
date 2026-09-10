# TASK-038: 修复前端全局对象报错 [object Object] 与同步移动端原生应用图标

## 任务元数据
- **任务 ID**: TASK-038
- **任务名称**: 修复前端全局对象报错 [object Object] 与同步移动端原生应用图标 (Fix Global [object Object] Error Formatting & Sync Android Mobile App Icons)
- **创建时间**: 2026-09-10
- **依赖任务**: TASK-029, TASK-036, TASK-037
- **状态**: DONE

---

## 1. 缺陷背景与根因分析

在开发与测试过程中，用户反馈两项显著缺陷：

1. **报错呈现 `[object Object]`，无法获知真实错误原因**:
   - **Rust 后端序列化机制**: 后端核心异常枚举 `AppError` 采用 `#[derive(Serialize)]`。Serde 默认将带有负载的 enum variant（例如 `AppError::Connection(msg)`、`AppError::Database(msg)`、`AppError::Sftp(msg)` 等）序列化为单字段 JSON 对象，形如 `{"Connection": "..."}`。
   - **前端异常消费机制**: 当 Tauri 命令调用失败时，前端 Promise rejection 获得的是该原生 JSON 对象。前端多处代码使用 `String(err)`、`${err}` 或 `(err?.message || err)`。由于该普通对象没有 `.message` 属性，且未实现自定义 `toString()`，强转为字符串时均被 JS 引擎统一转为 `"[object Object]"`。
   - **影响范围**: SSH 连接失败、目录打开与遍历失败、终端启动失败、版本更新检测失败、快捷指令保存失败等所有关键流程。

2. **手机端应用图标与桌面端不一致**:
   - **原生模板遗留**: `src-tauri/gen/android/app/src/main/res/` 仍包含 Tauri 初始化 Android 原生工程时写入的默认蓝黄环形图标 (`mipmap-*/ic_launcher.png`) 以及 Android Studio 模板遗留的绿色机器人图标 (`drawable/` 与 `drawable-v24/`)。
   - **自适应图标与资源同步缺失**: 尽管项目在 `src-tauri/icons/android/` 生成了 Remora 终端专属图标，但没有同步部署到原生构建工程的资源目录中，且自适应图标背景未与 Remora 暗黑主题对齐。

---

## 2. 改造方案

1. **后端 `AppError` 错误序列化重构**:
   - 为 `AppError` 实现自定义 `Serialize`，利用 `thiserror` 提供的 `Display` 实现直接将异常序列化为结构化、人类可读的字符串，如 `"SSH connection error: Connection refused"`。
2. **前端全局错误格式化器 `formatErrorMessage`**:
   - 在 `src/utils/tauriBridge.ts` 中实现通用的 `formatErrorMessage(err: unknown): string`。
   - 能够解析：普通字符串、标准 `Error` 实例、Rust enum 单键对象 (`{ Connection: "..." }`)、带有 `message`/`error`/`details` 的对象、以及任意未知 JS 对象的 JSON 序列化降级。
   - 在 `safeInvoke` 中统一拦截并重抛具备友好 `message` 与自定义 `toString()` 的 Error 对象，确保直接调用 `String(err)` 或 `${err}` 也绝不会输出 `[object Object]`。
   - 全局替换 `ProjectExplorer`、`ServerManager`、`XtermView`、`editorStore`、`fileTreeStore`、`connectionStore` 等各处的错误处理。
3. **Android 移动端图标全量替换与自适应规范化**:
   - 将 `src-tauri/icons/android/` 下的各 DPI 图标（`mipmap-mdpi`, `mipmap-hdpi`, `mipmap-xhdpi`, `mipmap-xxhdpi`, `mipmap-xxxhdpi`）同步至 `src-tauri/gen/android/app/src/main/res/`。
   - 清理删除遗留的 `drawable/ic_launcher_background.xml` 与 `drawable-v24/ic_launcher_foreground.xml` 机器人矢量图。
   - 创建 `mipmap-anydpi-v26/ic_launcher.xml` 与 `mipmap-anydpi-v26/ic_launcher_round.xml`，背景色配置为 `#181820`（Remora 专属终端深色），前景图引用 Remora 终端图标。
   - 更新 `AndroidManifest.xml`，配置 `android:roundIcon="@mipmap/ic_launcher_round"`。
   - 在 `build.sh` 中增加移动端图标自动同步钩子，防止原生目录重建导致图标回退。

---

## 3. 验收标准与验证结果

1. **错误格式化全面生效**:
   - 后端增加单元测试 `test_app_error_serialization_as_string`，验证 `AppError::Connection` 与 `AppError::Database` 序列化为规范 JSON 字符串（通过）。
   - 前端增加针对 `formatErrorMessage` 的各种场景测试（null, undefined, string, Error 实例, Serde enum 对象, JSON 降级, null prototype 对象），全部通过。
   - 前端所有 catch、alert 与终端报错输出已全量替换为 `formatErrorMessage`。
2. **Android 移动端原生图标 100% 同步**:
   - `gen/android/app/src/main/res/` 下的所有 mipmap 图标均已替换为 Remora 品牌深色终端图标。
   - `mipmap-anydpi-v26/ic_launcher.xml` 与 `ic_launcher_round.xml` 均已就绪，背景颜色对齐 `#181820`。
   - 彻底清理删除旧模板中的绿色机器人矢量资源。
3. **全工程构建验证**:
   - `pnpm build`: 100% 成功，TS 静态检查 0 错误。
   - `cargo check --manifest-path src-tauri/Cargo.toml`: 100% 编译成功。
   - `cargo test --manifest-path src-tauri/Cargo.toml`: 26 项单元测试 + 1 项 E2E 测试全数通过。
