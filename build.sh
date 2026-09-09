#!/usr/bin/env bash
# ==============================================================================
# Remora Release Build Script
# 
# 一键生产 Release 构建与产物归档脚本
# 输出目标: release/${OS}_${ARCH} (例如: release/linux_x64)
# ==============================================================================

set -euo pipefail

# 颜色配置
if [ -t 1 ]; then
  BOLD="\033[1m"
  RED="\033[31m"
  GREEN="\033[32m"
  YELLOW="\033[33m"
  BLUE="\033[34m"
  CYAN="\033[36m"
  NC="\033[0m" # No Color
else
  BOLD=""
  RED=""
  GREEN=""
  YELLOW=""
  BLUE=""
  CYAN=""
  NC=""
fi

log_info() {
  echo -e "${BLUE}${BOLD}[INFO]${NC} $*"
}

log_success() {
  echo -e "${GREEN}${BOLD}[SUCCESS]${NC} $*"
}

log_warn() {
  echo -e "${YELLOW}${BOLD}[WARN]${NC} $*"
}

log_error() {
  echo -e "${RED}${BOLD}[ERROR]${NC} $*" >&2
}

# 确保在项目根目录下执行
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

# 提取项目版本号 (优先从 tauri.conf.json 读取，兜底从 package.json 读取)
APP_VERSION=""
if [ -f "${SCRIPT_DIR}/src-tauri/tauri.conf.json" ]; then
  APP_VERSION="$(grep '"version"' "${SCRIPT_DIR}/src-tauri/tauri.conf.json" | head -n 1 | sed -E 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/' || echo '')"
fi
if [ -z "$APP_VERSION" ] && [ -f "${SCRIPT_DIR}/package.json" ]; then
  APP_VERSION="$(grep '"version"' "${SCRIPT_DIR}/package.json" | head -n 1 | sed -E 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/' || echo '')"
fi
APP_VERSION="${APP_VERSION:-0.1.0}"

# 打印帮助信息
show_help() {
  cat << EOF
Remora 跨平台 Release 构建脚本

用法:
  ./build.sh [选项]

平台归档目录 (release/ 下清晰划分两大平台):
  - 桌面端 (Linux / Windows / macOS): release/desktop/
  - 手机端 (Android APK):             release/android/

选项:
  --apk, --android   构建 Android APK 安装包，归档到 release/android/ 目录
  --target <arch>    指定 Android 构建目标 (例如 aarch64-linux-android, 默认主流 64 位 ARM)
  --debug            构建 Debug 版本的 APK (默认构建带有内置自动签名的 Release 版 APK)
  --deb              构建并打包 Debian / Ubuntu (.deb) 安装包到 release/desktop/ (仅支持 Linux)
  --no-bundle        仅编译独立 Release 可执行二进制，跳过所有打包步骤 (默认)
  --all-bundles      尝试编译所有 Tauri 支持的本地桌面安装包
  --no-bump          不自动递增版本号 (默认每次构建自动递增 patch 修订号)
  --clean            构建前清理历史 dist、target 与 release 缓存
  --help, -h         显示此帮助信息

示例:
  ./build.sh --apk                 # 编译 Android APK，输出到 release/android/
  ./build.sh --apk --debug         # 编译带调试信息的 Debug 版 APK 到 release/android/
  ./build.sh --deb                 # 编译桌面二进制并打包 .deb 安装包到 release/desktop/
  ./build.sh                       # 默认编译桌面 release 二进制，输出到 release/desktop/
  ./build.sh --clean               # 先清理再编译
EOF
}

# 解析命令行参数
BUILD_MODE="default"
DO_CLEAN=0
DO_BUMP=1
ANDROID_TARGET=""
IS_DEBUG=0

