import React from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { useServerOverviewStore } from "../../stores/serverOverviewStore";
import { useConnectionStore } from "../../stores/connectionStore";
import { formatSpeedCompact } from "../../utils/tauriBridge";

export const MobileOverviewBar: React.FC = () => {
  const {
    overview,
    isMobileMicroBarVisible,
    setMobileMicroBarVisible,
    setIsModalOpen,
  } = useServerOverviewStore();

  const { status } = useConnectionStore();

  if (status !== "connected" || !overview) {
    return null;
  }

  // If user minimized the micro bar, show a tiny floating trigger pill
  if (!isMobileMicroBarVisible) {
    return (
      <button
        onClick={() => setMobileMicroBarVisible(true)}
        className="fixed bottom-[58px] right-2 z-40 bg-vscode-statusBar/90 text-white text-[10px] font-mono px-2 py-0.5 rounded-full shadow-md border border-white/20 flex items-center gap-1 backdrop-blur-xs active:scale-95 transition-all"
        title="展开服务器负载条"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span>C:{overview.cpu_usage.toFixed(0)}% M:{overview.mem_usage.toFixed(0)}%</span>
        <ChevronUp className="w-3 h-3 opacity-75" />
      </button>
    );
  }

  const getLoadBadgeColor = (usage: number) => {
    if (usage >= 85) return "text-rose-300 font-bold";
    if (usage >= 70) return "text-amber-300 font-medium";
    return "text-slate-100";
  };

  return (
    <div
      onClick={() => setIsModalOpen(true)}
      className="h-5.5 bg-vscode-statusBar text-white text-[10.5px] px-2.5 flex items-center justify-between select-none z-30 border-t border-black/25 shadow-xs flex-shrink-0 cursor-pointer transition-colors active:bg-vscode-statusBar/90"
      title="点击展开服务器全景概览"
    >
      <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden font-mono">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse flex-shrink-0" />

        {/* CPU */}
        <span className={`truncate flex-shrink-0 ${getLoadBadgeColor(overview.cpu_usage)}`}>
          CPU {overview.cpu_usage.toFixed(0)}%
        </span>

        <span className="opacity-40">·</span>

        {/* MEM */}
        <span className={`truncate flex-shrink-0 ${getLoadBadgeColor(overview.mem_usage)}`}>
          MEM {overview.mem_usage.toFixed(0)}%
        </span>

        <span className="opacity-40">·</span>

        {/* DISK */}
        <span className={`truncate flex-shrink-0 ${getLoadBadgeColor(overview.disk_usage)}`}>
          DISK {overview.disk_usage.toFixed(0)}%
        </span>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0 font-mono text-[10px]">
        {/* Realtime Speed */}
        <span className="text-emerald-200">
          ↓{formatSpeedCompact(overview.net_rx_speed)} ↑{formatSpeedCompact(overview.net_tx_speed)}
        </span>

        {/* Expand Indicator */}
        <ChevronUp className="w-3 h-3 text-white/80 flex-shrink-0" />

        {/* Collapse Micro Bar Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setMobileMicroBarVisible(false);
          }}
          className="p-0.5 hover:bg-white/20 rounded text-white/70 hover:text-white transition-colors ml-0.5"
          title="最小化为悬浮气泡"
        >
          <ChevronDown className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
