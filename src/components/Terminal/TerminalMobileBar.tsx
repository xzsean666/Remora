import React, { useState } from "react";
import { Zap } from "lucide-react";
import { useTerminalStore } from "../../stores/terminalStore";
import { useFileTreeStore } from "../../stores/fileTreeStore";

interface TerminalMobileBarProps {
  onToggleSnippets?: () => void;
}

export const TerminalMobileBar: React.FC<TerminalMobileBarProps> = ({ onToggleSnippets }) => {
  const { sessions, activeSessionId, sendDataToActiveTerminal } = useTerminalStore();
  const { rootPath } = useFileTreeStore();
  const [isCtrlActive, setIsCtrlActive] = useState(false);
  const [isAltActive, setIsAltActive] = useState(false);

  const activeIndex = sessions.findIndex((s) => s.id === activeSessionId) + 1 || 1;
  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const rawProject = (activeSession?.initialDir || rootPath || "").split("/").filter(Boolean).pop() || "main";
  const projectName = rawProject.replace(/[^a-zA-Z0-9_-]/g, "_");
  const tmuxSessionName = `remora_${projectName}_${activeIndex}`;

  const sendKey = (str: string) => {
    if (isCtrlActive && str.length === 1) {
      const code = str.toUpperCase().charCodeAt(0);
      if (code >= 64 && code <= 95) {
        // Control character: @=0, A=1, B=2, ..., Z=26
        sendDataToActiveTerminal([code - 64]);
      } else {
        sendDataToActiveTerminal(str);
      }
      setIsCtrlActive(false);
      return;
    }

    if (isAltActive && str.length === 1) {
      sendDataToActiveTerminal("\x1b" + str);
      setIsAltActive(false);
      return;
    }

    sendDataToActiveTerminal(str);
  };

  const handleTmuxAutoBootstrap = () => {
    const cmd = `if ! command -v tmux >/dev/null 2>&1; then printf "\\r\\n\\033[36m[Remora] 服务器未安装 tmux，正在为您全自动安装...\\033[0m\\r\\n"; if command -v apt-get >/dev/null 2>&1; then (which sudo >/dev/null 2>&1 && sudo apt-get update -qq && sudo apt-get install -y tmux) || (apt-get update -qq && apt-get install -y tmux); elif command -v yum >/dev/null 2>&1; then (which sudo >/dev/null 2>&1 && sudo yum install -y tmux) || yum install -y tmux; elif command -v dnf >/dev/null 2>&1; then (which sudo >/dev/null 2>&1 && sudo dnf install -y tmux) || dnf install -y tmux; elif command -v apk >/dev/null 2>&1; then (which sudo >/dev/null 2>&1 && sudo apk add tmux) || apk add tmux; elif command -v pacman >/dev/null 2>&1; then (which sudo >/dev/null 2>&1 && sudo pacman -Sy --noconfirm tmux) || pacman -Sy --noconfirm tmux; fi; fi; if command -v tmux >/dev/null 2>&1; then tmux new -A -D -s ${tmuxSessionName} \\; set -g mouse on \\; set -g window-size latest; else printf "\\033[31m[Remora] 自动安装失败，请检查服务器网络或权限。\\033[0m\\r\\n"; fi\n`;
    sendDataToActiveTerminal(cmd);
  };

  const keys: { label: string; action: () => void; active?: boolean; highlight?: boolean; title?: string }[] = [
    {
      label: "TMUX",
      action: handleTmuxAutoBootstrap,
      highlight: true,
      title: `一键保活（未检测到则全自动安装，独占挂载 ${tmuxSessionName} 避免多端挤压，并开启触控滚屏）`,
    },
    {
      label: "DETACH",
      action: () => sendDataToActiveTerminal("\x02d"), // Ctrl+B then d
      title: "安全脱离 Tmux 会话返回普通终端 (后台命令继续运行)",
    },
    {
      label: "ESC",
      action: () => sendDataToActiveTerminal("\x1b"),
      highlight: true,
    },
    {
      label: "TAB",
      action: () => sendDataToActiveTerminal("\t"),
      highlight: true,
    },
    {
      label: "CTRL",
      action: () => setIsCtrlActive(!isCtrlActive),
      active: isCtrlActive,
    },
    {
      label: "ALT",
      action: () => setIsAltActive(!isAltActive),
      active: isAltActive,
    },
    {
      label: "^C",
      action: () => sendDataToActiveTerminal([3]), // Ctrl+C (ETX)
      highlight: true,
    },
    {
      label: "^D",
      action: () => sendDataToActiveTerminal([4]), // Ctrl+D (EOT)
    },
    {
      label: "^Z",
      action: () => sendDataToActiveTerminal([26]), // Ctrl+Z (SUB)
    },
    {
      label: "↑",
      action: () => sendDataToActiveTerminal("\x1b[A"),
    },
    {
      label: "↓",
      action: () => sendDataToActiveTerminal("\x1b[B"),
    },
    {
      label: "←",
      action: () => sendDataToActiveTerminal("\x1b[D"),
    },
    {
      label: "→",
      action: () => sendDataToActiveTerminal("\x1b[C"),
    },
    {
      label: "/",
      action: () => sendKey("/"),
    },
    {
      label: "~",
      action: () => sendKey("~"),
    },
    {
      label: "|",
      action: () => sendKey("|"),
    },
    {
      label: "-",
      action: () => sendKey("-"),
    },
    {
      label: ":",
      action: () => sendKey(":"),
    },
  ];

  return (
    <div className="h-9 px-1.5 bg-[#252526] border-t border-b border-vscode-border flex items-center justify-between text-xs select-none flex-shrink-0 z-30">
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-1 flex-1">
        {keys.map((k) => (
          <button
            key={k.label}
            type="button"
            title={k.title || k.label}
            onClick={k.action}
            className={`min-w-[34px] h-7 px-2 rounded flex items-center justify-center font-mono text-[11px] font-medium transition-all active:scale-95 flex-shrink-0 shadow-xs ${
              k.active
                ? "bg-amber-500 text-black font-bold ring-1 ring-amber-300"
                : k.highlight
                ? "bg-[#333333] hover:bg-[#3e3e3e] text-amber-300 border border-[#444444]"
                : "bg-[#2d2d2d] hover:bg-[#383838] text-vscode-textBright border border-[#3e3e3e]"
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>

      {onToggleSnippets && (
        <button
          type="button"
          onClick={onToggleSnippets}
          title="Toggle Quick Snippets"
          className="ml-1 px-2 h-7 rounded bg-[#333333] hover:bg-[#3e3e3e] text-amber-400 border border-[#444444] flex items-center gap-1 text-[11px] font-medium flex-shrink-0"
        >
          <Zap className="w-3 h-3 fill-amber-400" />
          <span className="hidden xs:inline">Quick</span>
        </button>
      )}
    </div>
  );
};
