import React from "react";
import { Terminal, Wifi, WifiOff, Folder, RefreshCw, AlertCircle, Code2, GitBranch, Cpu, HardDrive, Database, Activity } from "lucide-react";
import { useLayoutStore } from "../../stores/layoutStore";
import { useConnectionStore } from "../../stores/connectionStore";
import { useEditorStore } from "../../stores/editorStore";
import { useGitStore } from "../../stores/gitStore";
import { useServerOverviewStore } from "../../stores/serverOverviewStore";
import { formatBytes, formatSpeedCompact, formatUptime } from "../../utils/tauriBridge";
import { languages } from "@codemirror/language-data";
import { LanguageDescription } from "@codemirror/language";

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
  const { overview, setIsModalOpen } = useServerOverviewStore();
  const { tabs, activeTabPath } = useEditorStore();
  const { isRepo, currentBranch, changes } = useGitStore();
  const activeTab = tabs.find((t) => t.path === activeTabPath);
  const langDesc = activeTab ? LanguageDescription.matchFilename(languages, activeTab.path) : null;
  const languageName = langDesc ? langDesc.name : (activeTab ? "Plain Text" : null);

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
      className={`h-6 text-white text-xs px-2.5 flex items-center justify-between select-none z-30 transition-colors flex-shrink-0 border-t border-black/25 shadow-xs ${getBgClass()}`}
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

        {/* Git Branch Indicator */}
        {isRepo && currentBranch && (
          <button
            onClick={() => setActiveSidebarTab("git")}
            className="flex items-center gap-1 hover:bg-white/10 px-1.5 py-0.5 rounded cursor-pointer transition-colors text-slate-100 hover:text-white flex-shrink-0"
            title={`Git Branch: ${currentBranch}${changes.length > 0 ? ` (${changes.length} changes)` : ""}\nClick to view Source Control`}
          >
            <GitBranch className="w-3.5 h-3.5 text-emerald-300 flex-shrink-0" />
            <span className="font-mono text-[11px] font-medium">{currentBranch}</span>
            {changes.length > 0 && (
              <span className="text-[10px] px-1 py-0.2 rounded-full bg-black/25 text-amber-300 font-mono font-bold">
                {changes.length}*
              </span>
            )}
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Server Load Overview Item (CPU, MEM, DISK, NET) */}
        {status === "connected" && overview && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2.5 px-2 py-0.5 rounded hover:bg-white/10 cursor-pointer transition-colors text-slate-100 hover:text-white font-mono text-[11px] flex-shrink-0"
            title={`服务器负载概览 (点击查看全景大图)\n---------------------------\nCPU: ${overview.cpu_usage.toFixed(1)}% (${overview.cpu_cores} 核心, 负载: ${overview.load_avg.map((v) => v.toFixed(2)).join(", ")})\n内存: ${formatBytes(overview.mem_used)} / ${formatBytes(overview.mem_total)} (${overview.mem_usage.toFixed(1)}%)\n磁盘: ${formatBytes(overview.disk_used)} / ${formatBytes(overview.disk_total)} (${overview.disk_usage.toFixed(1)}%)\n网络: ↓${formatSpeedCompact(overview.net_rx_speed)}/s ↑${formatSpeedCompact(overview.net_tx_speed)}/s\n运行时间: ${formatUptime(overview.uptime_seconds)}\n---------------------------\n每 5 秒无感采集 · 免持久化存盘`}
          >
            {/* CPU */}
            <div className="flex items-center gap-1">
              <Cpu className="w-3.5 h-3.5 text-sky-300 flex-shrink-0" />
              <span className={overview.cpu_usage >= 85 ? "text-rose-300 font-bold" : ""}>
                CPU {overview.cpu_usage.toFixed(0)}%
              </span>
            </div>

            {/* Memory */}
            <div className="flex items-center gap-1">
              <HardDrive className="w-3.5 h-3.5 text-indigo-300 flex-shrink-0" />
              <span className={overview.mem_usage >= 85 ? "text-rose-300 font-bold" : ""}>
                MEM {overview.mem_usage.toFixed(0)}%
              </span>
            </div>

            {/* Disk */}
            <div className="flex items-center gap-1">
              <Database className="w-3.5 h-3.5 text-amber-300 flex-shrink-0" />
              <span className={overview.disk_usage >= 85 ? "text-rose-300 font-bold" : ""}>
                DISK {overview.disk_usage.toFixed(0)}%
              </span>
            </div>

            {/* Network */}
            <div className="flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-emerald-300 flex-shrink-0" />
              <span className="text-emerald-200">
                ↓{formatSpeedCompact(overview.net_rx_speed)} ↑{formatSpeedCompact(overview.net_tx_speed)}
              </span>
            </div>
          </button>
        )}

        {/* Terminal toggle */}
        <button
          onClick={toggleTerminal}
          className="flex items-center gap-1 hover:bg-white/10 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
          title="Toggle Terminal"
        >
          <Terminal className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{isTerminalOpen ? "Hide Terminal" : "Terminal"}</span>
        </button>

        {/* Active File Language Indicator */}
        {languageName && (
          <div
            className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-white/10 transition-colors text-vscode-textBright font-mono text-[11px] cursor-default"
            title={`Syntax: ${languageName}`}
          >
            <Code2 className="w-3 h-3 opacity-70" />
            <span>{languageName}</span>
          </div>
        )}

        <span className="hidden sm:inline">UTF-8</span>
        <span className="hidden sm:inline">LF</span>
      </div>
    </footer>
  );
};
