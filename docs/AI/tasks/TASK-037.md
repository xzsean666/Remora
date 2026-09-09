# TASK-037: 修复 GitHub Actions Release 自动构建与发布失败

## 任务元数据
- **任务 ID**: TASK-037
- **任务名称**: 修复 GitHub Actions Release 自动构建与发布失败 (Fix GitHub Actions Release Workflow Failure)
- **创建时间**: 2026-09-09
- **依赖任务**: TASK-021, TASK-029
- **状态**: IN_PROGRESS

---

## 1. 缺陷背景与根因分析

在进行安装包正式发布时，GitHub Actions 工作流 `.github/workflows/release.yml` 执行失败。经完整排查，发现以下 5 个关键问题：

1. **Updater 私钥缺失阻断构建 (Fatal)**:
   - `src-tauri/tauri.conf.json` 中配置了 `createUpdaterArtifacts: true` 以及 Updater `pubkey`。
   - 在 GitHub Actions 执行 `tauri-action` 时，若仓库 Secrets 未配置 `TAURI_SIGNING_PRIVATE_KEY`，Tauri CLI 在打包 `.deb` 后尝试生成更新器签名文件时报错：
     `Error: A public key has been found, but no private key. Make sure to set TAURI_SIGNING_PRIVATE_KEY environment variable.`
     导致整个流程以退出码 1 崩溃。
2. **AppImage 构建依赖缺失**:
   - `matrix.args` 包含了 `--bundles deb,appimage`。
   - GitHub Actions 的 `ubuntu-22.04` 镜像默认未安装 `libfuse2`，当 Tauri 打包 AppImage 调用内部的 `linuxdeploy-x86_64.AppImage` 时，因找不到 `libfuse.so.2` 导致打包失败。
3. **workflow_dispatch 手动触发标签错乱**:
   - 工作流原先直接采用 `tagName: ${{ github.ref_name }}`。
   - 当用户在 GitHub 网页手动点击 `workflow_dispatch` 时，`github.ref_name` 为分支名 `'main'`，导致 Action 尝试创建名为 `'main'` 的 Release 标签，引发 Git ref 冲突或非法版本号错误，用户输入的 `inputs.version` 完全被忽略。
4. **Android 任务标签不匹配与版本号意外递增**:
   - 在 `build-android` 中，`tag_name: ${{ github.ref_name || inputs.version }}` 由于 `'main'` 在表达式中为真值，导致始终解析为 `'main'`，未能继承桌面端实际创建的 Release Tag。
   - `build.sh --apk` 默认 `DO_BUMP=1`，在 CI 中直接调用会导致版本号被自动自增为下一修订号（如 `0.1.8` 变为 `0.1.9`），导致生成的 APK 文件名与当前 Release Tag 错位。
5. **NDK 重复下载低效**:
   - GitHub Actions Runner 本身已包含 Android NDK 预置环境，无条件通过 sdkmanager 重新拉取会浪费大量构建时间。

---

## 2. 详细改造方案

1. **版本与标签智能统一解析**:
   - 增加 `Determine Version and Tag` 步骤：
     - 若为 `workflow_dispatch`，优先使用 `inputs.version`，若为空则自动读取 `package.json` 中的 `version` 并补全 `v` 前缀。
     - 若为 `push` 标签，使用 `github.ref_name`。
     - 暴露 `release_tag` 作为 job outputs，供 `build-android` 消费，确保全平台产物统一。
2. **签名私钥容灾保护**:
   - 若 `secrets.TAURI_SIGNING_PRIVATE_KEY` 为空，自动向 `tauri build` 追加 `--no-sign`，并设置 `includeUpdaterJson: false`；
   - 若用户在仓库中配置了私钥 Secret，则自动启用签名并生成更新器产物。
3. **补全 Linux 基础依赖**:
   - 在 `apt-get` 步骤中增加 `libfuse2` 与 `file`，并支持 `libfuse2t64` 降级，彻底解决 AppImage 构建依赖问题。
4. **Android 构建与发布修复**:
   - 调用 `./build.sh --apk --no-bump`，杜绝 CI 环境中自动递增版本号。
   - `build-android` 消费 `needs.build-and-release.outputs.release_tag` 作为上传的 Release 标签。
   - 优先检测并复用已有 NDK。
5. **build.sh 环境变量增强**:
   - 支持直接从环境变量读取 `TAURI_SIGNING_PRIVATE_KEY`。

---

## 3. 验收标准
1. `release.yml` 语法 100% 正确无误。
2. 本地验证 `--no-sign` 情况下 `.deb` 包正常构建。
3. 本地与 CI 逻辑对齐，版本号统一。
4. 文档与状态流转记录完毕。
