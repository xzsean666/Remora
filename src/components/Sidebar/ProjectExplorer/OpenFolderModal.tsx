import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  FolderOpen,
  Folder,
  Server,
  Clock,
  Trash2,
  X,
  Sparkles,
  ChevronRight,
  Loader2,
  ArrowUp,
  RotateCw,
  Check,
  File,
  CornerDownRight,
  Compass,
} from "lucide-react";
import { safeInvoke as invoke, formatErrorMessage } from "../../../utils/tauriBridge";
import { useFileTreeStore, RecentProject, FileEntry } from "../../../stores/fileTreeStore";
import { useConnectionStore } from "../../../stores/connectionStore";
import { useLayoutStore } from "../../../stores/layoutStore";

interface OpenFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetServerId?: string | null;
}

export const OpenFolderModal: React.FC<OpenFolderModalProps> = ({
  isOpen,
  onClose,
  targetServerId,
}) => {
  const {
    activeServerId,
    serversList,
    serverMetas,
    isServerConnected,
    setActiveServerId,
    setServerState,
  } = useConnectionStore();
  const { setRoot } = useFileTreeStore();
  const { setActiveSidebarTab } = useLayoutStore();

  const effectiveServerId =
    targetServerId || activeServerId || (serversList[0]?.id ?? null);
  const targetMeta = effectiveServerId ? serverMetas[effectiveServerId] : null;

  // Active Tab: "browse" (Directory Browser) or "recent" (Recent Projects by Server)
  const [activeTab, setActiveTab] = useState<"browse" | "recent">("browse");

  // Server selection
  const [selectedServerId, setSelectedServerId] = useState<string>(
    effectiveServerId || ""
  );

  // Path & Browser states
  const [currentBrowsePath, setCurrentBrowsePath] = useState<string>("/root");
  const [selectedFolderPath, setSelectedFolderPath] = useState<string>("/root");
  const [pathInput, setPathInput] = useState<string>("/root");
  const [browserEntries, setBrowserEntries] = useState<FileEntry[]>([]);
  const [isLoadingBrowser, setIsLoadingBrowser] = useState<boolean>(false);
  const [browserError, setBrowserError] = useState<string | null>(null);
  const [onlyShowFolders, setOnlyShowFolders] = useState<boolean>(true);

  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);

  // Group recent projects by server_id (MUST be called before any early return)
  const groupedProjects = useMemo(() => {
    const map: Record<string, RecentProject[]> = {};
    for (const p of recentProjects) {
      if (!map[p.server_id]) map[p.server_id] = [];
      map[p.server_id].push(p);
    }
    return map;
  }, [recentProjects]);

  const loadRecentProjects = useCallback(async () => {
    try {
      const res = await invoke<RecentProject[]>("get_recent_projects", { limit: 20 });
      setRecentProjects(res || []);
    } catch (err) {
      console.warn("Failed to load recent projects:", err);
    }
  }, []);

  // Helper to expand ~ or ~/
  const expandPath = useCallback(
    (rawPath: string, srvId: string) => {
      let clean = rawPath.trim();
      const meta = serverMetas[srvId];
      if (clean === "~" || clean.startsWith("~/")) {
        const userHome =
          meta?.username === "root"
            ? "/root"
            : `/home/${meta?.username || "ubuntu"}`;
        clean = clean === "~" ? userHome : clean.replace(/^~\/?/, `${userHome}/`);
      }
      return clean;
    },
    [serverMetas]
  );

  // Load directory entries for the current server
  const loadDirectory = useCallback(
    async (srvId: string, rawDir: string) => {
      if (!srvId) return;

      const expanded = expandPath(rawDir, srvId);
      let targetPath = expanded === "/" ? "/" : expanded.replace(/\/+$/, "");
      if (!targetPath.startsWith("/")) {
        targetPath = "/" + targetPath;
      }

      // If server is offline, don't throw immediate error, just clear entries
      if (!isServerConnected(srvId)) {
        setCurrentBrowsePath(targetPath);
        setSelectedFolderPath(targetPath);
        setPathInput(targetPath);
        setBrowserEntries([]);
        setBrowserError(null);
        return;
      }

      setIsLoadingBrowser(true);
      setBrowserError(null);

      try {
        const entries = await invoke<FileEntry[]>("sftp_read_dir", {
          serverId: srvId,
          path: targetPath,
        });

        const list = (entries || []).slice().sort((a, b) => {
          if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
          return a.name.localeCompare(b.name);
        });

        setBrowserEntries(list);
        setCurrentBrowsePath(targetPath);
        setSelectedFolderPath(targetPath);
        setPathInput(targetPath);
      } catch (err) {
        console.error(`Failed to read remote directory ${targetPath}:`, err);
        setBrowserError(formatErrorMessage(err).replace(/^Error:\s*/, ""));
      } finally {
        setIsLoadingBrowser(false);
      }
    },
    [expandPath, isServerConnected]
  );

  // Initialize modal state on open
  useEffect(() => {
    if (isOpen) {
      loadRecentProjects();
      const currentId =
        targetServerId || activeServerId || (serversList[0]?.id ?? "");
      setSelectedServerId(currentId);

      const meta = serverMetas[currentId];
      let initialPath = "/root";
      if (meta?.defaultWorkspace) {
        initialPath = meta.defaultWorkspace;
      } else if (meta?.username === "root") {
        initialPath = "/root";
      } else if (meta?.username) {
        initialPath = `/home/${meta.username}`;
      }

      setPathInput(initialPath);
      setSelectedFolderPath(initialPath);
      setCurrentBrowsePath(initialPath);

      if (currentId && isServerConnected(currentId)) {
        loadDirectory(currentId, initialPath);
      }
    }
  }, [isOpen, targetServerId, activeServerId, serversList, serverMetas, isServerConnected, loadDirectory, loadRecentProjects]);

  // Parse breadcrumbs from currentBrowsePath (MUST be before any early return)
  const breadcrumbs = useMemo(() => {
    const segments = currentBrowsePath.split("/").filter(Boolean);
    const crumbs: { name: string; path: string }[] = [{ name: "/", path: "/" }];
    let accumulated = "";
    for (const seg of segments) {
      accumulated += "/" + seg;
      crumbs.push({ name: seg, path: accumulated });
    }
    return crumbs;
  }, [currentBrowsePath]);

  // Filter entries (MUST be before any early return)
  const displayedEntries = useMemo(() => {
    if (!onlyShowFolders) return browserEntries;
    return browserEntries.filter((e) => e.is_dir);
  }, [browserEntries, onlyShowFolders]);

  // If closed, return null AFTER all hooks are called
  if (!isOpen) return null;

  const currentMeta = serverMetas[selectedServerId] || targetMeta;
  const isSelectedSrvConnected = isServerConnected(selectedServerId);

  // Connect to server on-demand
  const handleConnectServer = async () => {
    if (!selectedServerId) return;
    setIsConnecting(true);
    setServerState(selectedServerId, "connecting");
    try {
      await invoke("connect_server", { serverId: selectedServerId });
      setServerState(selectedServerId, "connected");
      await loadDirectory(selectedServerId, pathInput || currentBrowsePath);
    } catch (err) {
      setServerState(selectedServerId, "failed", { error: formatErrorMessage(err) });
      alert(`Failed to connect to ${currentMeta?.name || selectedServerId}: ${formatErrorMessage(err)}`);
    } finally {
      setIsConnecting(false);
    }
  };

  // Open directory into workspace
  const handleOpen = async (pathToOpen?: string, overrideServerId?: string) => {
    const rawPath = pathToOpen || selectedFolderPath || pathInput;
    const srvId = overrideServerId || selectedServerId;

    if (!srvId) {
      alert("No active SSH server selected.");
      return;
    }

    const cleanPath = expandPath(rawPath, srvId);
    if (!cleanPath) {
      alert("Please enter or select a valid remote directory path.");
      return;
    }

    const targetServerMeta = serverMetas[srvId] || currentMeta;
    setIsConnecting(true);

    try {
      // Auto-connect if server is offline
      const isConn = isServerConnected(srvId);
      if (!isConn) {
        setServerState(srvId, "connecting");
        try {
          await invoke("connect_server", { serverId: srvId });
          setServerState(srvId, "connected");
        } catch (err) {
          setServerState(srvId, "failed", { error: formatErrorMessage(err) });
          alert(`Failed to connect to ${targetServerMeta?.name || srvId}: ${formatErrorMessage(err)}`);
          setIsConnecting(false);
          return;
        }
      }

      setActiveServerId(srvId);
      setActiveSidebarTab("explorer");
      await setRoot(srvId, cleanPath, targetServerMeta?.name);
      onClose();
    } catch (err) {
      alert(`Failed to open directory ${cleanPath}: ${formatErrorMessage(err)}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDeleteRecent = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await invoke("remove_recent_project", { id });
      setRecentProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error("Failed to remove recent project:", err);
    }
  };

  // Navigate up one level (Parent directory)
  const handleGoUp = () => {
    if (!currentBrowsePath || currentBrowsePath === "/") return;
    const parts = currentBrowsePath.split("/").filter(Boolean);
    parts.pop();
    const parent = parts.length === 0 ? "/" : "/" + parts.join("/");
    loadDirectory(selectedServerId, parent);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-vscode-sidebar border border-vscode-border rounded-xl shadow-2xl flex flex-col max-h-[88vh] overflow-hidden text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3 border-b border-vscode-border/60 flex items-center justify-between bg-vscode-bg/80 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-vscode-activityBarActive/15 text-vscode-activityBarActive">
              <FolderOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-semibold text-sm text-vscode-textBright">
                Open Remote Folder / 选择远程项目
              </h2>
              <p className="text-[11px] text-vscode-textMuted">
                Browse server directories or select recent workspaces
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-vscode-textMuted hover:text-white hover:bg-vscode-hover transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center border-b border-vscode-border/70 px-5 bg-vscode-bg/40 flex-shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("browse")}
            className={`px-3.5 py-2.5 text-xs font-medium border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === "browse"
                ? "border-vscode-activityBarActive text-vscode-activityBarActive"
                : "border-transparent text-vscode-textMuted hover:text-vscode-textBright"
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Browse Folders (远程文件夹浏览器)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("recent")}
            className={`px-3.5 py-2.5 text-xs font-medium border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === "recent"
                ? "border-vscode-activityBarActive text-vscode-activityBarActive"
                : "border-transparent text-vscode-textMuted hover:text-vscode-textBright"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Recent Projects (最近项目看板)</span>
            {recentProjects.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-vscode-border text-vscode-textMuted">
                {recentProjects.length}
              </span>
            )}
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {/* Target Server Selector */}
          <div>
            <label className="block text-[11px] font-medium text-vscode-textMuted mb-1.5 uppercase tracking-wider">
              Target SSH Server (目标服务器)
            </label>
            {serversList.length > 1 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-32 overflow-y-auto pr-1">
                {serversList.map((srv) => {
                  const isSel = srv.id === selectedServerId;
                  const isConn = isServerConnected(srv.id);
                  return (
                    <button
                      key={srv.id}
                      type="button"
                      onClick={() => {
                        setSelectedServerId(srv.id);
                        const meta = serverMetas[srv.id];
                        const initPath =
                          meta?.defaultWorkspace ||
                          (meta?.username === "root" ? "/root" : `/home/${meta?.username || "ubuntu"}`);
                        setPathInput(initPath);
                        setSelectedFolderPath(initPath);
                        setCurrentBrowsePath(initPath);
                        if (isConn) {
                          loadDirectory(srv.id, initPath);
                        } else {
                          setBrowserEntries([]);
                        }
                      }}
                      className={`p-2 rounded-lg border text-left flex items-center justify-between transition-all ${
                        isSel
                          ? "bg-vscode-selected/20 border-vscode-activityBarActive text-white"
                          : "bg-vscode-bg/50 border-vscode-border text-vscode-textMuted hover:text-white hover:border-vscode-border/80"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Server
                          className={`w-3.5 h-3.5 flex-shrink-0 ${
                            isConn ? "text-emerald-400" : "text-vscode-textMuted"
                          }`}
                        />
                        <div className="min-w-0">
                          <div className="font-medium truncate text-vscode-textBright text-[11px]">
                            {srv.name}
                          </div>
                          <div className="font-mono text-[9px] text-vscode-textMuted truncate">
                            {srv.username}@{srv.host}:{srv.port}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {isConn ? (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-medium">
                            Online
                          </span>
                        ) : (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-vscode-border text-vscode-textMuted font-mono">
                            Offline
                          </span>
                        )}
                        {isSel && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-vscode-activityBarActive text-white font-medium">
                            Selected
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-2.5 rounded-lg bg-vscode-bg/60 border border-vscode-border flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <Server className="w-3.5 h-3.5 text-vscode-activityBarActive flex-shrink-0" />
                  <span className="font-medium text-vscode-textBright truncate">
                    {currentMeta ? currentMeta.name : selectedServerId || "No Server"}
                  </span>
                  {currentMeta?.username && currentMeta?.host && (
                    <span className="font-mono text-[11px] text-vscode-textMuted truncate">
                      ({currentMeta.username}@{currentMeta.host}:{currentMeta.port})
                    </span>
                  )}
                </div>
                {selectedServerId && (
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded font-medium flex-shrink-0 ${
                      isSelectedSrvConnected
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-vscode-border text-vscode-textMuted"
                    }`}
                  >
                    {isSelectedSrvConnected ? "Online" : "Offline"}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* TAB 1: BROWSE DIRECTORY */}
          {activeTab === "browse" && (
            <div className="space-y-3">
              {/* Path & Navigation Bar */}
              <div>
                <label className="block text-[11px] font-medium text-vscode-textMuted mb-1.5 uppercase tracking-wider">
                  Browse Remote Directory (选择与下钻目录)
                </label>

                {/* Breadcrumbs Row */}
                <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-vscode-bg border border-vscode-border/80 overflow-x-auto text-xs mb-2">
                  <button
                    type="button"
                    onClick={handleGoUp}
                    disabled={currentBrowsePath === "/" || !isSelectedSrvConnected}
                    title="Parent Directory / 上一级目录"
                    className="px-2 py-1 rounded bg-vscode-sidebar hover:bg-vscode-hover border border-vscode-border text-vscode-textBright disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1 font-medium transition-colors flex-shrink-0"
                  >
                    <ArrowUp className="w-3 h-3" />
                    <span>Up</span>
                  </button>

                  <div className="h-4 w-[1px] bg-vscode-border/80 mx-0.5 flex-shrink-0" />

                  {/* Breadcrumb pills */}
                  <div className="flex items-center gap-1 min-w-0 flex-1 overflow-x-auto py-0.5">
                    {breadcrumbs.map((crumb, idx) => {
                      const isLast = idx === breadcrumbs.length - 1;
                      return (
                        <React.Fragment key={crumb.path}>
                          {idx > 0 && <span className="text-vscode-textMuted/60 text-[10px]">/</span>}
                          <button
                            type="button"
                            onClick={() => loadDirectory(selectedServerId, crumb.path)}
                            disabled={!isSelectedSrvConnected}
                            className={`px-1.5 py-0.5 rounded font-mono text-[11px] transition-colors truncate max-w-[120px] ${
                              isLast
                                ? "bg-vscode-selected/30 text-vscode-activityBarActive font-semibold"
                                : "text-vscode-textMuted hover:text-white hover:bg-vscode-hover"
                            }`}
                            title={crumb.path}
                          >
                            {crumb.name}
                          </button>
                        </React.Fragment>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => loadDirectory(selectedServerId, currentBrowsePath)}
                    disabled={isLoadingBrowser || !isSelectedSrvConnected}
                    title="Refresh directory / 刷新当前目录"
                    className="p-1.5 rounded text-vscode-textMuted hover:text-white hover:bg-vscode-hover transition-colors flex-shrink-0"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${isLoadingBrowser ? "animate-spin" : ""}`} />
                  </button>
                </div>

                {/* Path input & Jump Bar */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={pathInput}
                    onChange={(e) => setPathInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        loadDirectory(selectedServerId, pathInput);
                      }
                    }}
                    placeholder="/root/project or /home/ubuntu/app"
                    className="flex-1 px-3 py-1.5 rounded-lg bg-vscode-bg border border-vscode-border text-white text-xs font-mono focus:outline-none focus:border-vscode-activityBarActive transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => loadDirectory(selectedServerId, pathInput)}
                    disabled={isLoadingBrowser}
                    className="px-3 py-1.5 bg-vscode-hover hover:bg-vscode-selected text-vscode-textBright rounded-lg font-medium border border-vscode-border transition-colors flex items-center gap-1.5 flex-shrink-0"
                  >
                    <CornerDownRight className="w-3.5 h-3.5 text-vscode-activityBarActive" />
                    <span>Go</span>
                  </button>
                </div>
              </div>

              {/* Quick Jump Shortcuts */}
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-1.5 items-center">
                  <span className="text-[10px] text-vscode-textMuted uppercase mr-1">Quick:</span>
                  {currentMeta?.defaultWorkspace && (
                    <button
                      type="button"
                      onClick={() => {
                        setPathInput(currentMeta.defaultWorkspace!);
                        loadDirectory(selectedServerId, currentMeta.defaultWorkspace!);
                      }}
                      className="px-2 py-1 rounded bg-vscode-bg/80 border border-vscode-border hover:border-vscode-activityBarActive text-vscode-textBright transition-colors flex items-center gap-1 font-mono text-[10px]"
                    >
                      <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                      Default: {currentMeta.defaultWorkspace}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const p =
                        currentMeta?.username === "root"
                          ? "/root"
                          : `/home/${currentMeta?.username || "ubuntu"}`;
                      setPathInput(p);
                      loadDirectory(selectedServerId, p);
                    }}
                    className="px-2 py-1 rounded bg-vscode-bg/80 border border-vscode-border hover:border-vscode-activityBarActive text-vscode-textBright transition-colors flex items-center gap-1 font-mono text-[10px]"
                  >
                    <Folder className="w-2.5 h-2.5 text-sky-400" />
                    ~ Home
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPathInput("/");
                      loadDirectory(selectedServerId, "/");
                    }}
                    className="px-2 py-1 rounded bg-vscode-bg/80 border border-vscode-border hover:border-vscode-activityBarActive text-vscode-textBright transition-colors flex items-center gap-1 font-mono text-[10px]"
                  >
                    <Folder className="w-2.5 h-2.5 text-slate-400" />
                    / (Root)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPathInput("/var/www");
                      loadDirectory(selectedServerId, "/var/www");
                    }}
                    className="px-2 py-1 rounded bg-vscode-bg/80 border border-vscode-border hover:border-vscode-activityBarActive text-vscode-textBright transition-colors flex items-center gap-1 font-mono text-[10px]"
                  >
                    <Folder className="w-2.5 h-2.5 text-slate-400" />
                    /var/www
                  </button>
                </div>

                <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-vscode-textMuted hover:text-vscode-textBright select-none">
                  <input
                    type="checkbox"
                    checked={onlyShowFolders}
                    onChange={(e) => setOnlyShowFolders(e.target.checked)}
                    className="rounded border-vscode-border text-vscode-activityBarActive focus:ring-0"
                  />
                  <span>Folders only</span>
                </label>
              </div>

              {/* Directory Content List */}
              <div className="border border-vscode-border/80 rounded-lg bg-vscode-bg/40 overflow-hidden flex flex-col">
                <div className="px-3 py-1.5 bg-vscode-sidebar/80 border-b border-vscode-border/60 flex items-center justify-between text-[11px] text-vscode-textMuted">
                  <span>Remote Directory Browser</span>
                  <span>
                    {displayedEntries.length} {displayedEntries.length === 1 ? "item" : "items"}
                  </span>
                </div>

                <div className="h-56 overflow-y-auto p-1.5 space-y-1">
                  {!isSelectedSrvConnected ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                      <Server className="w-8 h-8 text-vscode-textMuted/60" />
                      <div>
                        <div className="font-semibold text-vscode-textBright text-xs">
                          Server is Currently Offline
                        </div>
                        <p className="text-[11px] text-vscode-textMuted mt-0.5">
                          Connect to {currentMeta?.name || selectedServerId} to browse remote folders
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleConnectServer}
                        disabled={isConnecting}
                        className="px-3.5 py-1.5 rounded-lg bg-vscode-activityBarActive text-white font-medium hover:brightness-110 flex items-center gap-1.5 transition-all text-xs"
                      >
                        {isConnecting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Server className="w-3.5 h-3.5" />
                        )}
                        <span>{isConnecting ? "Connecting..." : "Connect to Browse"}</span>
                      </button>
                    </div>
                  ) : isLoadingBrowser ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
                      <Loader2 className="w-6 h-6 animate-spin text-vscode-activityBarActive" />
                      <span className="text-vscode-textMuted text-xs">
                        Reading remote directory contents...
                      </span>
                    </div>
                  ) : browserError ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2.5">
                      <div className="text-rose-400 font-medium text-xs">
                        {browserError}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => loadDirectory(selectedServerId, currentBrowsePath)}
                          className="px-3 py-1 rounded bg-vscode-border hover:bg-vscode-hover text-white text-xs font-medium transition-colors"
                        >
                          Retry
                        </button>
                        <button
                          type="button"
                          onClick={() => loadDirectory(selectedServerId, "/")}
                          className="px-3 py-1 rounded bg-vscode-border hover:bg-vscode-hover text-white text-xs font-medium transition-colors"
                        >
                          Go to /
                        </button>
                      </div>
                    </div>
                  ) : displayedEntries.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-1 text-vscode-textMuted">
                      <Folder className="w-6 h-6 opacity-40" />
                      <span className="text-xs">No subdirectories found in this folder.</span>
                      <span className="text-[10px] text-vscode-textMuted/60">
                        You can still open this folder directly as your project workspace.
                      </span>
                    </div>
                  ) : (
                    displayedEntries.map((entry) => {
                      const isSelected = selectedFolderPath === entry.path;
                      return (
                        <div
                          key={entry.path}
                          onClick={() => {
                            if (entry.is_dir) {
                              setSelectedFolderPath(entry.path);
                              setPathInput(entry.path);
                            }
                          }}
                          onDoubleClick={() => {
                            if (entry.is_dir) {
                              loadDirectory(selectedServerId, entry.path);
                            }
                          }}
                          className={`px-2.5 py-1.5 rounded-lg flex items-center justify-between cursor-pointer border transition-all ${
                            isSelected
                              ? "bg-vscode-selected/25 border-vscode-activityBarActive text-white"
                              : "border-transparent hover:bg-vscode-hover/70 text-vscode-text"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {entry.is_dir ? (
                              <Folder
                                className={`w-4 h-4 flex-shrink-0 ${
                                  isSelected ? "text-vscode-activityBarActive" : "text-amber-400/90"
                                }`}
                              />
                            ) : (
                              <File className="w-3.5 h-3.5 flex-shrink-0 text-vscode-textMuted" />
                            )}
                            <span className="font-medium text-xs truncate">
                              {entry.name}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {isSelected && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-vscode-activityBarActive/20 text-vscode-activityBarActive font-medium flex items-center gap-1">
                                <Check className="w-2.5 h-2.5" /> Selected
                              </span>
                            )}
                            {entry.is_dir && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  loadDirectory(selectedServerId, entry.path);
                                }}
                                title="Enter subfolder / 进入此目录"
                                className="p-1 rounded text-vscode-textMuted hover:text-white hover:bg-vscode-border transition-colors"
                              >
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Tips Banner */}
              <div className="text-[11px] text-vscode-textMuted/70 flex items-center justify-between px-1">
                <span>
                  💡 <b>Click</b> to select a folder • <b>Double-click</b> or click ➔ to enter subfolder
                </span>
                <span>
                  <b>单击</b>选择文件夹 • <b>双击</b>下钻子目录
                </span>
              </div>
            </div>
          )}

          {/* TAB 2: RECENT PROJECTS BY SERVER */}
          {activeTab === "recent" && (
            <div>
              {recentProjects.length > 0 ? (
                <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1">
                  {Object.entries(groupedProjects).map(([srvId, projects]) => {
                    const m = serverMetas[srvId];
                    const srvName = m ? m.name : projects[0]?.server_name || srvId;
                    const isSelectedSrv = srvId === selectedServerId;

                    return (
                      <div
                        key={srvId}
                        className={`rounded-lg border overflow-hidden transition-all ${
                          isSelectedSrv
                            ? "bg-vscode-bg/60 border-vscode-activityBarActive/40"
                            : "bg-vscode-bg/30 border-vscode-border/50"
                        }`}
                      >
                        {/* Server Group Header */}
                        <div
                          onClick={() => setSelectedServerId(srvId)}
                          className="px-3 py-2 bg-vscode-sidebar/50 border-b border-vscode-border/40 flex items-center justify-between cursor-pointer hover:bg-vscode-hover text-[11px]"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Server className="w-3.5 h-3.5 text-vscode-activityBarActive flex-shrink-0" />
                            <span className="font-semibold text-vscode-textBright truncate">
                              {srvName}
                            </span>
                            {m?.username && m?.host && (
                              <span className="font-mono text-[9px] text-vscode-textMuted truncate">
                                ({m.username}@{m.host}:{m.port})
                              </span>
                            )}
                          </div>
                          <span className="text-[9px] text-vscode-textMuted">
                            {projects.length} {projects.length === 1 ? "project" : "projects"}
                          </span>
                        </div>

                        {/* Project items */}
                        <div className="p-1.5 space-y-1">
                          {projects.map((p) => (
                            <div
                              key={p.id}
                              onClick={() => handleOpen(p.remote_path, srvId)}
                              className="p-2 rounded-md bg-vscode-bg/50 border border-vscode-border/40 hover:bg-vscode-selected/15 hover:border-vscode-activityBarActive/60 cursor-pointer flex items-center justify-between group transition-all"
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <Folder className="w-3.5 h-3.5 text-vscode-activityBarActive flex-shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-vscode-textBright truncate text-[11px]">
                                    {p.project_name}
                                  </div>
                                  <div className="text-[10px] font-mono text-vscode-textMuted truncate">
                                    {p.remote_path}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteRecent(e, p.id)}
                                  title="Remove from history"
                                  className="p-1 rounded text-vscode-textMuted hover:text-rose-400 hover:bg-vscode-border opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                                <ChevronRight className="w-3.5 h-3.5 text-vscode-textMuted group-hover:text-vscode-activityBarActive group-hover:translate-x-0.5 transition-transform" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center text-vscode-textMuted space-y-2">
                  <Clock className="w-8 h-8 mx-auto opacity-40" />
                  <div className="text-xs font-medium">No recent projects yet</div>
                  <p className="text-[11px] text-vscode-textMuted/70">
                    Open a folder using the "Browse Folders" tab to add it to your project history.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div className="px-5 py-3 border-t border-vscode-border/60 bg-vscode-bg/80 flex items-center justify-between gap-3 flex-shrink-0">
          <div className="min-w-0 flex-1 flex items-center gap-1.5 text-xs text-vscode-textMuted truncate">
            <span className="font-medium text-vscode-textBright flex-shrink-0">Selected / 已选路径:</span>
            <span className="font-mono text-white text-xs truncate bg-vscode-selected/20 px-2 py-0.5 rounded border border-vscode-border">
              {selectedFolderPath || pathInput || currentBrowsePath}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-vscode-border text-vscode-text hover:text-white hover:bg-vscode-hover transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleOpen()}
              disabled={isConnecting || !(selectedFolderPath || pathInput || currentBrowsePath)}
              className="px-4 py-1.5 rounded-lg bg-vscode-activityBarActive text-white font-medium hover:brightness-110 transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              {isConnecting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isConnecting ? "Connecting & Opening..." : "Open Selected Folder"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