while [ $# -gt 0 ]; do
  case "$1" in
    --apk|--android)
      BUILD_MODE="apk"
      shift
      ;;
    --target)
      ANDROID_TARGET="${2:-}"
      shift 2
      ;;
    --debug)
      IS_DEBUG=1
      shift
      ;;
    --deb)
      BUILD_MODE="deb"
      shift
      ;;
    --no-bundle)
      BUILD_MODE="no-bundle"
      shift
      ;;
    --all-bundles)
      BUILD_MODE="all-bundles"
      shift
      ;;
    --no-bump)
      DO_BUMP=0
      shift
      ;;
    --clean)
      DO_CLEAN=1
      shift
      ;;
    -h|--help)
      show_help
      exit 0
      ;;
    *)
      log_error "未知参数: $1"
      show_help
      exit 1
      ;;
  esac
done

# ------------------------------------------------------------------------------
# 0. 版本号自动递增 (默认每次构建自动递增 Patch 修订号)
# ------------------------------------------------------------------------------
if [ "$DO_BUMP" -eq 1 ]; then
  major=$(echo "$APP_VERSION" | cut -d. -f1)
  minor=$(echo "$APP_VERSION" | cut -d. -f2)
  patch=$(echo "$APP_VERSION" | cut -d. -f3)
  patch=$((patch + 1))
  NEW_VERSION="${major}.${minor}.${patch}"

  log_info "自动递增构建版本号: ${APP_VERSION} -> ${NEW_VERSION}"

  # 同步更新 package.json
  if [ -f "${SCRIPT_DIR}/package.json" ]; then
    sed -i -E 's/"version"[[:space:]]*:[[:space:]]*"[^"]+"/"version": "'"${NEW_VERSION}"'"/' "${SCRIPT_DIR}/package.json"
  fi
  # 同步更新 tauri.conf.json
  if [ -f "${SCRIPT_DIR}/src-tauri/tauri.conf.json" ]; then
    sed -i -E 's/"version"[[:space:]]*:[[:space:]]*"[^"]+"/"version": "'"${NEW_VERSION}"'"/' "${SCRIPT_DIR}/src-tauri/tauri.conf.json"
  fi
  # 同步更新 Cargo.toml
  if [ -f "${SCRIPT_DIR}/src-tauri/Cargo.toml" ]; then
    sed -i -E '0,/^version[[:space:]]*=[[:space:]]*"[^"]+"/s/^version[[:space:]]*=[[:space:]]*"[^"]+"/version = "'"${NEW_VERSION}"'"/' "${SCRIPT_DIR}/src-tauri/Cargo.toml"
  fi

  APP_VERSION="${NEW_VERSION}"
fi

# ------------------------------------------------------------------------------
# 1. 自动环境检测与补全 (Cargo / Rustup / pnpm / Node)
# ------------------------------------------------------------------------------

# 检测 Cargo / Rust
if ! command -v cargo &>/dev/null; then
  for candidate in \
    "${HOME}/.cargo/bin" \
    "${AI_ORIGINAL_HOME:-}/.cargo/bin" \
    "/usr/local/cargo/bin" \
    "/root/.cargo/bin"; do
    if [ -n "$candidate" ] && [ -x "$candidate/cargo" ]; then
      export PATH="${candidate}:${PATH}"
      break
    fi
  done
fi

# 检测 RUSTUP_HOME (查找包含有效 toolchains 的目录)
if [ -z "${RUSTUP_HOME:-}" ] || [ ! -d "${RUSTUP_HOME}/toolchains" ] || [ -z "$(ls -A "${RUSTUP_HOME}/toolchains" 2>/dev/null)" ]; then
  for r_candidate in \
    "${HOME}/.rustup" \
    "${AI_ORIGINAL_HOME:-}/.rustup" \
    "/home/$(id -un 2>/dev/null || echo '')/.rustup" \
    "/usr/local/rustup"; do
    if [ -n "$r_candidate" ] && [ -d "$r_candidate/toolchains" ] && [ -n "$(ls -A "$r_candidate/toolchains" 2>/dev/null)" ]; then
      export RUSTUP_HOME="${r_candidate}"
      break
    fi
  done
fi

