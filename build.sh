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

# 打印帮助信息
show_help() {
  cat << EOF
Remora 跨平台 Release 构建脚本

用法:
  ./build.sh [选项]

选项:
  --deb              构建并打包 Debian / Ubuntu (.deb) 安装包 (仅支持 Linux)
  --no-bundle        仅编译独立 Release 可执行二进制，跳过所有打包步骤 (默认)
  --all-bundles      尝试编译所有 Tauri 支持的本地安装包
  --clean            构建前清理历史 dist、target 与 release 缓存
  --help, -h         显示此帮助信息

示例:
  ./build.sh                 # 默认编译 release 二进制，输出到 release/linux_x64/
  ./build.sh --deb           # 编译二进制并打包 .deb 安装包到 release/linux_x64/
  ./build.sh --clean         # 先清理再编译
EOF
}

# 解析命令行参数
BUILD_MODE="default"
DO_CLEAN=0

while [ $# -gt 0 ]; do
  case "$1" in
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

TARGET_NAME="${OS}_${ARCH}"
RELEASE_DIR="${SCRIPT_DIR}/release/${TARGET_NAME}"

echo -e "${BOLD}${CYAN}======================================================${NC}"
echo -e "${BOLD}${CYAN}            Remora Release Builder                    ${NC}"
echo -e "${BOLD}${CYAN}======================================================${NC}"
log_info "宿主平台: ${BOLD}${RAW_OS} (${RAW_ARCH})${NC}"
log_info "目标标识: ${BOLD}${TARGET_NAME}${NC}"
log_info "发布目录: ${BOLD}${RELEASE_DIR}${NC}"
log_info "构建模式: ${BOLD}${BUILD_MODE}${NC}"
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

# 执行 Tauri Release 构建
pnpm tauri build "${TAURI_ARGS[@]}"

# ------------------------------------------------------------------------------
# 5. 归档产物至 release/${TARGET_NAME}
# ------------------------------------------------------------------------------

log_info "正在整理构建产物到 ${RELEASE_DIR}..."
mkdir -p "${RELEASE_DIR}"

BIN_NAME="remora"
if [ "$OS" = "windows" ]; then
  BIN_NAME="remora.exe"
fi

TARGET_BIN="${SCRIPT_DIR}/src-tauri/target/release/${BIN_NAME}"

if [ ! -f "$TARGET_BIN" ]; then
  log_error "未找到编译生成的二进制文件: ${TARGET_BIN}"
  exit 1
fi

# 复制主执行文件
cp -f "${TARGET_BIN}" "${RELEASE_DIR}/${BIN_NAME}"
chmod +x "${RELEASE_DIR}/${BIN_NAME}"
log_success "已归档主程序: ${RELEASE_DIR}/${BIN_NAME}"

# 收集 bundles (若存在)
BUNDLE_DIR="${SCRIPT_DIR}/src-tauri/target/release/bundle"
if [ -d "$BUNDLE_DIR" ]; then
  # 收集 deb 包
  if [ -d "${BUNDLE_DIR}/deb" ]; then
    find "${BUNDLE_DIR}/deb" -maxdepth 1 -name "*.deb" -exec cp -f {} "${RELEASE_DIR}/" \;
  fi
  # 收集 appimage (若存在)
  if [ -d "${BUNDLE_DIR}/appimage" ]; then
    find "${BUNDLE_DIR}/appimage" -maxdepth 1 -name "*.AppImage" -exec cp -f {} "${RELEASE_DIR}/" \;
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

# ------------------------------------------------------------------------------
# 6. 输出构建完成汇总报告
# ------------------------------------------------------------------------------

echo ""
echo -e "${BOLD}${GREEN}======================================================${NC}"
echo -e "${BOLD}${GREEN}            Build Succeeded!                          ${NC}"
echo -e "${BOLD}${GREEN}======================================================${NC}"
log_success "所有产物已成功生成并存放到: ${BOLD}${RELEASE_DIR}${NC}"
echo ""
echo -e "${BOLD}产物清单:${NC}"

if command -v ls &>/dev/null; then
  ls -lh "${RELEASE_DIR}"
fi

echo ""
echo -e "${BOLD}直接运行方式:${NC}"
echo -e "  ${CYAN}./release/${TARGET_NAME}/${BIN_NAME}${NC}"
echo ""
