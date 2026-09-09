#!/usr/bin/env bash
# ==============================================================================
# Remora Desktop Entry Register Script
# 将 Remora 注册到本地 Ubuntu / GNOME 桌面环境，立即可在 Ubuntu Dock 右键新建窗口
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN_PATH="${SCRIPT_DIR}/release/desktop/remora"
if [ ! -f "${BIN_PATH}" ]; then
  BIN_PATH="${SCRIPT_DIR}/release/linux_x64/remora"
fi
if [ ! -f "${BIN_PATH}" ]; then
  BIN_PATH="${SCRIPT_DIR}/src-tauri/target/release/remora"
fi

ICON_SRC="${SCRIPT_DIR}/src-tauri/icons/128x128.png"
ICON_DEST_DIR="${HOME}/.local/share/icons/hicolor/128x128/apps"
DESKTOP_DEST_DIR="${HOME}/.local/share/applications"

mkdir -p "${ICON_DEST_DIR}" "${DESKTOP_DEST_DIR}"

if [ -f "${ICON_SRC}" ]; then
  cp -f "${ICON_SRC}" "${ICON_DEST_DIR}/remora.png"
fi

cat > "${DESKTOP_DEST_DIR}/remora.desktop" << EOF
[Desktop Entry]
Name=Remora
Comment=Lightweight SSH Remote Workspace Desktop Client
Exec=${BIN_PATH} %U
Icon=remora
Terminal=false
Type=Application
StartupWMClass=remora
Categories=Development;IDE;
Actions=new-window;

[Desktop Action new-window]
Name=New Window
Name[zh_CN]=新建窗口
Exec=${BIN_PATH} --new-window %U
Icon=remora
EOF

chmod +x "${DESKTOP_DEST_DIR}/remora.desktop"

# 更新桌面数据库
if command -v update-desktop-database &>/dev/null; then
  update-desktop-database "${DESKTOP_DEST_DIR}" || true
fi

echo "✅ Remora 桌面启动器已成功安装至: ${DESKTOP_DEST_DIR}/remora.desktop"
echo "   现在可在 Ubuntu 应用中心搜索 Remora，或在 Dock 图标右键选择「新建窗口」！"