# 检测 CARGO_HOME
if [ -z "${CARGO_HOME:-}" ]; then
  for c_candidate in \
    "${HOME}/.cargo" \
    "${AI_ORIGINAL_HOME:-}/.cargo" \
    "/home/$(id -un 2>/dev/null || echo '')/.cargo" \
    "/usr/local/cargo"; do
    if [ -n "$c_candidate" ] && [ -d "$c_candidate" ]; then
      export CARGO_HOME="${c_candidate}"
      break
    fi
  done
fi

# 检测 pnpm
if ! command -v pnpm &>/dev/null; then
  for p_candidate in \
    "${PNPM_HOME:-}" \
    "${HOME}/.local/share/pnpm" \
    "${AI_ORIGINAL_HOME:-}/.local/share/pnpm" \
    "${HOME}/.nvm/versions/node/$(node -v 2>/dev/null || echo '')/bin"; do
    if [ -n "$p_candidate" ] && [ -x "$p_candidate/pnpm" ]; then
      export PATH="${p_candidate}:${PATH}"
      break
    fi
  done
fi

# 检查依赖工具
MISSING_TOOLS=()
command -v pnpm &>/dev/null || MISSING_TOOLS+=("pnpm")
command -v cargo &>/dev/null || MISSING_TOOLS+=("cargo")
command -v rustc &>/dev/null || MISSING_TOOLS+=("rustc")

if [ ${#MISSING_TOOLS[@]} -ne 0 ]; then
  log_error "缺少必要构建工具: ${MISSING_TOOLS[*]}"
  echo "请确保已安装以下依赖:"
  echo "  - Rust 工具链 (cargo & rustc): https://rustup.rs"
  echo "  - Node.js 及 pnpm 包管理器: https://pnpm.io"
  exit 1
fi

# 如果是 Android APK 构建，额外检查并配置 Android 工具链
if [ "$BUILD_MODE" = "apk" ]; then
  # 检查 Java
  if ! command -v java &>/dev/null; then
    log_error "未检测到 Java 运行环境 (java)。Android 构建需要 JDK 17+。"
    echo "请安装 JDK 17，例如: sudo apt install openjdk-17-jdk"
    exit 1
  fi

  # 检测并补全 ANDROID_HOME
  if [ -z "${ANDROID_HOME:-}" ]; then
    for candidate in \
      "${HOME}/Android/Sdk" \
      "${HOME}/android-sdk" \
      "/usr/lib/android-sdk" \
      "/opt/android-sdk"; do
      if [ -d "$candidate" ]; then
        export ANDROID_HOME="$candidate"
        log_info "自动定位 Android SDK: ${ANDROID_HOME}"
        break
      fi
    done
  fi

  if [ -z "${ANDROID_HOME:-}" ] || [ ! -d "${ANDROID_HOME}" ]; then
    log_error "未检测到 Android SDK！"
    echo "请配置 ANDROID_HOME 环境变量，例如:"
    echo "  export ANDROID_HOME=\$HOME/Android/Sdk"
    exit 1
  fi

  # 检测并补全 NDK_HOME
  if [ -z "${NDK_HOME:-}" ]; then
    if [ -d "${ANDROID_HOME}/ndk" ]; then
      LATEST_NDK="$(ls -d "${ANDROID_HOME}/ndk"/* 2>/dev/null | sort -V | tail -n 1 || true)"
      if [ -n "$LATEST_NDK" ] && [ -d "$LATEST_NDK" ]; then
        export NDK_HOME="$LATEST_NDK"
        log_info "自动定位 Android NDK: ${NDK_HOME}"
      fi
    fi
  fi

  if [ -z "${NDK_HOME:-}" ] || [ ! -d "${NDK_HOME}" ]; then
    log_error "未检测到 Android NDK！"
    echo "请在 Android SDK 中安装 NDK (推荐 26.x)，或设置 NDK_HOME 环境变量:"
    echo "  export NDK_HOME=\$ANDROID_HOME/ndk/26.1.10909125"
    exit 1
  fi

  # 规范化 Android 目标架构 (Tauri 接受: aarch64, armv7, x86_64, i686)
  case "${ANDROID_TARGET:-}" in
    aarch64|aarch64-linux-android|"")
      TAURI_TARGET="aarch64"
      RUST_TARGET="aarch64-linux-android"
      ;;
    armv7|armv7-linux-androideabi)
      TAURI_TARGET="armv7"
      RUST_TARGET="armv7-linux-androideabi"
      ;;
    x86_64|x86_64-linux-android)
      TAURI_TARGET="x86_64"
      RUST_TARGET="x86_64-linux-android"
      ;;
    i686|i686-linux-android)
      TAURI_TARGET="i686"
      RUST_TARGET="i686-linux-android"
      ;;
    all)
      TAURI_TARGET=""
      RUST_TARGET="aarch64-linux-android"
      ;;
    *)
      TAURI_TARGET="${ANDROID_TARGET}"
      RUST_TARGET="${ANDROID_TARGET}"
      ;;
  esac

  # 检查 Rust target，若未安装则自动安装
  if [ -n "$RUST_TARGET" ] && ! rustup target list --installed | grep -q "^${RUST_TARGET}$"; then
    log_info "正在为 rustup 安装目标架构: ${RUST_TARGET}..."
    rustup target add "${RUST_TARGET}" || true
  fi
