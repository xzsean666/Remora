import React, { useEffect, useState } from "react";
import {
  GitBranch,
  RefreshCw,
  FileCode,
  Eye,
  X,
  AlertCircle,
  FolderGit2,
  ChevronDown,
  Terminal,
} from "lucide-react";
import { useGitStore, GitFileChange } from "../../../stores/gitStore";
import { useFileTreeStore } from "../../../stores/fileTreeStore";
import { useConnectionStore } from "../../../stores/connectionStore";
import { useEditorStore } from "../../../stores/editorStore";
import { useLayoutStore } from "../../../stores/layoutStore";
import { BranchSwitchModal } from "./BranchSwitchModal";

export const GitPanel: React.FC = () => {
  const {
    isRepo,
    currentBranch,
    branches,
    changes,
    loading,
    error,
    selectedDiffFile,
    diffContent,
    diffLoading,
    fetchStatus,
    fetchDiff,
    clearDiff,
  } = useGitStore();

  const { currentServerId, rootPath } = useFileTreeStore();
  const { activeServerId } = useConnectionStore();
  const { openFile } = useEditorStore();
  const { isMobile, setMobileTab, setTerminalOpen } = useLayoutStore();

  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);

  const effectiveServerId = activeServerId || currentServerId;

  useEffect(() => {
    if (effectiveServerId && rootPath) {
      fetchStatus(effectiveServerId, rootPath);
    }
  }, [effectiveServerId, rootPath, fetchStatus]);

  const handleRefresh = () => {
    if (effectiveServerId && rootPath) {
      fetchStatus(effectiveServerId, rootPath);
    }
  };

  const handleOpenFile = (change: GitFileChange) => {
    if (!rootPath || !effectiveServerId) return;
    const fullPath = rootPath.endsWith("/")
      ? `${rootPath}${change.path}`
      : `${rootPath}/${change.path}`;
    openFile(effectiveServerId, fullPath);
    if (isMobile) {
      setMobileTab("editor");
    }
  };

  const handleViewDiff = (e: React.MouseEvent, change: GitFileChange) => {
    e.stopPropagation();
    if (effectiveServerId && rootPath) {
      fetchDiff(effectiveServerId, rootPath, change.path);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "M":
        return <span className="text-amber-400 font-bold text-[10px] w-3.5 text-center flex-shrink-0" title="Modified">M</span>;
      case "A":
        return <span className="text-emerald-400 font-bold text-[10px] w-3.5 text-center flex-shrink-0" title="Added">A</span>;
      case "D":
        return <span className="text-red-400 font-bold text-[10px] w-3.5 text-center flex-shrink-0" title="Deleted">D</span>;
      case "U":
        return <span className="text-emerald-300 font-bold text-[10px] w-3.5 text-center flex-shrink-0" title="Untracked">U</span>;
      case "R":
        return <span className="text-sky-400 font-bold text-[10px] w-3.5 text-center flex-shrink-0" title="Renamed">R</span>;
      default:
        return <span className="text-gray-400 font-bold text-[10px] w-3.5 text-center flex-shrink-0">{status}</span>;
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-vscode-sidebar text-vscode-text select-none overflow-hidden">
      {/* Header */}
      <div className="h-9 px-3 border-b border-vscode-border/80 flex items-center justify-between flex-shrink-0 bg-vscode-sidebar">
        <div className="flex items-center gap-1.5 font-semibold text-vscode-textBright uppercase tracking-wider text-[11px]">
          <FolderGit2 className="w-3.5 h-3.5 text-vscode-activityBarActive" />
          <span>Source Control</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className="p-1 rounded hover:bg-vscode-hover text-vscode-textMuted hover:text-white transition-colors cursor-pointer disabled:opacity-50"
            title="刷新 Git 状态"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {!rootPath ? (
          <div className="p-4 text-center text-xs text-vscode-textMuted">
            <p>请先在工作区打开一个远程目录</p>
          </div>
        ) : !isRepo ? (
          <div className="p-6 text-center space-y-3">
            <FolderGit2 className="w-8 h-8 text-vscode-textMuted/40 mx-auto" />
            <p className="text-xs text-vscode-textMuted">
              当前目录不是 Git 仓库
            </p>
            <p className="text-[11px] text-vscode-textMuted/70">
              在终端中运行 <code className="bg-[#1e1e1e] px-1 py-0.5 rounded text-gray-300">git init</code> 即可初始化。
            </p>
            <button
              type="button"
              onClick={() => {
                setTerminalOpen(true);
                if (isMobile) setMobileTab("terminal");
              }}
              className="px-3 py-1.5 rounded bg-[#333333] hover:bg-[#3e3e3e] text-vscode-textBright text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Terminal className="w-3.5 h-3.5 text-amber-400" />
              <span>打开终端</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            {/* Branch Selector Bar */}
            <div className="p-2.5 border-b border-vscode-border/50 bg-[#202021] flex-shrink-0">
              <div className="text-[10px] text-vscode-textMuted uppercase font-semibold mb-1 tracking-wider">
                Current Branch
              </div>
              <button
                type="button"
                onClick={() => setIsBranchModalOpen(true)}
                className="w-full px-2.5 py-1.5 rounded bg-vscode-bg hover:bg-vscode-hover border border-vscode-border/70 hover:border-vscode-activityBarActive/80 flex items-center justify-between text-xs font-mono text-vscode-textBright transition-colors cursor-pointer group shadow-2xs"
                title="点击切换分支"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <GitBranch className="w-3.5 h-3.5 text-vscode-activityBarActive flex-shrink-0" />
                  <span className="font-semibold truncate">{currentBranch || "HEAD detached"}</span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-vscode-textMuted group-hover:text-white flex-shrink-0">
                  <span>{branches.length}</span>
                  <ChevronDown className="w-3 h-3" />
                </div>
              </button>
            </div>

            {/* Error banner if any */}
            {error && (
              <div className="p-2 m-2 rounded bg-red-950/40 border border-red-800/60 text-red-300 text-[11px] flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{error}</span>
              </div>
            )}

            {/* Changes Section */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="px-3 py-1.5 bg-vscode-sidebar/95 border-b border-vscode-border/40 flex items-center justify-between text-[11px] font-semibold text-vscode-textBright select-none">
                <span className="tracking-wide">CHANGES ({changes.length})</span>
              </div>

              <div className="flex-1 overflow-y-auto p-1 space-y-0.5 min-h-0">
                {changes.length === 0 ? (
                  <div className="p-6 text-center text-xs text-vscode-textMuted/70 space-y-1">
                    <p className="font-medium text-emerald-400">✓ No changes</p>
                    <p className="text-[11px]">Working tree clean</p>
                  </div>
                ) : (
                  changes.map((change) => {
                    const parts = change.path.split("/");
                    const fileName = parts.pop() || change.path;
                    const dirPath = parts.join("/");

                    return (
                      <div
                        key={change.path}
                        onClick={() => handleOpenFile(change)}
                        className="group w-full px-2 py-1 rounded hover:bg-vscode-hover text-xs flex items-center justify-between transition-colors cursor-pointer font-mono"
                        title={`${change.path} (${change.status})\n点击在编辑器打开`}
                      >
                        <div className="flex items-center gap-2 truncate min-w-0 mr-2">
                          <FileCode className="w-3.5 h-3.5 text-vscode-textMuted group-hover:text-vscode-textBright flex-shrink-0" />
                          <span className="truncate text-vscode-textBright font-medium">
                            {fileName}
                          </span>
                          {dirPath && (
                            <span className="truncate text-[10px] text-vscode-textMuted/70">
                              {dirPath}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={(e) => handleViewDiff(e, change)}
                            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[#333333] text-vscode-textMuted hover:text-white transition-all cursor-pointer"
                            title="查看代码 Diff"
                          >
                            <Eye className="w-3 h-3" />
                          </button>
                          {getStatusBadge(change.status)}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Diff Viewer Modal */}
      {selectedDiffFile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-xs select-none"
          onClick={clearDiff}
        >
          <div
            className="w-full max-w-2xl bg-[#1e1e1e] border border-vscode-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-4 py-2.5 bg-[#252526] border-b border-vscode-border flex items-center justify-between">
              <div className="flex items-center gap-2 truncate">
                <FileCode className="w-4 h-4 text-vscode-activityBarActive flex-shrink-0" />
                <span className="text-xs font-mono font-semibold text-white truncate">
                  Diff: {selectedDiffFile}
                </span>
              </div>
              <button
                type="button"
                onClick={clearDiff}
                className="p-1 rounded hover:bg-vscode-hover text-vscode-textMuted hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Diff Body */}
            <div className="p-3 overflow-auto flex-1 font-mono text-xs leading-relaxed bg-[#181818] select-text">
              {diffLoading ? (
                <div className="p-8 text-center text-vscode-textMuted flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-vscode-activityBarActive" />
                  <span>Loading diff...</span>
                </div>
              ) : !diffContent || diffContent.trim() === "" ? (
                <div className="p-8 text-center text-vscode-textMuted">
                  无差异或为新建未跟踪文件 (Untracked)
                </div>
              ) : (
                <pre className="whitespace-pre overflow-x-auto text-[11px]">
                  {diffContent.split("\n").map((line, idx) => {
                    const isAdd = line.startsWith("+") && !line.startsWith("+++");
                    const isDel = line.startsWith("-") && !line.startsWith("---");
                    const isHeader = line.startsWith("@@");

                    return (
                      <div
                        key={idx}
                        className={`${
                          isAdd
                            ? "bg-emerald-950/50 text-emerald-300"
                            : isDel
                            ? "bg-red-950/50 text-red-300"
                            : isHeader
                            ? "text-sky-400 font-bold bg-sky-950/20"
                            : "text-gray-300"
                        }`}
                      >
                        {line || " "}
                      </div>
                    );
                  })}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Branch Switch Modal */}
      <BranchSwitchModal
        isOpen={isBranchModalOpen}
        onClose={() => setIsBranchModalOpen(false)}
      />
    </div>
  );
};
