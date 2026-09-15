import React, { useRef, useEffect } from "react";
import {
  Search,
  RotateCw,
  X,
  ChevronRight,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  MoreHorizontal,
  Loader2,
  AlertCircle,
  FolderOpen,
} from "lucide-react";
import { useSearchStore } from "../../../stores/searchStore";
import { useFileTreeStore } from "../../../stores/fileTreeStore";
import { useConnectionStore } from "../../../stores/connectionStore";
import { useEditorStore } from "../../../stores/editorStore";
import { useLayoutStore } from "../../../stores/layoutStore";
import { getFileIcon } from "../../../utils/fileIcons";

export const SearchPanel: React.FC = () => {
  const {
    query,
    isCaseSensitive,
    isWholeWord,
    isRegex,
    includePattern,
    excludePattern,
    showDetails,
    searching,
    results,
    error,
    collapsedFiles,
    setQuery,
    toggleCaseSensitive,
    toggleWholeWord,
    toggleRegex,
    setIncludePattern,
    setExcludePattern,
    toggleShowDetails,
    toggleFileCollapse,
    collapseAll,
    expandAll,
    clearSearch,
    executeSearch,
  } = useSearchStore();

  const { currentServerId, rootPath } = useFileTreeStore();
  const { activeServerId } = useConnectionStore();
  const { openFile } = useEditorStore();
  const { isMobile, setMobileTab } = useLayoutStore();

  const inputRef = useRef<HTMLInputElement>(null);
  const effectiveServerId = activeServerId || currentServerId;

  // Auto-focus the input on mount or when activated
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSearch = () => {
    if (effectiveServerId && rootPath) {
      executeSearch(effectiveServerId, rootPath);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
  };

  const handleItemClick = (filePath: string, line: number, col: number) => {
    if (!effectiveServerId) return;
    openFile(effectiveServerId, filePath, false, { line, ch: col });
    if (isMobile) {
      setMobileTab("editor");
    }
  };

  const renderHighlightedLine = (content: string) => {
    if (!query) return content;
    try {
      const flags = isCaseSensitive ? "g" : "gi";
      let pattern = isRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (isWholeWord) {
        pattern = `\\b${pattern}\\b`;
      }
      const regex = new RegExp(pattern, flags);
      const parts: React.ReactNode[] = [];
      let lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = regex.exec(content)) !== null) {
        if (match.index > lastIndex) {
          parts.push(content.substring(lastIndex, match.index));
        }
        parts.push(
          <span
            key={match.index}
            className="bg-[#613214] text-yellow-300 font-medium px-0.5 rounded-xs border border-yellow-600/50"
          >
            {match[0]}
          </span>
        );
        lastIndex = regex.lastIndex;
        if (match[0].length === 0) {
          regex.lastIndex++;
        }
      }
      if (lastIndex < content.length) {
        parts.push(content.substring(lastIndex));
      }
      return parts.length > 0 ? parts : content;
    } catch {
      return content;
    }
  };

  if (!effectiveServerId || !rootPath) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 text-center select-none text-vscode-textMuted">
        <FolderOpen className="w-10 h-10 mb-3 opacity-30" />
        <span className="text-xs font-medium text-vscode-textBright mb-1">
          No Workspace Open
        </span>
        <p className="text-[11px] leading-relaxed">
          Open a remote project folder in Project Explorer to search across files.
        </p>
      </div>
    );
  }

  const allCollapsed = results && results.files.length > 0 && results.files.every((f) => collapsedFiles[f.path]);

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-vscode-sidebar text-vscode-text select-none text-xs">
      {/* Top Controls Header */}
      <div className="p-2 border-b border-vscode-border/40 flex flex-col gap-2">
        {/* Search Input Box with Toggle Flags */}
        <div className="relative flex items-center bg-[#3c3c3c]/60 border border-vscode-border rounded focus-within:border-vscode-activityBarActive transition-colors">
          <Search className="w-3.5 h-3.5 text-vscode-textMuted/60 ml-2 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search (Press Enter to find)"
            className="w-full bg-transparent px-2 py-1 text-xs text-vscode-textBright placeholder-vscode-textMuted/60 outline-hidden pr-24"
          />

          {/* Quick Clear Button */}
          {query && (
            <button
              onClick={clearSearch}
              title="Clear Search"
              className="p-1 text-vscode-textMuted hover:text-white rounded hover:bg-white/10"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {/* VS Code Search Flag Buttons */}
          <div className="flex items-center gap-0.5 mr-1 text-[11px] font-mono">
            {/* Case Sensitive */}
            <button
              onClick={() => {
                toggleCaseSensitive();
                if (query.trim()) setTimeout(handleSearch, 0);
              }}
              title="Match Case (Alt+C)"
              className={`px-1 py-0.5 rounded cursor-pointer transition-colors ${
                isCaseSensitive
                  ? "bg-vscode-activityBarActive text-white font-bold"
                  : "text-vscode-textMuted hover:text-vscode-textBright hover:bg-white/10"
              }`}
            >
              Aa
            </button>

            {/* Whole Word */}
            <button
              onClick={() => {
                toggleWholeWord();
                if (query.trim()) setTimeout(handleSearch, 0);
              }}
              title="Match Whole Word (Alt+W)"
              className={`px-1 py-0.5 rounded cursor-pointer transition-colors ${
                isWholeWord
                  ? "bg-vscode-activityBarActive text-white font-bold"
                  : "text-vscode-textMuted hover:text-vscode-textBright hover:bg-white/10"
              }`}
            >
              \b
            </button>

            {/* Regex */}
            <button
              onClick={() => {
                toggleRegex();
                if (query.trim()) setTimeout(handleSearch, 0);
              }}
              title="Use Regular Expression (Alt+R)"
              className={`px-1 py-0.5 rounded cursor-pointer transition-colors ${
                isRegex
                  ? "bg-vscode-activityBarActive text-white font-bold"
                  : "text-vscode-textMuted hover:text-vscode-textBright hover:bg-white/10"
              }`}
            >
              .*
            </button>

            {/* Toggle Details (Include/Exclude) */}
            <button
              onClick={toggleShowDetails}
              title="Toggle Search Details"
              className={`p-1 rounded cursor-pointer transition-colors ${
                showDetails
                  ? "text-vscode-activityBarActive bg-white/10"
                  : "text-vscode-textMuted hover:text-vscode-textBright hover:bg-white/10"
              }`}
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Collapsible Details: files to include & exclude */}
        {showDetails && (
          <div className="flex flex-col gap-1.5 pt-1 text-[11px] animate-fadeIn">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-vscode-textMuted uppercase tracking-wider font-semibold">
                files to include
              </span>
              <input
                type="text"
                value={includePattern}
                onChange={(e) => setIncludePattern(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. *.ts, src/**"
                className="w-full bg-[#3c3c3c]/50 border border-vscode-border rounded px-2 py-0.5 text-xs text-vscode-textBright placeholder-vscode-textMuted/50 outline-hidden focus:border-vscode-activityBarActive"
              />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-vscode-textMuted uppercase tracking-wider font-semibold">
                files to exclude
              </span>
              <input
                type="text"
                value={excludePattern}
                onChange={(e) => setExcludePattern(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. dist, build, *.min.js"
                className="w-full bg-[#3c3c3c]/50 border border-vscode-border rounded px-2 py-0.5 text-xs text-vscode-textBright placeholder-vscode-textMuted/50 outline-hidden focus:border-vscode-activityBarActive"
              />
            </div>
          </div>
        )}

        {/* Action and Summary Bar */}
        <div className="flex items-center justify-between text-[11px] text-vscode-textMuted pt-0.5">
          <div className="truncate min-w-0 pr-1">
            {searching ? (
              <span className="flex items-center gap-1 text-vscode-activityBarActive">
                <Loader2 className="w-3 h-3 animate-spin" />
                Searching remote host...
              </span>
            ) : results ? (
              <span className="truncate">
                {results.total_matches} {results.total_matches === 1 ? "result" : "results"} in{" "}
                {results.total_files} {results.total_files === 1 ? "file" : "files"}
                <span className="text-vscode-textMuted/70 ml-1">
                  ({results.duration_ms}ms · {results.engine_used})
                </span>
              </span>
            ) : (
              <span>Workspace: {rootPath.split("/").pop() || rootPath}</span>
            )}
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {results && results.files.length > 0 && (
              <button
                onClick={allCollapsed ? expandAll : collapseAll}
                title={allCollapsed ? "Expand All" : "Collapse All"}
                className="p-1 rounded hover:bg-white/10 hover:text-white transition-colors"
              >
                {allCollapsed ? (
                  <ChevronsUpDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronsDownUp className="w-3.5 h-3.5" />
                )}
              </button>
            )}

            <button
              onClick={handleSearch}
              disabled={searching}
              title="Refresh / Run Search (Enter)"
              className="p-1 rounded hover:bg-white/10 hover:text-white transition-colors disabled:opacity-40"
            >
              <RotateCw className={`w-3.5 h-3.5 ${searching ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Results / Feedback Area */}
      <div className="flex-1 min-h-0 overflow-y-auto p-1 font-mono text-[12px]">
        {error && (
          <div className="p-3 m-2 bg-red-950/40 border border-red-800/60 rounded flex items-start gap-2 text-red-300 text-xs">
            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
            <div className="flex flex-col gap-1 min-w-0">
              <span className="font-semibold">Search Failed</span>
              <span className="text-[11px] text-red-300/80 break-words">{error}</span>
            </div>
          </div>
        )}

        {results && results.total_matches === 0 && !searching && (
          <div className="p-6 text-center text-vscode-textMuted font-sans text-xs">
            No results found for <span className="text-vscode-textBright font-semibold">"{query}"</span>
          </div>
        )}

        {results && results.truncated && (
          <div className="px-3 py-1.5 mb-1 bg-amber-950/40 border border-amber-800/40 rounded text-amber-300/90 text-[11px] font-sans">
            Results capped at first 1,000 matches. Use specific filters to narrow search.
          </div>
        )}

        {results &&
          results.files.map((file) => {
            const isCollapsed = !!collapsedFiles[file.path];
            const fileName = file.relative_path.split("/").pop() || file.relative_path;
            const dirPath = file.relative_path.includes("/")
              ? file.relative_path.substring(0, file.relative_path.lastIndexOf("/"))
              : "";

            return (
              <div key={file.path} className="mb-0.5">
                {/* File Header Row */}
                <div
                  onClick={() => toggleFileCollapse(file.path)}
                  className="flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-white/5 cursor-pointer text-vscode-textBright group"
                >
                  <span className="text-vscode-textMuted flex-shrink-0">
                    {isCollapsed ? (
                      <ChevronRight className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </span>

                  <span className="flex-shrink-0">
                    {getFileIcon(fileName, false, false)}
                  </span>

                  <span className="font-medium text-vscode-textBright truncate text-xs">
                    {fileName}
                  </span>

                  {dirPath && (
                    <span className="text-vscode-textMuted/60 text-[10px] truncate ml-0.5">
                      {dirPath}
                    </span>
                  )}

                  <span className="ml-auto bg-vscode-selected text-white text-[10px] font-semibold px-1.5 py-0.2 rounded-full flex-shrink-0">
                    {file.matches.length}
                  </span>
                </div>

                {/* File Line Matches */}
                {!isCollapsed && (
                  <div className="flex flex-col ml-5 border-l border-vscode-border/30 pl-1 my-0.5">
                    {file.matches.map((match, idx) => (
                      <div
                        key={`${match.line_number}-${match.column_number}-${idx}`}
                        onClick={() => handleItemClick(file.path, match.line_number, match.column_number)}
                        className="flex items-baseline gap-2 px-1.5 py-0.5 rounded hover:bg-vscode-selected/30 cursor-pointer text-vscode-text group"
                        title={`Line ${match.line_number}, Col ${match.column_number}`}
                      >
                        <span className="text-vscode-textMuted/70 text-[11px] select-none min-w-[28px] text-right font-mono flex-shrink-0">
                          {match.line_number}
                        </span>

                        <div className="truncate text-[11px] font-mono whitespace-pre min-w-0 text-vscode-textMuted group-hover:text-vscode-textBright">
                          {renderHighlightedLine(match.line_content)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
};