fi

# ------------------------------------------------------------------------------
# 2. 操作系统与 CPU 架构自动探测
# ------------------------------------------------------------------------------

RAW_OS="$(uname -s)"
RAW_ARCH="$(uname -m)"

case "$RAW_OS" in
  Linux*)               OS="linux" ;;
  Darwin*)              OS="darwin" ;;
  MINGW*|MSYS*|CYGWIN*) OS="windows" ;;
  *)                    OS="$(echo "$RAW_OS" | tr '[:upper:]' '[:lower:]')" ;;
esac

case "$RAW_ARCH" in
  x86_64|amd64) ARCH="x64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  armv7l|armhf)  ARCH="armv7" ;;
  i386|i686)     ARCH="x86" ;;
  *)             ARCH="$(echo "$RAW_ARCH" | tr '[:upper:]' '[:lower:]')" ;;
esac

if [ "$BUILD_MODE" = "apk" ]; then
  PLATFORM="android"
  TARGET_NAME="android"
  RELEASE_DIR="${SCRIPT_DIR}/release/android"
else
  PLATFORM="desktop"
  TARGET_NAME="${OS}_${ARCH}"
  RELEASE_DIR="${SCRIPT_DIR}/release/desktop"
  ARCH_RELEASE_DIR="${SCRIPT_DIR}/release/desktop/${TARGET_NAME}"
fi

echo -e "${BOLD}${CYAN}======================================================${NC}"
echo -e "${BOLD}${CYAN}            Remora Release Builder                    ${NC}"
echo -e "${BOLD}${CYAN}======================================================${NC}"
log_info "宿主平台: ${BOLD}${RAW_OS} (${RAW_ARCH})${NC}"
log_info "目标标识: ${BOLD}${TARGET_NAME}${NC}"
log_info "发布目录: ${BOLD}${RELEASE_DIR}${NC}"
log_info "构建模式: ${BOLD}${BUILD_MODE}${NC}"
if [ "$BUILD_MODE" = "apk" ]; then
  log_info "Android 架构: ${BOLD}${ANDROID_TARGET}${NC}"
  log_info "Android SDK: ${ANDROID_HOME}"
  log_info "Android NDK: ${NDK_HOME}"
fi
log_info "Rust 版本: $(rustc --version)"
log_info "Cargo 版本: $(cargo --version)"
log_info "pnpm 版本: $(pnpm --version)"
echo ""

# ------------------------------------------------------------------------------
# 3. 清理缓存 (如果指定 --clean)
# ------------------------------------------------------------------------------

if [ "$DO_CLEAN" -eq 1 ]; then
  log_info "正在清理历史构建与发布目录..."
  rm -rf dist "${RELEASE_DIR}"
  if [ "$BUILD_MODE" = "apk" ]; then
    rm -rf "${SCRIPT_DIR}/release/remora-"*.apk "${SCRIPT_DIR}/src-tauri/gen/android/app/build/outputs/apk"
  fi
  cargo clean --manifest-path src-tauri/Cargo.toml
  log_success "清理完成"
