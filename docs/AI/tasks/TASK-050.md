# TASK-050: Android Release 持久化签名 Keystore 与 GitHub Actions 自动化一致性签名升级 (Android Persistent Release Keystore & Seamless Upgrade Workflow)

## 任务元数据
- **任务 ID**: TASK-050
- **任务名称**: Android Release 持久化签名 Keystore 与 GitHub Actions 自动化一致性签名升级 (Android Persistent Release Keystore & Seamless Upgrade Workflow)
- **创建时间**: 2026-09-12
- **依赖任务**: TASK-048, TASK-049
- **状态**: DONE

---

## 1. 任务背景与核心痛点

用户在手机端安装并使用 Remora Android APK 后，当后续通过 GitHub Actions 打包发布新版本时，遭遇了 Android 应用签名冲突问题（`INSTALL_FAILED_UPDATE_INCOMPATIBLE`）：
1. **默认 Debug Keystore 不一致**:
   - 之前 Android Gradle 打包默认使用 `signingConfigs.getByName("debug")`；
   - 每次 GitHub Actions 虚拟机启动时，都会动态生成全新的 Android 调试证书，导致每次 Release 出产的 APK 签名公钥各不相同；
   - 用户手机在安装新版本 APK 时，Android 系统检测到签名证书不一致直接拒绝覆盖安装，用户被迫每次升级都必须先卸载旧版本（丢失所有会话和本地配置），严重影响移动端使用体验。
2. **需要统一的持久化签名与 CI/CD 自动化集成**:
   - 需要在本地生成终身有效（~28 年）的专用 Release 签名证书（`remora-release.keystore`）；
   - 将签名凭据安全留存在本地 `.env` 并提供 `.env.example` 模板，同时加入 `.gitignore` 杜绝泄露；
   - 通过 `gh secret set` 将 Base64 编码的 Keystore 及口令同步到 GitHub 仓库 Secrets；
   - 升级 `src-tauri/gen/android/app/build.gradle.kts` 与 `.github/workflows/release.yml`，使得本地 `./build.sh --apk` 与云端 GitHub Actions 自动化打包均使用同一签名体系，实现手机免卸载、无缝原位升级。

---

## 2. 解决方案与实施步骤

### 2.1 生成专属 Android Release Keystore
- 使用 Java `keytool` 工具生成 2048 位 RSA 专用证书：
  ```bash
  keytool -genkeypair -v \
    -keystore remora-release.keystore \
    -alias remora \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=Remora, OU=Remora Team, O=Remora, L=Internet, ST=Global, C=US"
  ```
  - 有效期至 2054 年（10,000 天）；
  - SHA256 证书指纹：`41:84:35:B8:3B:8E:A3:9D:56:BB:03:AF:06:A5:70:3E:34:F3:52:4C:B5:BB:8D:19:C2:A4:D4:83:80:C2:AE:AA`。

### 2.2 本地环境与防泄露机制
- 在 `.env` 中保存完整签名参数：
  - `ANDROID_KEYSTORE_PATH=./remora-release.keystore`
  - `ANDROID_KEY_ALIAS=remora`
  - `ANDROID_KEYSTORE_PASSWORD=<secret_password>`
  - `ANDROID_KEY_PASSWORD=<secret_password>`
  - `ANDROID_KEYSTORE_BASE64=<base64_encoded_content>`
- 创建标准模板 `.env.example`；
- 更新根目录 `.gitignore`，将 `.env`, `.env.*`, `*.keystore`, `*.jks` 严格忽略，保证密钥安全。

### 2.3 Gradle 动态签名配置
- 在 [src-tauri/gen/android/app/build.gradle.kts](file:///ssd0/git/Remora/src-tauri/gen/android/app/build.gradle.kts) 中新增 `signingConfigs.create("release")`：
  - 动态优先从环境变量 `ANDROID_KEYSTORE_PATH`、`ANDROID_KEYSTORE_PASSWORD`、`ANDROID_KEY_ALIAS`、`ANDROID_KEY_PASSWORD` 读取凭据；
  - 若检测到有效 Keystore 文件与密码则启用正式签名，否则优雅降级为 debug 签名；
  - 将 `buildTypes.getByName("release").signingConfig` 绑定为 `signingConfigs.getByName("release")`。
- 在 [build.sh](file:///ssd0/git/Remora/build.sh) 中新增启动时自动 `source .env`，并在执行 `--apk` 时友好提示检测到持久化 Release 签名已启用。

### 2.4 GitHub Actions 云端流水线全自动注入
- 使用 GitHub CLI (`gh secret set`) 为 `xzsean666/Remora` 仓库配置 4 项云端安全凭据：
  - `ANDROID_KEYSTORE_BASE64`
  - `ANDROID_KEYSTORE_PASSWORD`
  - `ANDROID_KEY_ALIAS`
  - `ANDROID_KEY_PASSWORD`
- 在 [.github/workflows/release.yml](file:///ssd0/git/Remora/.github/workflows/release.yml) 的 `build-android` 作业中新增签名解密注入步骤：
  - 在执行构建前检测 `secrets.ANDROID_KEYSTORE_BASE64`；
  - 动态将 Base64 解码至 `${{ runner.temp }}/remora-release.keystore` 并注入环境变量，使云端流水线产出的 APK 与本地完全享有同一数字指纹。

---

## 3. 验收与验证结果
1. **Keystore 解密与指纹校验**: 验证 base64 经流式解码后证书链完整，指纹与原版一致。
2. **Gradle 任务评估**: `./gradlew help` 成功解析新 `signingConfigs` 语法与 release 配置，BUILD SUCCESSFUL。
3. **TypeScript 与项目构建**: `pnpm tsc --noEmit` 0 错误通过。
4. **GitHub Secrets 配置**: `gh secret list` 确认 4 项凭据全部更新且生效。
