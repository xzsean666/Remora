import React, { useState } from "react";
import { Terminal, Plus, X, Globe, RotateCcw, Zap, Layers } from "lucide-react";
import { useTerminalStore } from "../../stores/terminalStore";
import { useFileTreeStore } from "../../stores/fileTreeStore";
import { useConnectionStore } from "../../stores/connectionStore";
import { useLayoutStore } from "../../stores/layoutStore";
import { TmuxManagerModal } from "./TmuxManagerModal";

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
  } = useTerminalStore();
  const { currentServerId, rootPath } = useFileTreeStore();
  const { connectedServerProxy, activeServerId, connectedServerName } = useConnectionStore();
  const { toggleTerminal } = useLayoutStore();
  const [isTmuxModalOpen, setIsTmuxModalOpen] = useState(false);

  const effectiveServerId = activeServerId || currentServerId;

  const handleCreateTerminal = () => {
    if (!effectiveServerId) {
      alert("Please connect to an SSH server and activate it first.");
      return;
    }

    const usedSlots = new Set(sessions.map((s) => s.slotNumber).filter(Boolean));
    let slotNumber = 1;
    while (usedSlots.has(slotNumber)) slotNumber++;

    const srvLabel = connectedServerName ? `[${connectedServerName}] ` : "";
    const newSession = {
      id: `term-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: `${srvLabel}${slotNumber}: bash`,
      serverId: effectiveServerId,
      serverName: connectedServerName || undefined,
      initialDir: rootPath || undefined,
      remoteProxy: connectedServerProxy || undefined,
      status: "connecting" as const,
      slotNumber,
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
                  title={session.tmuxSessionName ? "恢复 TMUX 会话" : "重新连接终端"}
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
      <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
        <button
          title="TMUX 会话管理器：查看远端所有会话、自由接入、新建或关闭"
          onClick={() => setIsTmuxModalOpen(true)}
          className="px-2 py-0.5 rounded text-[11px] font-mono text-amber-300 hover:text-white hover:bg-vscode-hover border border-amber-500/50 hover:border-amber-400 transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
        >
          <Layers className="w-3.5 h-3.5 text-amber-400" />
          <span>TMUX</span>
        </button>

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

      <TmuxManagerModal
        isOpen={isTmuxModalOpen}
        onClose={() => setIsTmuxModalOpen(false)}
      />
    </div>
  );
};