fi

# 检查 node_modules
if [ ! -d "node_modules" ]; then
  log_info "未检测到 node_modules，正在执行 pnpm install..."
  pnpm install
fi

# ------------------------------------------------------------------------------
# 4. 执行构建
# ------------------------------------------------------------------------------

# Android APK 构建独立分支
if [ "$BUILD_MODE" = "apk" ]; then
  log_info "开始构建 Remora Android APK..."

  TAURI_ANDROID_ARGS=("android" "build" "--apk")
  if [ -n "${TAURI_TARGET:-}" ]; then
    TAURI_ANDROID_ARGS+=("--target" "${TAURI_TARGET}")
  fi
  if [ "$IS_DEBUG" -eq 1 ]; then
    TAURI_ANDROID_ARGS+=("--debug")
  fi

  log_info "执行构建命令: pnpm tauri ${TAURI_ANDROID_ARGS[*]}"
  pnpm tauri "${TAURI_ANDROID_ARGS[@]}"

  # ----------------------------------------------------------------------------
  # 5. 归档 Android APK 产物至 release/android/
  # ----------------------------------------------------------------------------
  log_info "正在整理 Android APK 构建产物..."
  APK_SRC_DIR="${SCRIPT_DIR}/src-tauri/gen/android/app/build/outputs/apk"
  mkdir -p "${RELEASE_DIR}"

  FOUND_COUNT=0
  while IFS= read -r apk; do
    [ -z "$apk" ] && continue
    FOUND_COUNT=$((FOUND_COUNT + 1))
    raw_name="$(basename "$apk")"
    stem="${raw_name%.apk}"
    clean_stem="${stem#app-}"
    # 格式规范: remora-universal-release-v0.1.0.apk
    versioned_name="remora-${clean_stem}-v${APP_VERSION}.apk"
    legacy_name="remora-${raw_name}"

    # 归档到 release/android/ 专属目录 (生成带版本号的文件)
    cp -f "$apk" "${RELEASE_DIR}/${versioned_name}"
    # 同时保留兼容文件名
    cp -f "$apk" "${RELEASE_DIR}/${legacy_name}"
    log_success "已归档: release/android/${versioned_name}"
  done < <(find "${APK_SRC_DIR}" -type f -name "*.apk" 2>/dev/null || true)

  if [ "$FOUND_COUNT" -eq 0 ]; then
    log_error "未在 ${APK_SRC_DIR} 中找到生成的 APK 文件！"
    exit 1
  fi

  # 为 APK 生成 SHA-256 校验和文件
  (
    cd "${RELEASE_DIR}"
    rm -f SHA256SUMS.txt
    if command -v sha256sum &>/dev/null; then
      sha256sum *.apk > SHA256SUMS.txt 2>/dev/null || true
    elif command -v shasum &>/dev/null; then
      shasum -a 256 *.apk > SHA256SUMS.txt 2>/dev/null || true
    fi
  )

  echo ""
  echo -e "${BOLD}${GREEN}======================================================${NC}"
  echo -e "${BOLD}${GREEN}         Android APK Build Succeeded!                 ${NC}"
  echo -e "${BOLD}${GREEN}======================================================${NC}"
  log_success "所有 Android APK 已成功生成并归档至发布目录: ${BOLD}${RELEASE_DIR}${NC}"
  echo ""
  echo -e "${BOLD}产物清单 (${RELEASE_DIR}):${NC}"
  if command -v ls &>/dev/null; then
    ls -lh "${RELEASE_DIR}"
  fi
  echo ""
  echo -e "${BOLD}手机安装说明:${NC}"
  echo -e "  将上述 ${CYAN}release/android/remora-*-v${APP_VERSION}.apk${NC} 传输到安卓手机，直接点击即可安装运行！"
  echo ""
  exit 0
fi

log_info "开始构建 Remora..."

