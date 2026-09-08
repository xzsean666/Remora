import React from "react";
import { Terminal, Wifi, WifiOff, Folder, RefreshCw, AlertCircle } from "lucide-react";
import { useLayoutStore } from "../../stores/layoutStore";
import { useConnectionStore } from "../../stores/connectionStore";

interface StatusBarProps {
  activePath?: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({ activePath }) => {
  const { isTerminalOpen, toggleTerminal, setActiveSidebarTab } = useLayoutStore();
  const {
    connectedServerName,
    connectedServerId,
    status,
    reconnectAttempt,
    reconnect,
    getConnectedServerIds,
  } = useConnectionStore();

  const connectedIds = getConnectedServerIds();

  const getBgClass = () => {
    switch (status) {
      case "connected":
        return "bg-vscode-statusBar";
      case "reconnecting":
      case "connecting":
        return "bg-amber-700";
      case "failed":
        return "bg-red-700";
      default:
        return "bg-vscode-statusBarOffline";
    }
  };

  return (
    <footer
      className={`h-6 text-white text-xs px-2.5 flex items-center justify-between select-none z-30 transition-colors flex-shrink-0 ${getBgClass()}`}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-hidden mr-2">
        {/* Remote Host Badge */}
        <div className="flex items-center gap-1.5 font-medium min-w-0 flex-shrink truncate">
          {status === "connected" && (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse flex-shrink-0" />
              <Wifi className="w-3.5 h-3.5 text-emerald-200 flex-shrink-0" />
              <button
                onClick={() => setActiveSidebarTab("servers")}
                className="truncate min-w-0 hover:underline cursor-pointer flex items-center gap-1"
                title={`Active Server: ${connectedServerName || "SSH Connected"}\nClick to view servers`}
              >
                <span className="opacity-80 text-[10px] uppercase font-mono tracking-wider">Active:</span>
                <span className="font-semibold">{connectedServerName || "SSH Connected"}</span>
              </button>

              {connectedIds.length > 1 && (
                <button
                  onClick={() => setActiveSidebarTab("servers")}
                  className="px-1.5 py-0.2 rounded-full bg-white/20 hover:bg-white/30 text-[10px] font-mono transition-colors ml-1 cursor-pointer flex-shrink-0"
                  title={`${connectedIds.length} servers connected. Click to switch.`}
                >
                  {connectedIds.length} connected
                </button>
              )}
            </>
          )}

          {status === "reconnecting" && (
            <div className="flex items-center gap-1.5 min-w-0">
              <RefreshCw className="w-3.5 h-3.5 text-amber-200 animate-spin flex-shrink-0" />
              <span className="truncate min-w-0">
                Reconnecting {connectedServerName ? `to ${connectedServerName}` : ""} ({reconnectAttempt}/5)...
              </span>
              <button
                onClick={() => reconnect(connectedServerId || undefined)}
                className="underline hover:text-white text-[11px] ml-1 flex-shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          {status === "connecting" && (
            <div className="flex items-center gap-1.5 min-w-0">
              <RefreshCw className="w-3.5 h-3.5 text-amber-200 animate-spin flex-shrink-0" />
              <span className="truncate min-w-0">Connecting to SSH...</span>
            </div>
          )}

          {status === "failed" && (
            <div className="flex items-center gap-1.5 min-w-0">
              <AlertCircle className="w-3.5 h-3.5 text-red-200 flex-shrink-0" />
              <span className="truncate min-w-0">Connection Lost</span>
              <button
                onClick={() => reconnect(connectedServerId || undefined)}
                className="underline hover:text-white text-[11px] ml-1 flex-shrink-0"
              >
                Reconnect
              </button>
            </div>
          )}

          {status === "disconnected" && (
            <button
              onClick={() => setActiveSidebarTab("servers")}
              className="flex items-center gap-1.5 min-w-0 hover:underline cursor-pointer"
            >
              <WifiOff className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <span className="truncate min-w-0">No Server</span>
            </button>
          )}
        </div>

        {/* Remote Workspace Path */}
        {activePath && (
          <button
            onClick={() => setActiveSidebarTab("explorer")}
            className="flex items-center gap-1 text-slate-200 hover:text-white hover:underline truncate min-w-0 max-w-[240px] flex-shrink cursor-pointer"
            title={`Workspace: ${activePath}\nClick to open Project Explorer`}
          >
            <Folder className="w-3.5 h-3.5 opacity-80 flex-shrink-0" />
            <span className="truncate min-w-0 font-mono text-[11px]">{activePath}</span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Terminal toggle */}
        <button
          onClick={toggleTerminal}
          className="flex items-center gap-1 hover:bg-white/10 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
          title="Toggle Terminal"
        >
          <Terminal className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{isTerminalOpen ? "Hide Terminal" : "Terminal"}</span>
        </button>

        <span className="hidden sm:inline">UTF-8</span>
        <span className="hidden sm:inline">LF</span>
      </div>
    </footer>
  );
};
