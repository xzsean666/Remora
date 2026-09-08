import React, { useState } from "react";
import { Zap } from "lucide-react";
import { useTerminalStore } from "../../stores/terminalStore";

interface TerminalMobileBarProps {
  onToggleSnippets?: () => void;
}

export const TerminalMobileBar: React.FC<TerminalMobileBarProps> = ({ onToggleSnippets }) => {
  const { sendDataToActiveTerminal } = useTerminalStore();
  const [isCtrlActive, setIsCtrlActive] = useState(false);
  const [isAltActive, setIsAltActive] = useState(false);

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

  const keys: { label: string; action: () => void; active?: boolean; highlight?: boolean }[] = [
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
