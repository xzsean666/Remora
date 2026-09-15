import React from "react";
import {
  X,
  RefreshCw,
  Cpu,
  HardDrive,
  Database,
  Activity,
  Server,
  Clock,
  ArrowDown,
  ArrowUp,
  ShieldCheck,
} from "lucide-react";
import { useServerOverviewStore } from "../../stores/serverOverviewStore";
import { useConnectionStore } from "../../stores/connectionStore";
import { useLayoutStore } from "../../stores/layoutStore";
import { formatBytes, formatSpeed, formatUptime } from "../../utils/tauriBridge";

export const ServerOverviewModal: React.FC = () => {
  const {
    overview,
    isLoading,
    isModalOpen,
    setIsModalOpen,
    fetchOverview,
    lastUpdated,
  } = useServerOverviewStore();

  const { activeServerId, connectedServerName, status } = useConnectionStore();
  const { isMobile } = useLayoutStore();

  if (!isModalOpen) return null;

  const handleRefresh = () => {
    if (activeServerId) {
      fetchOverview(activeServerId, false);
    }
  };

  const getLoadColor = (usage: number) => {
    if (usage >= 85) return "text-rose-400 bg-rose-500/15 border-rose-500/30";
    if (usage >= 70) return "text-amber-400 bg-amber-500/15 border-amber-500/30";
    return "text-emerald-400 bg-emerald-500/15 border-emerald-500/30";
  };

  const getProgressColor = (usage: number) => {
    if (usage >= 85) return "bg-rose-500";
    if (usage >= 70) return "bg-amber-500";
    return "bg-emerald-500";
  };

  const serverDisplayName = connectedServerName || activeServerId || "远程服务器";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 select-none animate-fadeIn"
      onClick={() => setIsModalOpen(false)}
    >
      <div
        className={`w-full bg-[#1e1e1e] border border-vscode-border text-vscode-text rounded-xl shadow-2xl flex flex-col overflow-hidden transition-all ${
          isMobile
            ? "max-h-[90dvh] fixed bottom-0 left-0 right-0 rounded-b-none border-b-0 animate-slideUp"
            : "max-w-2xl max-h-[85vh] rounded-xl animate-scaleIn"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Indicator */}
        {isMobile && (
          <div className="w-full flex justify-center pt-2 pb-1">
            <div className="w-10 h-1 bg-white/20 rounded-full" />
          </div>
        )}

        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-vscode-border flex items-center justify-between bg-vscode-header flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-vscode-statusBar/20 border border-vscode-statusBar/40 flex items-center justify-center text-sky-400 flex-shrink-0">
              <Server className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex flex-col">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-vscode-textBright truncate">
                  {serverDisplayName}
                </h3>
                {status === "connected" && (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono px-1.5 py-0.2 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    在线
                  </span>
                )}
              </div>
              <span className="text-[11px] text-vscode-textMuted flex items-center gap-1.5 mt-0.5">
                <Clock className="w-3 h-3 opacity-70" />
                运行时间: {overview ? formatUptime(overview.uptime_seconds) : "--"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="p-1.5 rounded-md hover:bg-white/10 text-vscode-textMuted hover:text-white transition-colors cursor-pointer disabled:opacity-50"
              title="立即手动刷新 (默认每 5 秒自动采集)"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-sky-400" : ""}`} />
            </button>
            <button
              onClick={() => setIsModalOpen(false)}
              className="p-1.5 rounded-md hover:bg-white/10 text-vscode-textMuted hover:text-white transition-colors cursor-pointer"
              title="关闭"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-4">
          {!overview && isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-vscode-textMuted">
              <RefreshCw className="w-8 h-8 animate-spin text-sky-400" />
              <p className="text-xs">正在通过极速 POSIX 探针采集服务器负载...</p>
            </div>
          ) : !overview ? (
            <div className="py-12 text-center text-vscode-textMuted text-xs">
              暂未获取到服务器性能数据，请确认 SSH 连接正常。
            </div>
          ) : (
            <>
              {/* 4 Performance Metric Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* 1. CPU Card */}
                <div className="p-3.5 rounded-lg bg-black/25 border border-vscode-border flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-sky-400" />
                      <span className="text-xs font-semibold text-vscode-textBright">
                        CPU 处理器
                      </span>
                    </div>
                    <span
                      className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${getLoadColor(
                        overview.cpu_usage
                      )}`}
                    >
                      {overview.cpu_usage.toFixed(1)}%
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${getProgressColor(
                        overview.cpu_usage
                      )}`}
                      style={{ width: `${Math.min(100, Math.max(0, overview.cpu_usage))}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-vscode-textMuted">
                    <span>核心数: {overview.cpu_cores} 物理/逻辑核心</span>
                    <span title="Load Average (1m, 5m, 15m)">
                      负载: {overview.load_avg.map((v) => v.toFixed(2)).join(", ")}
                    </span>
                  </div>
                </div>

                {/* 2. Memory Card */}
                <div className="p-3.5 rounded-lg bg-black/25 border border-vscode-border flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <HardDrive className="w-4 h-4 text-indigo-400" />
                      <span className="text-xs font-semibold text-vscode-textBright">
                        系统内存 (RAM)
                      </span>
                    </div>
                    <span
                      className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${getLoadColor(
                        overview.mem_usage
                      )}`}
                    >
                      {overview.mem_usage.toFixed(1)}%
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${getProgressColor(
                        overview.mem_usage
                      )}`}
                      style={{ width: `${Math.min(100, Math.max(0, overview.mem_usage))}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-vscode-textMuted font-mono">
                    <span>已用: {formatBytes(overview.mem_used)}</span>
                    <span>总量: {formatBytes(overview.mem_total)}</span>
                  </div>
                </div>

                {/* 3. Disk Card */}
                <div className="p-3.5 rounded-lg bg-black/25 border border-vscode-border flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-semibold text-vscode-textBright">
                        系统磁盘 ({overview.disk_mount || "/"})
                      </span>
                    </div>
                    <span
                      className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${getLoadColor(
                        overview.disk_usage
                      )}`}
                    >
                      {overview.disk_usage.toFixed(1)}%
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${getProgressColor(
                        overview.disk_usage
                      )}`}
                      style={{ width: `${Math.min(100, Math.max(0, overview.disk_usage))}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-vscode-textMuted font-mono">
                    <span>已用: {formatBytes(overview.disk_used)}</span>
                    <span>容量: {formatBytes(overview.disk_total)}</span>
                  </div>
                </div>

                {/* 4. Network Card */}
                <div className="p-3.5 rounded-lg bg-black/25 border border-vscode-border flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-semibold text-vscode-textBright">
                        实时网络 I/O
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      实时速率
                    </div>
                  </div>

                  {/* Realtime Speed Values */}
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <div className="flex items-center gap-1.5 p-2 rounded bg-white/5">
                      <ArrowDown className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-[10px] text-vscode-textMuted">下行 (Rx)</span>
                        <span className="text-xs font-mono font-semibold text-white truncate">
                          {formatSpeed(overview.net_rx_speed)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 p-2 rounded bg-white/5">
                      <ArrowUp className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-[10px] text-vscode-textMuted">上行 (Tx)</span>
                        <span className="text-xs font-mono font-semibold text-white truncate">
                          {formatSpeed(overview.net_tx_speed)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Note & Refresh Interval Info */}
              <div className="mt-1 p-3 rounded-lg bg-white/5 border border-vscode-border/60 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-vscode-textMuted text-[11px]">
                  <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                  <span>每 5 秒无感采集 · 纯原生 POSIX 内存探针 · 零持久化存盘</span>
                </div>
                {lastUpdated && (
                  <span className="text-[10px] text-vscode-textMuted font-mono">
                    更新于 {new Date(lastUpdated).toLocaleTimeString()}
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-vscode-border flex justify-end bg-vscode-header/60 flex-shrink-0">
          <button
            onClick={() => setIsModalOpen(false)}
            className="px-4 py-1.5 bg-vscode-selected text-white rounded-md hover:brightness-110 transition-all text-xs cursor-pointer font-medium"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
};
