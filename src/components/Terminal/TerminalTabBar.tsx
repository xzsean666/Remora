import React from "react";
import { Terminal, Plus, X, Globe, RotateCcw, Zap, Shield } from "lucide-react";
import { useTerminalStore } from "../../stores/terminalStore";
import { useFileTreeStore } from "../../stores/fileTreeStore";
import { useConnectionStore } from "../../stores/connectionStore";
import { useLayoutStore } from "../../stores/layoutStore";

interface TerminalTabBarProps {
  isQuickBarOpen?: boolean;
  onToggleQuickBar?: () => void;
}

export const TerminalTabBar: React.FC<TerminalTabBarProps> = ({
  isQuickBarOpen,
  onToggleQuickBar,
}) => {
  const {
    sessions,
    activeSessionId,
    setActiveSession,
    removeSession,
    addSession,
    reconnectSession,
    sendDataToActiveTerminal,
  } = useTerminalStore();
  const { currentServerId, rootPath } = useFileTreeStore();
  const { connectedServerProxy, activeServerId, connectedServerName } = useConnectionStore();
  const { toggleTerminal } = useLayoutStore();

  const activeIndex = sessions.findIndex((s) => s.id === activeSessionId) + 1 || 1;
  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const rawProject = (activeSession?.initialDir || rootPath || "").split("/").filter(Boolean).pop() || "main";
  const projectName = rawProject.replace(/[^a-zA-Z0-9_-]/g, "_");
  const tmuxSessionName = `remora_${projectName}_${activeIndex}`;

  const handleTmuxAutoBootstrap = () => {
    const cmd = `if ! command -v tmux >/dev/null 2>&1; then printf "\\r\\n\\033[36m[Remora] 服务器未安装 tmux，正在为您全自动安装...\\033[0m\\r\\n"; if command -v apt-get >/dev/null 2>&1; then (which sudo >/dev/null 2>&1 && sudo apt-get update -qq && sudo apt-get install -y tmux) || (apt-get update -qq && apt-get install -y tmux); elif command -v yum >/dev/null 2>&1; then (which sudo >/dev/null 2>&1 && sudo yum install -y tmux) || yum install -y tmux; elif command -v dnf >/dev/null 2>&1; then (which sudo >/dev/null 2>&1 && sudo dnf install -y tmux) || dnf install -y tmux; elif command -v apk >/dev/null 2>&1; then (which sudo >/dev/null 2>&1 && sudo apk add tmux) || apk add tmux; elif command -v pacman >/dev/null 2>&1; then (which sudo >/dev/null 2>&1 && sudo pacman -Sy --noconfirm tmux) || pacman -Sy --noconfirm tmux; fi; fi; if command -v tmux >/dev/null 2>&1; then tmux new -A -D -s ${tmuxSessionName} \\; set -g mouse on \\; set -g window-size latest; else printf "\\033[31m[Remora] 自动安装失败，请检查服务器网络或权限。\\033[0m\\r\\n"; fi\n`;
    sendDataToActiveTerminal(cmd);
  };

  const effectiveServerId = activeServerId || currentServerId;

  const handleCreateTerminal = () => {
    if (!effectiveServerId) {
      alert("Please connect to an SSH server and activate it first.");
      return;
    }

    const nextIndex = sessions.length + 1;
    const srvLabel = connectedServerName ? `[${connectedServerName}] ` : "";
    const newSession = {
      id: `term-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: `${srvLabel}${nextIndex}: bash`,
      serverId: effectiveServerId,
      serverName: connectedServerName || undefined,
      initialDir: rootPath || undefined,
      remoteProxy: connectedServerProxy || undefined,
      status: "connecting" as const,
    };

    addSession(newSession);
  };

  return (
    <div className="h-8 px-2 bg-vscode-sidebar/90 flex items-center justify-between border-b border-vscode-border text-xs select-none flex-shrink-0">
      {/* Left: Terminal Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none flex-1 min-w-0">
        <div className="flex items-center gap-1.5 font-semibold text-vscode-textBright uppercase tracking-wider text-[11px] mr-2 flex-shrink-0">
          <Terminal className="w-3.5 h-3.5 text-vscode-activityBarActive" />
          Terminal
        </div>

        {sessions.map((session) => {
          const isActive = session.id === activeSessionId;
          const statusTooltip =
            session.status === "connected"
              ? "Connected"
              : session.status === "connecting"
              ? "Connecting..."
              : "Disconnected - Click to reconnect";

          return (
            <div
              key={session.id}
              onClick={() => setActiveSession(session.id)}
              className={`group flex items-center gap-1.5 px-2.5 py-1 rounded cursor-pointer transition-colors text-[11px] font-mono flex-shrink-0 ${
                isActive
                  ? "bg-vscode-bg text-vscode-textBright border border-vscode-border/80 shadow-xs"
                  : "text-vscode-textMuted hover:bg-vscode-hover hover:text-vscode-text"
              }`}
            >
              {/* Status indicator dot */}
              <span
                onClick={(e) => {
                  if (session.status === "disconnected") {
                    e.stopPropagation();
                    reconnectSession(session.id);
                  }
                }}
                title={statusTooltip}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  session.status === "connected"
                    ? "bg-emerald-400"
                    : session.status === "connecting"
                    ? "bg-amber-400 animate-pulse"
                    : "bg-red-400 hover:scale-125 cursor-pointer"
                }`}
              />

              <span className="truncate max-w-[140px]" title={`${session.title} (${statusTooltip})`}>
                {session.title}
              </span>

              {session.remoteProxy && (
                <span title={`Remote Proxy: ${session.remoteProxy}`}>
                  <Globe className="w-2.5 h-2.5 text-sky-400 flex-shrink-0" />
                </span>
              )}

              {/* Reconnect session button when disconnected */}
              {session.status === "disconnected" && (
                <button
                  title="Reconnect Terminal"
                  onClick={(e) => {
                    e.stopPropagation();
                    reconnectSession(session.id);
                  }}
                  className="p-0.5 rounded text-amber-400 hover:text-amber-200 hover:bg-vscode-border transition-colors flex items-center justify-center"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                </button>
              )}

              {/* Close session button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeSession(session.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-vscode-border hover:text-white transition-opacity"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1 ml-2 flex-shrink-0">
        {sessions.length > 0 && (
          <button
            title={`一键保活（未安装则全自动安装，绑定 ${tmuxSessionName}，断线进程不中断）`}
            onClick={handleTmuxAutoBootstrap}
            className="px-1.5 py-0.5 rounded text-[10px] text-amber-300 hover:text-white hover:bg-vscode-hover border border-amber-500/40 hover:border-amber-400 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <Shield className="w-3 h-3 text-amber-400" />
            <span className="hidden sm:inline">保活</span>
          </button>
        )}

        {onToggleQuickBar && (
          <button
            title={isQuickBarOpen ? "隐藏快捷命令条 (Hide Quick Bar)" : "显示快捷命令条 (Show Quick Bar)"}
            onClick={onToggleQuickBar}
            className={`p-1 rounded transition-colors flex items-center justify-center cursor-pointer ${
              isQuickBarOpen
                ? "text-amber-400 bg-vscode-hover"
                : "text-vscode-textMuted hover:text-amber-300 hover:bg-vscode-hover"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          title="New Terminal"
          onClick={handleCreateTerminal}
          className="p-1 rounded text-vscode-textMuted hover:text-white hover:bg-vscode-hover transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>

        <button
          title="Close Panel"
          onClick={toggleTerminal}
          className="p-1 rounded text-vscode-textMuted hover:text-white hover:bg-vscode-hover transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
