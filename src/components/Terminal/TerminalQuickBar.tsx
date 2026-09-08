import React, { useMemo } from "react";
import { Zap, Play, ChevronRight, X } from "lucide-react";
import { useQuickSnippetStore } from "../../stores/quickSnippetStore";
import { useLayoutStore } from "../../stores/layoutStore";

interface TerminalQuickBarProps {
  onClose: () => void;
}

export const TerminalQuickBar: React.FC<TerminalQuickBarProps> = ({ onClose }) => {
  const { snippets, activeGroup, setActiveGroup, sendToTerminal } = useQuickSnippetStore();
  const { setActiveSidebarTab } = useLayoutStore();

  const groups = useMemo(() => {
    const set = new Set<string>();
    snippets.forEach((s) => {
      if (s.group_name) set.add(s.group_name);
    });
    return Array.from(set).sort();
  }, [snippets]);

  // If activeGroup is "ALL" or not found, pick the first group or general
  const effectiveGroup = activeGroup === "ALL" && groups.length > 0 ? groups[0] : activeGroup;

  const currentGroupSnippets = useMemo(() => {
    if (effectiveGroup === "ALL") return snippets;
    return snippets.filter((s) => s.group_name === effectiveGroup);
  }, [snippets, effectiveGroup]);

  return (
    <div className="h-7 px-2 bg-[#1f1f1f] border-b border-vscode-border/80 flex items-center justify-between text-xs select-none flex-shrink-0 z-10">
      {/* Left: Indicator & Group Selector */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none flex-1 min-w-0 pr-2">
        <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-400 uppercase tracking-wider flex-shrink-0">
          <Zap className="w-3 h-3 fill-amber-400" />
          <span className="hidden sm:inline">Quick:</span>
        </div>

        {/* Group Selector Dropdown */}
        <select
          value={effectiveGroup}
          onChange={(e) => setActiveGroup(e.target.value)}
          className="px-1.5 py-0.5 bg-[#2d2d2d] border border-vscode-border/70 rounded text-[11px] text-vscode-text font-medium focus:outline-hidden cursor-pointer flex-shrink-0"
        >
          <option value="ALL">全部 (All)</option>
          {groups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>

        {/* Snippet Quick Action Chips */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none min-w-0">
          {currentGroupSnippets.map((snippet) => (
            <button
              key={snippet.id}
              onClick={() => sendToTerminal(snippet.command, snippet.auto_execute)}
              title={`${snippet.title}: ${snippet.command} (${
                snippet.auto_execute ? "点击立即执行" : "点击填入"
              })`}
              className="px-2 py-0.5 rounded bg-vscode-bg hover:bg-vscode-selected/40 hover:text-white border border-vscode-border/60 hover:border-vscode-activityBarActive/80 text-[11px] font-mono text-vscode-textBright transition-colors flex items-center gap-1 flex-shrink-0 cursor-pointer shadow-2xs"
            >
              <Play className="w-2 h-2 text-emerald-400 fill-emerald-400 flex-shrink-0" />
              <span className="truncate max-w-[120px]">{snippet.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Right: Manage in Sidebar & Close */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => setActiveSidebarTab("snippets")}
          title="打开快捷输入面板进行管理/编辑 (Open Snippets Panel)"
          className="px-1.5 py-0.5 rounded hover:bg-vscode-hover text-vscode-textMuted hover:text-white text-[10px] flex items-center gap-0.5 transition-colors cursor-pointer"
        >
          <span>管理</span>
          <ChevronRight className="w-2.5 h-2.5" />
        </button>

        <button
          onClick={onClose}
          title="关闭快捷条 (Close Quick Bar)"
          className="p-1 rounded hover:bg-vscode-hover text-vscode-textMuted hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
