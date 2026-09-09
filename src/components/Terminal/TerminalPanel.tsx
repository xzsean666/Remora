import React, { useState } from "react";
import { Terminal as TerminalIcon, Plus } from "lucide-react";
import { useTerminalStore } from "../../stores/terminalStore";
import { useFileTreeStore } from "../../stores/fileTreeStore";
import { useConnectionStore } from "../../stores/connectionStore";
import { TerminalTabBar } from "./TerminalTabBar";
import { TerminalQuickBar } from "./TerminalQuickBar";
import { TerminalMobileBar } from "./TerminalMobileBar";
import { XtermView } from "./XtermView";
import { useLayoutStore } from "../../stores/layoutStore";

export const TerminalPanel: React.FC = () => {
  const { isMobile } = useLayoutStore();
  const { sessions, activeSessionId, addSession } = useTerminalStore();
  const { currentServerId, rootPath } = useFileTreeStore();
  const { connectedServerProxy, activeServerId, connectedServerName } = useConnectionStore();

  const [isQuickBarOpen, setIsQuickBarOpen] = useState(true);

  const effectiveServerId = activeServerId || currentServerId;

  const handleCreateTerminal = () => {
    if (!effectiveServerId) return;

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
    <div className="w-full h-full flex flex-col bg-vscode-terminal overflow-hidden select-none">
      {/* Terminal Tab Bar */}
      <TerminalTabBar
        isQuickBarOpen={isQuickBarOpen}
        onToggleQuickBar={() => setIsQuickBarOpen(!isQuickBarOpen)}
      />

      {/* Embedded Quick Commands Bar */}
      {isQuickBarOpen && (
        <TerminalQuickBar onClose={() => setIsQuickBarOpen(false)} />
      )}

      {/* Terminal Sessions Container */}
      <div className="flex-1 relative overflow-hidden bg-[#181818]">
        {sessions.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
            <TerminalIcon className="w-8 h-8 text-vscode-textMuted/40 mb-2" />
            <p className="text-xs text-vscode-textMuted mb-3">No active terminal session</p>
            {effectiveServerId ? (
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

      {/* Mobile Terminal Virtual Accessory Bar */}
      {isMobile && sessions.length > 0 && (
        <TerminalMobileBar onToggleSnippets={() => setIsQuickBarOpen(!isQuickBarOpen)} />
      )}
    </div>
  );
};
