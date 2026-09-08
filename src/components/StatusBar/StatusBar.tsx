import React from "react";
import { Terminal, Wifi, WifiOff, Folder, RefreshCw, AlertCircle } from "lucide-react";
import { useLayoutStore } from "../../stores/layoutStore";
import { useConnectionStore } from "../../stores/connectionStore";

interface StatusBarProps {
  activePath?: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({ activePath }) => {
  const { isTerminalOpen, toggleTerminal } = useLayoutStore();
  const {
    connectedServerName,
    connectedServerId,
    status,
    reconnectAttempt,
    reconnect,
  } = useConnectionStore();

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
      className={`h-6 text-white text-xs px-2.5 flex items-center justify-between select-none z-30 transition-colors ${getBgClass()}`}
    >
      <div className="flex items-center gap-3">
        {/* Remote Host Badge */}
        <div className="flex items-center gap-1.5 font-medium">
          {status === "connected" && (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
              <Wifi className="w-3.5 h-3.5 text-emerald-200" />
              <span>{connectedServerName || "SSH Connected"}</span>
            </>
          )}

          {status === "reconnecting" && (
            <>
              <RefreshCw className="w-3.5 h-3.5 text-amber-200 animate-spin" />
              <span>
                Reconnecting {connectedServerName ? `to ${connectedServerName}` : ""} (attempt {reconnectAttempt}/5)...
              </span>
              <button
                onClick={() => reconnect(connectedServerId || undefined)}
                className="underline hover:text-white text-[11px] ml-1"
              >
                Retry Now
              </button>
            </>
          )}

          {status === "connecting" && (
            <>
              <RefreshCw className="w-3.5 h-3.5 text-amber-200 animate-spin" />
              <span>Connecting to SSH server...</span>
            </>
          )}

          {status === "failed" && (
            <>
              <AlertCircle className="w-3.5 h-3.5 text-red-200" />
              <span>Connection Lost</span>
              <button
                onClick={() => reconnect(connectedServerId || undefined)}
                className="underline hover:text-white text-[11px] ml-1"
              >
                Reconnect
              </button>
            </>
          )}

          {status === "disconnected" && (
            <>
              <WifiOff className="w-3.5 h-3.5 text-slate-400" />
              <span>No Server Connected</span>
            </>
          )}
        </div>

        {/* Remote Workspace Path */}
        {activePath && (
          <div className="flex items-center gap-1 text-slate-200 truncate max-w-xs">
            <Folder className="w-3.5 h-3.5 opacity-80" />
            <span className="truncate">{activePath}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Terminal toggle */}
        <button
          onClick={toggleTerminal}
          className="flex items-center gap-1 hover:bg-white/10 px-1.5 py-0.5 rounded cursor-pointer"
          title="Toggle Terminal"
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>{isTerminalOpen ? "Hide Terminal" : "Terminal"}</span>
        </button>

        <span>UTF-8</span>
        <span>LF</span>
      </div>
    </footer>
  );
};
