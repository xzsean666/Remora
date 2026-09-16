# TASK-066: 优化 build.sh release 构建归档逻辑 (按需精准产物归档、去重与清理)

## 1. 任务信息
- **ID**: TASK-066
- **状态**: DONE
- **目标**: 优化 `build.sh` 构建归档逻辑，彻底解决 `release/` 目录下大量重复文件与历史版本堆积问题；实现 `--deb` 构建模式下仅输出当前版本的 `.deb` 安装包与校验和，杜绝冗余二进制拷贝与嵌套双份目录。

---

## 2. 背景与核心痛点
1. **构建物物理双重复制**: 脚本中设置了 `ARCH_RELEASE_DIR="release/desktop/${TARGET_NAME}"`，将主二进制、所有 bundle、AppImage、校验和在 `release/desktop/` 和 `release/desktop/linux_x64/` 完整复制两遍，白白浪费 250MB+ 空间；
2. **模式与产物未解耦**: 用户指定 `--deb` 构建 deb 安装包时，脚本仍然无条件向 `release/desktop/` 拷贝两份 30MB 的未打包独立二进制（`remora` 和 `remora-linux_x64-v*`）；
3. **历史版本全量遍历拷贝**: 归档 bundle 时使用 `find "${BUNDLE_DIR}/deb" -maxdepth 1 -name "*.deb"`，未对版本号进行过滤，导致从 0.1.11 到 0.1.23 的所有 12 个历史版本的 deb 以及过去的 AppImage 被全量重复拷贝到 `release/desktop/`；
4. **Android APK 重复拷贝**: 每次构建 APK 时同时拷贝版本号命名的 APK 与无版本号的 legacy APK，产生两份完全一致的 30MB APK；
5. **发布目录极度膨胀**: 整个 `release/` 目录累积达近 900MB，存在严重冗余。

---

## 3. 核心实现策略
1. **模式化产物归档解耦**:
   - `deb` 模式：构建前清理 `target/release/bundle/deb`，编译后仅归档当前版本的 `Remora_${APP_VERSION}_*.deb` 及 `.sig`，不再拷贝 `remora` 独立二进制；
   - `no-bundle` / 默认二进制模式：仅归档独立二进制 `remora`，带版本号的别名通过软链接创建，不产生双份物理文件；
   - `windows` / `mac` 模式：仅归档对应原生安装包；
   - `apk` 模式：仅归档当前版本的 `remora-*-v${APP_VERSION}.apk`。
2. **彻底废除 `ARCH_RELEASE_DIR`**:
   - 移除 `release/desktop/linux_x64` 重复物理子目录；
   - 保留根路径软链接 `release/linux_x64 -> desktop`，维持旧路径兼容性。
3. **版本精准匹配与历史清理**:
   - 收集 bundle 时严格按 `*_${APP_VERSION}_*` 匹配；
   - 在归档前清理目标发布目录中的旧版本与异构残留物，确保目录纯净。

---

## 4. 验收标准
- [x] `./build.sh --deb --no-bump` 仅归档当前版本的 deb 包与 `SHA256SUMS.txt` 到 `release/desktop/`；
- [x] `release/desktop/` 下无独立二进制 `remora` 及 `remora-linux_x64-v*`；
- [x] `release/desktop/` 下无 `linux_x64` 嵌套重复目录；
- [x] `release/desktop/` 下无历史旧版本 deb 堆积；
- [x] `release/android/` 仅保留单一规范版本命名的 APK；
- [x] 实际执行构建并验证产物大小与列表（release 目录整体体积由 904MB 优化缩减至 41MB，deb 构建输出 100% 纯净）。
