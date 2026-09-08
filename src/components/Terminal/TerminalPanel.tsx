import React from "react";
import { Terminal as TerminalIcon, Plus } from "lucide-react";
import { useTerminalStore } from "../../stores/terminalStore";
import { useFileTreeStore } from "../../stores/fileTreeStore";
import { useConnectionStore } from "../../stores/connectionStore";
import { TerminalTabBar } from "./TerminalTabBar";
import { XtermView } from "./XtermView";

export const TerminalPanel: React.FC = () => {
  const { sessions, activeSessionId, addSession } = useTerminalStore();
  const { currentServerId, rootPath } = useFileTreeStore();
  const { connectedServerProxy } = useConnectionStore();

  const handleCreateTerminal = () => {
    if (!currentServerId) return;

    const nextIndex = sessions.length + 1;
    const newSession = {
      id: `term-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: `${nextIndex}: bash`,
      serverId: currentServerId,
      initialDir: rootPath || undefined,
      remoteProxy: connectedServerProxy || undefined,
      status: "connecting" as const,
    };

    addSession(newSession);
  };

  return (
    <div className="w-full h-full flex flex-col bg-vscode-terminal overflow-hidden select-none">
      {/* Terminal Tab Bar */}
      <TerminalTabBar />

      {/* Terminal Sessions Container */}
      <div className="flex-1 relative overflow-hidden bg-[#181818]">
        {sessions.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
            <TerminalIcon className="w-8 h-8 text-vscode-textMuted/40 mb-2" />
            <p className="text-xs text-vscode-textMuted mb-3">No active terminal session</p>
            {currentServerId ? (
              <button
                onClick={handleCreateTerminal}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-vscode-activityBarActive text-white rounded text-xs font-medium hover:bg-vscode-activityBarActive/90 transition-colors shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                New Terminal
              </button>
            ) : (
              <p className="text-[11px] text-vscode-textMuted/60">
                Connect to a server in the sidebar to open a remote terminal.
              </p>
            )}
          </div>
        ) : (
          sessions.map((session) => (
            <XtermView
              key={session.id}
              session={session}
              isActive={session.id === activeSessionId}
            />
          ))
        )}
      </div>
    </div>
  );
};