TAURI_ARGS=()

case "$BUILD_MODE" in
  deb)
    if [ "$OS" != "linux" ]; then
      log_warn "当前操作系统为 ${OS}，--deb 仅在 Linux 上生效，降级为普通 release 构建"
    else
      TAURI_ARGS+=("--bundles" "deb")
    fi
    ;;
  no-bundle)
    TAURI_ARGS+=("--no-bundle")
    ;;
  all-bundles)
    # 不传 --no-bundle，让 tauri 按照配置打包全部支持的 targets
    ;;
  default)
    # 默认执行快速 release 构建
    ;;
esac

# 检测并设置 Tauri 签名密钥
KEY_CANDIDATE="${HOME}/.tauri/remora.key"
if [ ! -f "${KEY_CANDIDATE}" ] && [ -f "/home/sean/.tauri/remora.key" ]; then
  KEY_CANDIDATE="/home/sean/.tauri/remora.key"
fi

if [ -f "${KEY_CANDIDATE}" ]; then
  export TAURI_SIGNING_PRIVATE_KEY="$(cat "${KEY_CANDIDATE}")"
  export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="${TAURI_SIGNING_PRIVATE_KEY_PASSWORD:-}"
  log_info "已载入 Tauri Updater 签名密钥: ${KEY_CANDIDATE}"
else
  TAURI_ARGS+=("--no-sign")
fi

# 执行 Tauri Release 构建
pnpm tauri build "${TAURI_ARGS[@]}"

# ------------------------------------------------------------------------------
# 5. 归档桌面端产物至 release/desktop/
# ------------------------------------------------------------------------------

log_info "正在整理桌面端构建产物到 ${RELEASE_DIR}..."
mkdir -p "${RELEASE_DIR}"
if [ -n "${ARCH_RELEASE_DIR:-}" ]; then
  mkdir -p "${ARCH_RELEASE_DIR}"
fi

BIN_NAME="remora"
if [ "$OS" = "windows" ]; then
  BIN_NAME="remora.exe"
fi

TARGET_BIN="${SCRIPT_DIR}/src-tauri/target/release/${BIN_NAME}"

if [ ! -f "$TARGET_BIN" ]; then
  log_error "未找到编译生成的二进制文件: ${TARGET_BIN}"
  exit 1
fi

# 复制主执行文件到 release/desktop/
cp -f "${TARGET_BIN}" "${RELEASE_DIR}/${BIN_NAME}"
chmod +x "${RELEASE_DIR}/${BIN_NAME}"
if [ -n "${ARCH_RELEASE_DIR:-}" ]; then
  cp -f "${TARGET_BIN}" "${ARCH_RELEASE_DIR}/${BIN_NAME}"
  chmod +x "${ARCH_RELEASE_DIR}/${BIN_NAME}"
fi
log_success "已归档主程序: ${RELEASE_DIR}/${BIN_NAME}"

# 归档带版本号的独立二进制文件
VERSIONED_BIN="remora-${TARGET_NAME}-v${APP_VERSION}"
if [ "$OS" = "windows" ]; then
  VERSIONED_BIN="remora-${TARGET_NAME}-v${APP_VERSION}.exe"
fi
cp -f "${TARGET_BIN}" "${RELEASE_DIR}/${VERSIONED_BIN}"
chmod +x "${RELEASE_DIR}/${VERSIONED_BIN}"
log_success "已归档带版本号主程序: ${RELEASE_DIR}/${VERSIONED_BIN}"

