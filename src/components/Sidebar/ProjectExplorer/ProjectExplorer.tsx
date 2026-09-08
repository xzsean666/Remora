import React, { useEffect, useState, useMemo } from "react";
import {
  FilePlus,
  FolderPlus,
  RefreshCw,
  FoldHorizontal,
  FolderTree,
  FolderOpen,
  Server,
  Sparkles,
  Clock,
  ChevronRight,
  FolderX,
  Plus,
  Radio,
  Wifi,
  Loader2,
  Trash2,
  Folder,
  AlertCircle,
} from "lucide-react";
import { useFileTreeStore, RecentProject } from "../../../stores/fileTreeStore";
import { useConnectionStore } from "../../../stores/connectionStore";
import { useLayoutStore } from "../../../stores/layoutStore";
import { FileTreeNode } from "./FileTreeNode";
import { NewItemInput } from "./NewItemInput";
import { ContextMenu } from "../ContextMenu";
import { OpenFolderModal } from "./OpenFolderModal";
import { safeInvoke as invoke } from "../../../utils/tauriBridge";

function formatTimeAgo(timestamp: number): string {
  if (!timestamp) return "";
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

interface ProjectExplorerProps {
  onOpenFile?: (path: string, isPreview?: boolean) => void;
}

export const ProjectExplorer: React.FC<ProjectExplorerProps> = ({ onOpenFile }) => {
  const {
    rootPath,
    tree,
    collapseAll,
    createFile,
    createDir,
    refreshPath,
    setRoot,
    closeWorkspace,
    recentProjects,
    loadRecentProjects,
    removeRecentProject,
    loadingPaths,
    dirErrors,
  } = useFileTreeStore();

  const {
    serversList,
    serverStates,
    activeServerId,
    loadServers,
    setActiveServerId,
    setServerState,
    getActiveServerMeta,
    isServerConnected,
  } = useConnectionStore();

  const { setActiveSidebarTab } = useLayoutStore();

  const [creatingType, setCreatingType] = useState<"file" | "dir" | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [modalTargetServerId, setModalTargetServerId] = useState<string | null>(null);
  const [connectingServerId, setConnectingServerId] = useState<string | null>(null);

  useEffect(() => {
    loadServers();
    loadRecentProjects();
  }, [loadServers, loadRecentProjects]);

  const activeMeta = getActiveServerMeta();

  const handleConnectServer = async (srvId: string) => {
    setConnectingServerId(srvId);
    setServerState(srvId, "connecting");
    try {
      await invoke("connect_server", { serverId: srvId });
      setServerState(srvId, "connected");
      setActiveServerId(srvId);
    } catch (err) {
      setServerState(srvId, "failed", { error: String(err) });
      alert(`Connection failed: ${String(err)}`);
    } finally {
      setConnectingServerId(null);
    }
  };

  const handleOpenProject = async (
    serverId: string,
    remotePath: string,
    serverName?: string
  ) => {
    const isConn = isServerConnected(serverId);
    if (!isConn) {
      setConnectingServerId(serverId);
      setServerState(serverId, "connecting");
      try {
        await invoke("connect_server", { serverId });
        setServerState(serverId, "connected");
      } catch (err) {
        setServerState(serverId, "failed", { error: String(err) });
        alert(`Failed to connect to ${serverName || serverId}: ${String(err)}`);
        setConnectingServerId(null);
        return;
      }
      setConnectingServerId(null);
    }
    setActiveServerId(serverId);
    setActiveSidebarTab("explorer");
    await setRoot(serverId, remotePath, serverName);
  };

  const handleOpenModalForServer = (srvId?: string) => {
    setModalTargetServerId(srvId || activeServerId || (serversList[0]?.id ?? null));
    setShowOpenModal(true);
  };

  // Group recent projects by server_id
  const { categorizedProjects, uncategorizedProjects } = useMemo(() => {
    const categorized: Record<string, RecentProject[]> = {};
    const uncategorized: RecentProject[] = [];
    const knownServerIds = new Set(serversList.map((s) => s.id));

    for (const p of recentProjects) {
      if (knownServerIds.has(p.server_id)) {
        if (!categorized[p.server_id]) categorized[p.server_id] = [];
        categorized[p.server_id].push(p);
      } else {
        uncategorized.push(p);
      }
    }

    return { categorizedProjects: categorized, uncategorizedProjects: uncategorized };
  }, [recentProjects, serversList]);

  // ==========================================
  // CASE 1: No Folder / Project Opened Yet
  // Render Categorized View by SSH Server
  // ==========================================
  if (!rootPath) {
    return (
      <div className="flex flex-col h-full overflow-y-auto select-none text-xs">
        {/* Section Header */}
        <div className="h-7 px-3 bg-vscode-sidebar/90 border-b border-vscode-border/40 flex items-center justify-between font-bold text-[11px] text-vscode-textBright uppercase flex-shrink-0">
          <div className="flex items-center gap-1.5 truncate">
            <FolderTree className="w-3.5 h-3.5 text-vscode-activityBarActive flex-shrink-0" />
            <span className="truncate">Remote Projects / 远程项目</span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => handleOpenModalForServer()}
              title="Open Remote Folder / 打开项目"
              className="p-1 hover:text-white hover:bg-vscode-hover rounded flex items-center gap-1 text-[11px] text-vscode-activityBarActive font-medium transition-colors"
            >
              <FolderOpen className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                loadServers();
                loadRecentProjects();
              }}
              title="Refresh Servers & Projects"
              className="p-1 hover:text-white hover:bg-vscode-hover rounded transition-colors text-vscode-textMuted"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="p-3 flex flex-col gap-3 flex-1">
          {/* Primary Action Button */}
          <button
            onClick={() => handleOpenModalForServer()}
            className="w-full py-2.5 px-3 bg-vscode-activityBarActive text-white rounded-xl font-medium hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-xs text-xs group"
          >
            <FolderOpen className="w-4 h-4 group-hover:scale-105 transition-transform" />
            <span>Open Remote Folder / 打开远程项目</span>
          </button>

          {/* Active Server Quick Bar (if active and connected) */}
          {activeServerId && isServerConnected(activeServerId) && activeMeta && (
            <div className="p-2.5 rounded-xl bg-vscode-selected/10 border border-vscode-activityBarActive/40 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-vscode-activityBarActive flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Active Server: {activeMeta.name}
                </span>
                <button
                  onClick={() => handleOpenModalForServer(activeServerId)}
                  className="text-[10px] text-vscode-activityBarActive hover:underline font-medium"
                >
                  Browse...
                </button>
              </div>

              {/* Quick Shortcuts */}
              <div className="grid grid-cols-2 gap-1.5">
                {activeMeta.defaultWorkspace && (
                  <button
                    onClick={() =>
                      handleOpenProject(
                        activeServerId,
                        activeMeta.defaultWorkspace!,
                        activeMeta.name
                      )
                    }
                    className="p-1.5 rounded-lg bg-vscode-bg/70 border border-vscode-border hover:border-vscode-activityBarActive text-left flex items-center gap-1.5 group transition-colors truncate"
                    title={`Default: ${activeMeta.defaultWorkspace}`}
                  >
                    <Sparkles className="w-3 h-3 text-amber-400 flex-shrink-0" />
                    <span className="truncate text-[10px] text-vscode-textBright">
                      Default Workspace
                    </span>
                  </button>
                )}

                <button
                  onClick={() => {
                    const p =
                      activeMeta.username === "root"
                        ? "/root"
                        : `/home/${activeMeta.username || "ubuntu"}`;
                    handleOpenProject(activeServerId, p, activeMeta.name);
                  }}
                  className="p-1.5 rounded-lg bg-vscode-bg/70 border border-vscode-border hover:border-vscode-activityBarActive text-left flex items-center gap-1.5 group transition-colors truncate"
                  title="User Home Directory (~)"
                >
                  <Folder className="w-3 h-3 text-sky-400 flex-shrink-0" />
                  <span className="truncate text-[10px] text-vscode-textBright">
                    Home (~)
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Categorized Projects by SSH Server */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-vscode-textMuted px-0.5">
              <span>Projects by SSH Server (按服务器分类)</span>
              <span className="text-[10px] text-vscode-textMuted/60">
                {serversList.length} servers
              </span>
            </div>

            {serversList.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-vscode-border bg-vscode-bg/40 text-center flex flex-col items-center gap-2">
                <Server className="w-7 h-7 text-vscode-textMuted/50" />
                <div>
                  <p className="font-semibold text-vscode-textBright text-xs">
                    No SSH Servers Configured
                  </p>
                  <p className="text-[11px] text-vscode-textMuted mt-0.5 leading-relaxed">
                    Add and connect an SSH server to view and open remote project directories.
                  </p>
                </div>
                <button
                  onClick={() => setActiveSidebarTab("servers")}
                  className="mt-1 px-3 py-1.5 bg-vscode-selected text-white rounded-lg text-xs font-medium hover:brightness-110 transition-all flex items-center gap-1.5"
                >
                  <Server className="w-3.5 h-3.5" />
                  Configure SSH Servers
                </button>
              </div>
            ) : (
              serversList.map((srv) => {
                const status = serverStates[srv.id] || "disconnected";
                const isConn = status === "connected";
                const isAct = activeServerId === srv.id && isConn;
                const isConnecting =
                  status === "connecting" || connectingServerId === srv.id;
                const srvProjects = categorizedProjects[srv.id] || [];

                return (
                  <div
                    key={srv.id}
                    className={`rounded-xl border transition-all overflow-hidden ${
                      isAct
                        ? "bg-vscode-selected/10 border-vscode-activityBarActive/70 shadow-xs"
                        : isConn
                        ? "bg-vscode-bg/60 border-emerald-500/30"
                        : "bg-vscode-bg/40 border-vscode-border"
                    }`}
                  >
                    {/* Server Group Header */}
                    <div className="p-2.5 border-b border-vscode-border/40 bg-vscode-sidebar/40 flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div
                          className={`p-1 rounded-md flex-shrink-0 ${
                            isAct
                              ? "bg-vscode-activityBarActive/20 text-vscode-activityBarActive"
                              : isConn
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-vscode-border/40 text-vscode-textMuted"
                          }`}
                        >
                          <Server className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="font-semibold text-vscode-textBright truncate text-xs"
                              title={srv.name}
                            >
                              {srv.name}
                            </span>
                            {isAct && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-vscode-activityBarActive text-white font-medium flex-shrink-0">
                                Active
                              </span>
                            )}
                            {!isAct && isConn && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-medium flex-shrink-0">
                                Online
                              </span>
                            )}
                            {!isConn && !isConnecting && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-vscode-border text-vscode-textMuted font-mono flex-shrink-0">
                                Offline
                              </span>
                            )}
                            {isConnecting && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono flex-shrink-0 flex items-center gap-1">
                                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                Connecting
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] font-mono text-vscode-textMuted truncate">
                            {srv.username}@{srv.host}:{srv.port}
                          </div>
                        </div>
                      </div>

                      {/* Header Server Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {!isConn && (
                          <button
                            onClick={() => handleConnectServer(srv.id)}
                            disabled={isConnecting}
                            className="px-2 py-1 rounded bg-vscode-hover hover:bg-vscode-selected text-vscode-text hover:text-white text-[10px] font-medium transition-colors flex items-center gap-1"
                            title="Connect to this SSH server"
                          >
                            {isConnecting ? (
                              <Loader2 className="w-3 h-3 animate-spin text-vscode-activityBarActive" />
                            ) : (
                              <Wifi className="w-3 h-3 text-emerald-400" />
                            )}
                            <span>Connect</span>
                          </button>
                        )}

                        {isConn && !isAct && (
                          <button
                            onClick={() => setActiveServerId(srv.id)}
                            className="px-1.5 py-1 rounded bg-vscode-activityBarActive/20 text-vscode-activityBarActive hover:bg-vscode-activityBarActive hover:text-white text-[10px] font-medium transition-colors flex items-center gap-1"
                            title="Set as active server"
                          >
                            <Radio className="w-3 h-3" />
                            <span>Set Active</span>
                          </button>
                        )}

                        <button
                          onClick={() => handleOpenModalForServer(srv.id)}
                          className="p-1 rounded text-vscode-textMuted hover:text-white hover:bg-vscode-hover transition-colors"
                          title={`Open a directory on ${srv.name}`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Categorized Projects under this server */}
                    <div className="p-1.5 flex flex-col gap-1">
                      {srvProjects.length > 0 ? (
                        srvProjects.map((p) => (
                          <div
                            key={p.id}
                            onClick={() =>
                              handleOpenProject(srv.id, p.remote_path, srv.name)
                            }
                            className="p-2 rounded-lg bg-vscode-bg/50 border border-vscode-border/50 hover:border-vscode-activityBarActive hover:bg-vscode-selected/10 cursor-pointer flex items-center justify-between group transition-all"
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <Folder className="w-3.5 h-3.5 text-vscode-activityBarActive flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-vscode-textBright truncate text-xs">
                                  {p.project_name}
                                </div>
                                <div
                                  className="text-[10px] font-mono text-vscode-textMuted truncate"
                                  title={p.remote_path}
                                >
                                  {p.remote_path}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {p.last_opened_at && (
                                <span className="text-[9px] text-vscode-textMuted/70 font-mono hidden sm:inline">
                                  {formatTimeAgo(p.last_opened_at)}
                                </span>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeRecentProject(p.id);
                                }}
                                title="Remove project from history"
                                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:text-rose-400 hover:bg-vscode-border text-vscode-textMuted transition-all"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                              <ChevronRight className="w-3.5 h-3.5 text-vscode-textMuted group-hover:text-vscode-activityBarActive transition-transform group-hover:translate-x-0.5" />
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="px-2.5 py-2 rounded-lg bg-vscode-bg/20 border border-dashed border-vscode-border/50 text-[10px] text-vscode-textMuted flex items-center justify-between">
                          <span>No recent projects on this server</span>
                          <button
                            onClick={() => handleOpenModalForServer(srv.id)}
                            className="text-vscode-activityBarActive hover:underline font-medium flex items-center gap-1 text-[10px]"
                          >
                            <FolderOpen className="w-3 h-3" />
                            Open Folder
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {/* Uncategorized / Legacy Projects (if any) */}
            {uncategorizedProjects.length > 0 && (
              <div className="rounded-xl border border-vscode-border bg-vscode-bg/30 overflow-hidden mt-1">
                <div className="p-2 border-b border-vscode-border/40 text-[10px] font-semibold text-vscode-textMuted uppercase flex items-center gap-1.5">
                  <Clock className="w-3 h-3" />
                  <span>Other / Archived Projects</span>
                </div>
                <div className="p-1.5 flex flex-col gap-1">
                  {uncategorizedProjects.map((p) => (
                    <div
                      key={p.id}
                      onClick={() =>
                        handleOpenProject(p.server_id, p.remote_path, p.server_name)
                      }
                      className="p-2 rounded-lg bg-vscode-bg/50 border border-vscode-border/50 hover:border-vscode-activityBarActive cursor-pointer flex items-center justify-between group transition-all"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Folder className="w-3.5 h-3.5 text-vscode-textMuted flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-vscode-textBright truncate text-xs">
                            {p.project_name}{" "}
                            <span className="text-[10px] text-vscode-textMuted font-normal">
                              ({p.server_name})
                            </span>
                          </div>
                          <div className="text-[10px] font-mono text-vscode-textMuted truncate">
                            {p.remote_path}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeRecentProject(p.id);
                        }}
                        title="Remove project from history"
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:text-rose-400 hover:bg-vscode-border text-vscode-textMuted transition-all"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <OpenFolderModal
          isOpen={showOpenModal}
          onClose={() => setShowOpenModal(false)}
          targetServerId={modalTargetServerId}
        />
      </div>
    );
  }

  // Case 3: Folder IS opened
  const rootEntries = tree[rootPath] || [];
  const rootName = rootPath.split("/").filter(Boolean).pop() || rootPath;

  const handleRootContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden select-none">
      {/* Explorer Section Title & Actions Header */}
      <div className="h-7 px-2.5 bg-vscode-sidebar/90 border-b border-vscode-border/40 flex items-center justify-between text-[11px] font-bold text-vscode-textBright group flex-shrink-0">
        <div
          onContextMenu={handleRootContextMenu}
          className="flex items-center gap-1.5 truncate min-w-0 flex-1 cursor-pointer hover:underline mr-1"
          title={`Server: ${activeMeta?.name || activeServerId}\nPath: ${rootPath}`}
        >
          <span className="text-[10px] text-vscode-activityBarActive font-mono px-1 py-0.2 rounded bg-vscode-activityBarActive/10 border border-vscode-activityBarActive/20 flex-shrink-0">
            {activeMeta?.name || "SSH"}
          </span>
          <span className="truncate uppercase font-bold text-vscode-textBright">{rootName}</span>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button
            title="Open Another Remote Folder / 切换或打开新项目"
            onClick={() => {
              setModalTargetServerId(activeServerId);
              setShowOpenModal(true);
            }}
            className="p-1 hover:text-white hover:bg-vscode-hover rounded transition-colors text-vscode-activityBarActive"
          >
            <FolderOpen className="w-3.5 h-3.5" />
          </button>
          <button
            title="New File in Root"
            onClick={() => setCreatingType("file")}
            className="p-1 hover:text-white hover:bg-vscode-hover rounded transition-colors"
          >
            <FilePlus className="w-3.5 h-3.5" />
          </button>
          <button
            title="New Folder in Root"
            onClick={() => setCreatingType("dir")}
            className="p-1 hover:text-white hover:bg-vscode-hover rounded transition-colors"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
          <button
            title="Refresh Explorer"
            onClick={() => refreshPath(rootPath)}
            className="p-1 hover:text-white hover:bg-vscode-hover rounded transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            title="Collapse All Folders"
            onClick={collapseAll}
            className="p-1 hover:text-white hover:bg-vscode-hover rounded transition-colors"
          >
            <FoldHorizontal className="w-3.5 h-3.5" />
          </button>
          <button
            title="Close Workspace Folder"
            onClick={closeWorkspace}
            className="p-1 hover:text-rose-400 hover:bg-vscode-hover rounded transition-colors"
          >
            <FolderX className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tree Content */}
      <div
        onContextMenu={handleRootContextMenu}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-1"
      >
        {/* Creating new item in root */}
        {creatingType && (
          <div className="h-6 flex items-center px-3 min-w-0">
            <div className="flex-1 min-w-0">
              <NewItemInput
                onConfirm={async (name) => {
                  const type = creatingType;
                  setCreatingType(null);
                  if (type === "file") {
                    await createFile(rootPath, name);
                  } else {
                    await createDir(rootPath, name);
                  }
                }}
                onCancel={() => setCreatingType(null)}
              />
            </div>
          </div>
        )}

        {/* Loading Spinner */}
        {loadingPaths.includes(rootPath) && (
          <div className="flex flex-col items-center justify-center p-8 text-vscode-textMuted gap-2.5">
            <Loader2 className="w-5 h-5 animate-spin text-vscode-activityBarActive" />
            <span className="text-xs">Loading {rootPath}...</span>
          </div>
        )}

        {/* Directory Load Error Card */}
        {dirErrors[rootPath] && !loadingPaths.includes(rootPath) && (
          <div className="m-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex flex-col gap-2">
            <div className="flex items-center gap-1.5 font-semibold text-xs text-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>Failed to open directory</span>
            </div>
            <p className="text-[11px] leading-relaxed text-rose-300 font-mono break-all">
              {dirErrors[rootPath]}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={() => refreshPath(rootPath)}
                className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 rounded text-[11px] flex items-center gap-1 transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                Retry
              </button>
              <button
                onClick={() => {
                  setModalTargetServerId(activeServerId);
                  setShowOpenModal(true);
                }}
                className="px-2.5 py-1 bg-vscode-hover hover:bg-vscode-selected text-white rounded text-[11px] flex items-center gap-1 transition-colors"
              >
                <FolderOpen className="w-3 h-3" />
                Change Folder
              </button>
              <button
                onClick={closeWorkspace}
                className="px-2.5 py-1 text-vscode-textMuted hover:text-white text-[11px] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Tree Entries */}
        {!loadingPaths.includes(rootPath) && !dirErrors[rootPath] && (
          <>
            {rootEntries.map((entry) => (
              <FileTreeNode
                key={entry.path}
                entry={entry}
                level={0}
                onOpenFile={onOpenFile}
              />
            ))}

            {rootEntries.length === 0 && !creatingType && (
              <div className="p-6 text-center text-xs text-vscode-textMuted flex flex-col items-center gap-2">
                <Folder className="w-8 h-8 text-vscode-textMuted/40" />
                <span className="font-medium text-vscode-textBright">Directory is empty</span>
                <span className="text-[11px] text-vscode-textMuted max-w-[200px] leading-relaxed">
                  No files found in <code className="font-mono text-vscode-textBright">{rootPath}</code>.
                </span>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => setCreatingType("file")}
                    className="px-2.5 py-1 bg-vscode-selected text-white rounded text-[11px] flex items-center gap-1"
                  >
                    <FilePlus className="w-3 h-3" />
                    New File
                  </button>
                  <button
                    onClick={closeWorkspace}
                    className="px-2.5 py-1 bg-vscode-bg border border-vscode-border hover:text-white rounded text-[11px]"
                  >
                    Back to Projects
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Root Context Menu */}
      {contextMenuPos && (
        <ContextMenu
          x={contextMenuPos.x}
          y={contextMenuPos.y}
          isDir={true}
          onClose={() => setContextMenuPos(null)}
          onNewFile={() => setCreatingType("file")}
          onNewFolder={() => setCreatingType("dir")}
          onRefresh={() => refreshPath(rootPath)}
          onCopyPath={() => navigator.clipboard.writeText(rootPath)}
        />
      )}

      <OpenFolderModal
        isOpen={showOpenModal}
        onClose={() => setShowOpenModal(false)}
        targetServerId={modalTargetServerId || activeServerId}
      />
    </div>
  );
};

