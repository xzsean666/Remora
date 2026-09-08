import React from "react";
import { Terminal, Plus, X } from "lucide-react";
import { useTerminalStore } from "../../stores/terminalStore";
import { useFileTreeStore } from "../../stores/fileTreeStore";
import { useLayoutStore } from "../../stores/layoutStore";

export const TerminalTabBar: React.FC = () => {
  const { sessions, activeSessionId, setActiveSession, removeSession, addSession } = useTerminalStore();
  const { currentServerId, rootPath } = useFileTreeStore();
  const { toggleTerminal } = useLayoutStore();

  const handleCreateTerminal = () => {
    if (!currentServerId) {
      alert("Please connect to an SSH server first.");
      return;
    }

    const nextIndex = sessions.length + 1;
    const newSession = {
      id: `term-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: `${nextIndex}: bash`,
      serverId: currentServerId,
      initialDir: rootPath || undefined,
      status: "connecting" as const,
    };

    addSession(newSession);
  };

  return (
    <div className="h-8 px-2 bg-vscode-sidebar/90 flex items-center justify-between border-b border-vscode-border text-xs select-none">
      {/* Left: Terminal Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none flex-1 min-w-0">
        <div className="flex items-center gap-1.5 font-semibold text-vscode-textBright uppercase tracking-wider text-[11px] mr-2 flex-shrink-0">
          <Terminal className="w-3.5 h-3.5 text-vscode-activityBarActive" />
          Terminal
        </div>

        {sessions.map((session) => {
          const isActive = session.id === activeSessionId;
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
                className={`w-1.5 h-1.5 rounded-full ${
                  session.status === "connected"
                    ? "bg-emerald-400"
                    : session.status === "connecting"
                    ? "bg-amber-400 animate-pulse"
                    : "bg-red-400"
                }`}
              />

              <span className="truncate max-w-[100px]">{session.title}</span>

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