# 收集 bundles (若存在)
BUNDLE_DIR="${SCRIPT_DIR}/src-tauri/target/release/bundle"
if [ -d "$BUNDLE_DIR" ]; then
  # 收集 deb 包与签名
  if [ -d "${BUNDLE_DIR}/deb" ]; then
    find "${BUNDLE_DIR}/deb" -maxdepth 1 \( -name "*.deb" -o -name "*.sig" \) -exec cp -f {} "${RELEASE_DIR}/" \;
    if [ -n "${ARCH_RELEASE_DIR:-}" ]; then
      find "${BUNDLE_DIR}/deb" -maxdepth 1 \( -name "*.deb" -o -name "*.sig" \) -exec cp -f {} "${ARCH_RELEASE_DIR}/" \;
    fi
  fi
  # 收集 appimage (若存在)
  if [ -d "${BUNDLE_DIR}/appimage" ]; then
    find "${BUNDLE_DIR}/appimage" -maxdepth 1 -name "*.AppImage" -exec cp -f {} "${RELEASE_DIR}/" \;
    if [ -n "${ARCH_RELEASE_DIR:-}" ]; then
      find "${BUNDLE_DIR}/appimage" -maxdepth 1 -name "*.AppImage" -exec cp -f {} "${ARCH_RELEASE_DIR}/" \;
    fi
  fi
  # 收集 rpm (若存在)
  if [ -d "${BUNDLE_DIR}/rpm" ]; then
    find "${BUNDLE_DIR}/rpm" -maxdepth 1 -name "*.rpm" -exec cp -f {} "${RELEASE_DIR}/" \;
  fi
  # 收集 dmg (macOS)
  if [ -d "${BUNDLE_DIR}/dmg" ]; then
    find "${BUNDLE_DIR}/dmg" -maxdepth 1 -name "*.dmg" -exec cp -f {} "${RELEASE_DIR}/" \;
  fi
  # 收集 nsis/msi (Windows)
  if [ -d "${BUNDLE_DIR}/nsis" ]; then
    find "${BUNDLE_DIR}/nsis" -maxdepth 1 -name "*.exe" -exec cp -f {} "${RELEASE_DIR}/" \;
  fi
  if [ -d "${BUNDLE_DIR}/msi" ]; then
    find "${BUNDLE_DIR}/msi" -maxdepth 1 -name "*.msi" -exec cp -f {} "${RELEASE_DIR}/" \;
  fi
fi

# 生成 SHA-256 校验和文件
(
  cd "${RELEASE_DIR}"
  rm -f SHA256SUMS.txt
  if command -v sha256sum &>/dev/null; then
    sha256sum * > SHA256SUMS.txt
  elif command -v shasum &>/dev/null; then
    shasum -a 256 * > SHA256SUMS.txt
  fi
)
if [ -n "${ARCH_RELEASE_DIR:-}" ] && [ -d "${ARCH_RELEASE_DIR}" ]; then
  (
    cd "${ARCH_RELEASE_DIR}"
    rm -f SHA256SUMS.txt
    if command -v sha256sum &>/dev/null; then
      sha256sum * > SHA256SUMS.txt
    elif command -v shasum &>/dev/null; then
      shasum -a 256 * > SHA256SUMS.txt
    fi
  )
fi

# 保持对旧路径 release/${TARGET_NAME} 的软链接兼容
if [ ! -d "${SCRIPT_DIR}/release/${TARGET_NAME}" ] || [ -L "${SCRIPT_DIR}/release/${TARGET_NAME}" ]; then
  rm -f "${SCRIPT_DIR}/release/${TARGET_NAME}"
  ln -sf "desktop" "${SCRIPT_DIR}/release/${TARGET_NAME}"
fi

# ------------------------------------------------------------------------------
# 6. 输出构建完成汇总报告
# ------------------------------------------------------------------------------

echo ""
echo -e "${BOLD}${GREEN}======================================================${NC}"
echo -e "${BOLD}${GREEN}            Build Succeeded!                          ${NC}"
echo -e "${BOLD}${GREEN}======================================================${NC}"
log_success "所有桌面端产物已成功生成并存放到: ${BOLD}${RELEASE_DIR}${NC}"
echo ""
echo -e "${BOLD}产物清单 (${RELEASE_DIR}):${NC}"

if command -v ls &>/dev/null; then
  ls -lh "${RELEASE_DIR}"
fi

echo ""
echo -e "${BOLD}直接运行方式:${NC}"
echo -e "  ${CYAN}./release/desktop/${BIN_NAME}${NC}"
echo ""
