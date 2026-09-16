import React, { useEffect, useState, useRef } from "react";
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
  Github,
  Check,
  Sparkles,
  Settings,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  GitCommit,
  Languages,
} from "lucide-react";
import { useGitStore, GitFileChange } from "../../../stores/gitStore";
import { useFileTreeStore } from "../../../stores/fileTreeStore";
import { useConnectionStore } from "../../../stores/connectionStore";
import { useEditorStore } from "../../../stores/editorStore";
import { useLayoutStore } from "../../../stores/layoutStore";
import { BranchSwitchModal } from "./BranchSwitchModal";
import { AiConfigModal } from "./AiConfigModal";

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
    ghAuth,
    ghLoading,
    commitMessage,
    commitLang,
    isOperating,
    operatingAction,
    aiGenerating,
    setCommitMessage,
    setCommitLang,
    fetchStatus,
    fetchGhAuth,
    switchGhAccount,
    fetchDiff,
    clearDiff,
    commitChanges,
    pushChanges,
    pullChanges,
    syncChanges,
    generateAiCommit,
  } = useGitStore();

  const { currentServerId, rootPath } = useFileTreeStore();
  const { activeServerId } = useConnectionStore();
  const { openFile } = useEditorStore();
  const { isMobile, setMobileTab, setTerminalOpen } = useLayoutStore();

  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isGhMenuOpen, setIsGhMenuOpen] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  const ghMenuRef = useRef<HTMLDivElement>(null);
  const effectiveServerId = activeServerId || currentServerId;

  // Auto-fetch status on server or rootPath change
  useEffect(() => {
    if (effectiveServerId && rootPath) {
      fetchStatus(effectiveServerId, rootPath);
      fetchGhAuth(effectiveServerId);
    }
  }, [effectiveServerId, rootPath, fetchStatus, fetchGhAuth]);

  // Click outside to close gh dropdown menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ghMenuRef.current && !ghMenuRef.current.contains(e.target as Node)) {
        setIsGhMenuOpen(false);
      }
    };
    if (isGhMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isGhMenuOpen]);

  // Auto-dismiss success message
  useEffect(() => {
    if (actionSuccessMsg) {
      const timer = setTimeout(() => setActionSuccessMsg(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [actionSuccessMsg]);

  const handleRefresh = () => {
    if (effectiveServerId && rootPath) {
      fetchStatus(effectiveServerId, rootPath);
      fetchGhAuth(effectiveServerId);
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

  const handleCommit = async () => {
    if (!effectiveServerId || !rootPath || !commitMessage.trim()) return;
    try {
      await commitChanges(effectiveServerId, rootPath, true);
      setActionSuccessMsg("Commit 提交成功");
    } catch {
      // Error is set in gitStore
    }
  };

  const handlePush = async () => {
    if (!effectiveServerId || !rootPath) return;
    try {
      await pushChanges(effectiveServerId, rootPath);
      setActionSuccessMsg("Push 推送成功");
    } catch {}
  };

  const handlePull = async () => {
    if (!effectiveServerId || !rootPath) return;
    try {
      await pullChanges(effectiveServerId, rootPath);
      setActionSuccessMsg("Pull 拉取成功");
    } catch {}
  };

  const handleSync = async () => {
    if (!effectiveServerId || !rootPath) return;
    try {
      await syncChanges(effectiveServerId, rootPath);
      setActionSuccessMsg("Sync 同步成功");
    } catch {}
  };

  const handleGenerateAiCommit = async () => {
    if (!effectiveServerId || !rootPath) return;
    await generateAiCommit(effectiveServerId, rootPath);
  };

  const handleSwitchAccount = async (account: string) => {
    if (!effectiveServerId || account === ghAuth?.active_account) {
      setIsGhMenuOpen(false);
      return;
    }
    try {
      await switchGhAccount(effectiveServerId, account);
      setIsGhMenuOpen(false);
      setActionSuccessMsg(`已切换至 GitHub 账号: ${account}`);
    } catch {}
  };

  const toggleLanguage = () => {
    setCommitLang(commitLang === "en" ? "zh" : "en");
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
            disabled={loading || isOperating}
            className="p-1 rounded hover:bg-vscode-hover text-vscode-textMuted hover:text-white transition-colors cursor-pointer disabled:opacity-50"
            title="刷新 Git 与 GitHub 状态"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading || ghLoading ? "animate-spin" : ""}`} />
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
            {/* Branch & GitHub Account Toolbar */}
            <div className="p-2 border-b border-vscode-border/50 bg-[#202021] flex-shrink-0 space-y-1.5">
              {/* Branch Selector */}
              <div className="flex items-center justify-between gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsBranchModalOpen(true)}
                  className="flex-1 px-2 py-1 rounded bg-vscode-bg hover:bg-vscode-hover border border-vscode-border/70 hover:border-vscode-activityBarActive/80 flex items-center justify-between text-xs font-mono text-vscode-textBright transition-colors cursor-pointer group shadow-2xs"
                  title="点击切换分支"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <GitBranch className="w-3.5 h-3.5 text-vscode-activityBarActive flex-shrink-0" />
                    <span className="font-semibold truncate">{currentBranch || "HEAD detached"}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-vscode-textMuted group-hover:text-white flex-shrink-0">
                    <span>{branches.length}</span>
                    <ChevronDown className="w-3 h-3" />
                  </div>
                </button>
              </div>

              {/* GitHub CLI Account Switcher */}
              <div className="relative" ref={ghMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsGhMenuOpen(!isGhMenuOpen)}
                  className="w-full px-2 py-1 rounded bg-vscode-bg/80 hover:bg-vscode-hover border border-vscode-border/60 hover:border-purple-500/70 flex items-center justify-between text-xs transition-colors cursor-pointer group"
                  title="点击查看并切换当前 GitHub CLI 活跃账号"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <Github className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                    <span className="text-[11px] text-vscode-textMuted">gh auth:</span>
                    <span className="font-mono font-medium truncate text-vscode-textBright">
                      {ghLoading ? "检测中..." : ghAuth?.active_account || (ghAuth?.is_installed ? "未登录账号" : "未安装 gh")}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-vscode-textMuted group-hover:text-white flex-shrink-0">
                    {ghAuth?.accounts && ghAuth.accounts.length > 0 && (
                      <span className="bg-[#2a2a2a] px-1 rounded text-[10px]">
                        {ghAuth.accounts.length}
                      </span>
                    )}
                    <ChevronDown className="w-3 h-3" />
                  </div>
                </button>

                {/* GitHub Accounts Dropdown Menu */}
                {isGhMenuOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-[#252526] border border-vscode-border rounded-lg shadow-xl overflow-hidden py-1 text-xs animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-2.5 py-1 text-[10px] uppercase font-semibold text-vscode-textMuted border-b border-vscode-border/50 flex items-center justify-between">
                      <span>GitHub 账号 (gh auth)</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (effectiveServerId) fetchGhAuth(effectiveServerId);
                        }}
                        className="hover:text-white transition-colors"
                        title="刷新账号列表"
                      >
                        <RefreshCw className={`w-2.5 h-2.5 ${ghLoading ? "animate-spin" : ""}`} />
                      </button>
                    </div>

                    {(!ghAuth?.accounts || ghAuth.accounts.length === 0) ? (
                      <div className="px-3 py-2 text-[11px] text-vscode-textMuted text-center">
                        {ghAuth?.is_installed
                          ? "暂未发现登录的 GitHub 账号，可在终端运行 gh auth login"
                          : "远端未安装 GitHub CLI (gh)"}
                      </div>
                    ) : (
                      ghAuth.accounts.map((acc) => {
                        const isActive = acc === ghAuth.active_account;
                        return (
                          <div
                            key={acc}
                            onClick={() => handleSwitchAccount(acc)}
                            className={`px-2.5 py-1.5 flex items-center justify-between font-mono cursor-pointer transition-colors ${
                              isActive
                                ? "bg-purple-950/40 text-purple-200 font-semibold"
                                : "hover:bg-vscode-hover text-vscode-textBright"
                            }`}
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              <Github className="w-3 h-3 text-purple-400 flex-shrink-0" />
                              <span className="truncate">{acc}</span>
                            </div>
                            {isActive && <Check className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Push, Pull, Sync Action Buttons */}
              <div className="flex items-center gap-1 pt-0.5">
                <button
                  type="button"
                  onClick={handlePull}
                  disabled={loading || isOperating}
                  className="flex-1 py-1 px-1.5 rounded bg-[#2a2a2b] hover:bg-[#353536] border border-vscode-border/60 hover:border-vscode-border text-vscode-textBright text-[11px] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                  title="拉取远端更新 (git pull)"
                >
                  <ArrowDown className={`w-3 h-3 text-emerald-400 ${operatingAction === "pull" ? "animate-bounce" : ""}`} />
                  <span>Pull</span>
                </button>

                <button
                  type="button"
                  onClick={handlePush}
                  disabled={loading || isOperating}
                  className="flex-1 py-1 px-1.5 rounded bg-[#2a2a2b] hover:bg-[#353536] border border-vscode-border/60 hover:border-vscode-border text-vscode-textBright text-[11px] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                  title="推送本地提交 (git push)"
                >
                  <ArrowUp className={`w-3 h-3 text-sky-400 ${operatingAction === "push" ? "animate-bounce" : ""}`} />
                  <span>Push</span>
                </button>

                <button
                  type="button"
                  onClick={handleSync}
                  disabled={loading || isOperating}
                  className="flex-1 py-1 px-1.5 rounded bg-[#2a2a2b] hover:bg-[#353536] border border-vscode-border/60 hover:border-vscode-border text-vscode-textBright text-[11px] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                  title="同步 (先 pull 再 push)"
                >
                  <ArrowUpDown className={`w-3 h-3 text-amber-400 ${operatingAction === "sync" ? "animate-spin" : ""}`} />
                  <span>Sync</span>
                </button>
              </div>
            </div>

            {/* Success Message Banner */}
            {actionSuccessMsg && (
              <div className="p-2 m-2 rounded bg-emerald-950/50 border border-emerald-800/60 text-emerald-300 text-[11px] flex items-center gap-1.5 animate-in fade-in duration-150">
                <Check className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{actionSuccessMsg}</span>
              </div>
            )}

            {/* Error Banner */}
            {error && (
              <div className="p-2 m-2 rounded bg-red-950/40 border border-red-800/60 text-red-300 text-[11px] flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5 truncate">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-red-400" />
                  <span className="truncate">{error}</span>
                </div>
                <button
                  type="button"
                  onClick={() => useGitStore.setState({ error: null })}
                  className="text-red-400 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Commit Message & AI Section */}
            <div className="p-2.5 border-b border-vscode-border/50 bg-[#1c1c1d] flex-shrink-0 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-vscode-textBright uppercase tracking-wider text-[10px]">
                  Commit
                </span>

                <div className="flex items-center gap-1">
                  {/* Language Switcher */}
                  <button
                    type="button"
                    onClick={toggleLanguage}
                    className="px-1.5 py-0.5 rounded bg-[#2a2a2a] hover:bg-[#383838] text-[10px] font-mono text-vscode-textBright flex items-center gap-1 transition-colors cursor-pointer"
                    title={`当前语言: ${commitLang === "en" ? "英文 (English)" : "中文"}，点击切换`}
                  >
                    <Languages className="w-2.5 h-2.5 text-sky-400" />
                    <span>{commitLang.toUpperCase()}</span>
                  </button>

                  {/* AI Generate Button */}
                  <button
                    type="button"
                    onClick={handleGenerateAiCommit}
                    disabled={aiGenerating || isOperating || changes.length === 0}
                    className="px-2 py-0.5 rounded bg-purple-900/60 hover:bg-purple-800/80 border border-purple-600/50 hover:border-purple-400 text-[10px] font-medium text-purple-200 flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
                    title="点击根据当前 Diff 自动生成 Conventional Commit Message"
                  >
                    <Sparkles className={`w-3 h-3 text-purple-300 ${aiGenerating ? "animate-spin text-amber-300" : ""}`} />
                    <span>{aiGenerating ? "生成中..." : "AI 生成"}</span>
                  </button>

                  {/* AI Config Gear */}
                  <button
                    type="button"
                    onClick={() => setIsAiModalOpen(true)}
                    className="p-1 rounded hover:bg-vscode-hover text-vscode-textMuted hover:text-white transition-colors cursor-pointer"
                    title="配置 AI API Key / Base URL / 模型"
                  >
                    <Settings className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Commit Message Textarea */}
              <div className="relative">
                <textarea
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                      e.preventDefault();
                      handleCommit();
                    }
                  }}
                  rows={2}
                  placeholder={
                    commitLang === "zh"
                      ? "输入提交描述 (Ctrl+Enter 快速提交)..."
                      : "Commit message (Ctrl+Enter to commit)..."
                  }
                  className="w-full bg-[#141414] border border-vscode-border/80 focus:border-vscode-activityBarActive rounded p-2 text-xs font-mono text-vscode-textBright placeholder-vscode-textMuted/60 outline-hidden resize-none leading-relaxed"
                />
              </div>

              {/* Commit Primary Action */}
              <button
                type="button"
                onClick={handleCommit}
                disabled={!commitMessage.trim() || isOperating || loading || changes.length === 0}
                className="w-full py-1.5 rounded bg-vscode-activityBarActive hover:bg-vscode-activityBarActive/90 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
              >
                <GitCommit className={`w-3.5 h-3.5 ${operatingAction === "commit" ? "animate-spin" : ""}`} />
                <span>
                  {operatingAction === "commit"
                    ? "提交中..."
                    : `Commit (${changes.length})`}
                </span>
              </button>
            </div>

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

      {/* AI Config Modal */}
      <AiConfigModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
      />
    </div>
  );
};
