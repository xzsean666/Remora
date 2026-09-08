# TASK-015: 自动化 Release 构建脚本 (build.sh) 与打包产物分发目录支持

本文档定义 Remora 生产 Release 构建脚本的实现规范与验证标准。

---

## 1. 任务背景与目标

- **背景**: 之前项目使用 `pnpm build` 和 `cargo build` 或 `pnpm tauri build` 进行手动编译，产物散落在 `src-tauri/target/release/` 下，没有标准化、一键化的发布归档脚本。
- **目标**: 编写根目录 `build.sh` 脚本，运行后一键自动构建前端与后端 Release 产物，并将最终可执行文件及打包安装包规整存放到 `release/${OS}_${ARCH}`（例如 `release/linux_x64`）目录，同时生成 SHA256 校验清单。

---

## 2. 详细设计与功能点

1. **环境自检与适配**:
   - 自动检测 `pnpm`、`cargo`、`rustc`。
   - 自动补充探测 `$HOME/.cargo/bin`、`RUSTUP_HOME`、`CARGO_HOME`。
   - 若环境缺失工具，输出清晰安装/排查提示并退出。
2. **架构与系统自适应**:
   - 探测系统：Linux -> `linux`, macOS -> `darwin`, Windows -> `windows`。
   - 探测架构：`x86_64` / `amd64` -> `x64`, `aarch64` / `arm64` -> `arm64`。
   - 目标目录形如：`release/linux_x64`。
3. **构建流程**:
   - 运行前端编译 (`pnpm build`)。
   - 运行 Tauri 2 Release 构建 (`pnpm tauri build`)。
   - 支持 `--deb` 打包 Debian 安装包。
   - 支持 `--no-bundle` 仅编译独立可执行二进制。
   - 支持 `--clean` 清理历史构建缓存。
4. **产物归档与校验**:
   - 创建 `release/${TARGET_NAME}/` 目录。
   - 复制主程序二进制 `remora`（并确保可执行权限）。
   - 复制已生成的安装包（如 `bundle/deb/*.deb`）。
   - 生成 `SHA256SUMS.txt` 校验和文件。
   - 彩色打印构建成功报告，输出文件大小与运行命令。

---

## 3. 允许修改的文件范围

- `build.sh` (新建)
- `docs/AI/tasks/TASK-015.md` (新建)
- `docs/AI/TASK_INDEX.md` (更新)
- `docs/AI/SESSION_STATE.md` (更新)

---

## 4. 验收标准

1. `build.sh` 文件在仓库根目录且有可执行权限。
2. 运行 `./build.sh` 能够成功执行并输出到 `release/linux_x64/`。
3. `release/linux_x64/remora` 二进制存在且可执行。
4. `release/linux_x64/SHA256SUMS.txt` 存在且校验通过。
