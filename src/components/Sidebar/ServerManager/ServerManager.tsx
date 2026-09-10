import React, { useEffect, useState } from "react";
import { safeInvoke as invoke, isRunningInTauri, formatErrorMessage } from "../../../utils/tauriBridge";
import {
  Server,
  Plus,
  Trash2,
  FolderOpen,
  Wifi,
  WifiOff,
  Key,
  Lock,
  Loader2,
  Globe,
  Pencil,
  ShieldCheck,
  X,
  Terminal,
  Sparkles,
  Copy,
  Check,
  Radio,
  FolderTree,
  ChevronRight,
} from "lucide-react";
import { useFileTreeStore } from "../../../stores/fileTreeStore";
import { useConnectionStore } from "../../../stores/connectionStore";
import { useLayoutStore } from "../../../stores/layoutStore";
import { parseSshCommand } from "../../../utils/sshParser";
import { OpenFolderModal } from "../ProjectExplorer/OpenFolderModal";
import { KeyManagerModal } from "./KeyManagerModal";
import { useSshKeyStore } from "../../../stores/sshKeyStore";

export const DEFAULT_NO_PROXY =
  "localhost,127.0.0.1,::1,10.0.0.0/8,172.16.0.0/12,172.17.0.0/16,172.18.0.0/16,172.19.0.0/16,172.20.0.0/16,192.168.0.0/16,*.local,.internal,host.docker.internal";

export interface ServerConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  auth_type: "password" | "private_key" | "agent";
  key_path?: string;
  default_workspace?: string;
  remote_proxy?: string;
  remote_no_proxy?: string;
  created_at: number;
  updated_at: number;
}

export const ServerManager: React.FC = () => {
  const [servers, setServers] = useState<ServerConfig[]>([]);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showKeyManagerModal, setShowKeyManagerModal] = useState(false);
  const [editingServerId, setEditingServerId] = useState<string | null>(null);
  const [openFolderServerId, setOpenFolderServerId] = useState<string | null>(null);

  const { keys: sshKeys, loadKeys: loadSshKeys } = useSshKeyStore();

  // Form states
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState("root");
  const [authType, setAuthType] = useState<"password" | "private_key" | "agent">("password");
  const [keyPath, setKeyPath] = useState("");
  const [secret, setSecret] = useState("");
  const [workspace, setWorkspace] = useState("/root");
  const [remoteProxy, setRemoteProxy] = useState("");
  const [remoteNoProxy, setRemoteNoProxy] = useState(DEFAULT_NO_PROXY);

  // Quick SSH command parse state
  const [sshCmdInput, setSshCmdInput] = useState("");
  const [parseFeedback, setParseFeedback] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [copiedProxy, setCopiedProxy] = useState<string | null>(null);

  const {
    setRoot,
    serverRoots,
    switchServer,
    recentProjects,
    loadRecentProjects,
    removeRecentProject,
  } = useFileTreeStore();
  const {
    serverStates,
    activeServerId,
    setServersList,
    setActiveServerId,
    setServerState,
    syncConnectionStates,
  } = useConnectionStore();
  const { setActiveSidebarTab } = useLayoutStore();

  const loadServers = async () => {
    try {
      const res = await invoke<ServerConfig[]>("get_servers");
      setServers(res);
      const metas = res.map((s) => ({
        id: s.id,
        name: s.name,
        host: s.host,
        port: s.port,
        username: s.username,
        remoteProxy: s.remote_proxy,
        defaultWorkspace: s.default_workspace,
      }));
      setServersList(metas);
      await syncConnectionStates();
      await loadRecentProjects();
    } catch (err) {
      console.error("Failed to load servers:", err);
    }
  };

  useEffect(() => {
    loadServers();
    loadSshKeys();
  }, []);

  const handleParseCommand = (cmd: string) => {
    const res = parseSshCommand(cmd);
    if (res.success && res.data) {
      setHost(res.data.host);
      setPort(res.data.port);
      setUsername(res.data.username);
      setAuthType(res.data.authType);
      if (res.data.keyPath) {
        setKeyPath(res.data.keyPath);
      }
      if (!name || name === "root" || name.includes("@") || editingServerId === null) {
        setName(res.data.name);
      }
      setParseFeedback({
        message: `Parsed: ${res.data.username}@${res.data.host}:${res.data.port}${res.data.keyPath ? ` (Key: ${res.data.keyPath})` : ""}`,
        type: "success",
      });
      setTimeout(() => setParseFeedback(null), 4000);
    } else {
      setParseFeedback({
        message: res.error || "Failed to parse SSH command",
        type: "error",
      });
      setTimeout(() => setParseFeedback(null), 4000);
    }
  };

  const resetForm = () => {
    setEditingServerId(null);
    setSshCmdInput("");
    setParseFeedback(null);
    setCopiedProxy(null);
    setName("");
    setHost("");
    setPort(22);
    setUsername("root");
    setAuthType("password");
    setKeyPath("");
    setSecret("");
    setWorkspace("/root");
    setRemoteProxy("");
    setRemoteNoProxy(DEFAULT_NO_PROXY);
  };

  const handleEdit = (srv: ServerConfig) => {
    setEditingServerId(srv.id);
    setSshCmdInput("");
    setParseFeedback(null);
    setCopiedProxy(null);
    setName(srv.name);
    setHost(srv.host);
    setPort(srv.port);
    setUsername(srv.username);
    setAuthType(srv.auth_type);
    setKeyPath(srv.key_path || "");
    setSecret(""); // Keep existing password in keyring unless re-entered
    setWorkspace(srv.default_workspace || "");
    setRemoteProxy(srv.remote_proxy || "");
    setRemoteNoProxy(
      srv.remote_no_proxy !== undefined && srv.remote_no_proxy !== null
        ? srv.remote_no_proxy
        : DEFAULT_NO_PROXY
    );
    setShowAddModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !host || !username) {
      alert("Please fill in Server Name, Host and Username");
      return;
    }

    const existingServer = editingServerId ? servers.find((s) => s.id === editingServerId) : null;
    const newServer: ServerConfig = {
      id: editingServerId || `srv-${Date.now()}`,
      name,
      host,
      port: Number(port) || 22,
      username,
      auth_type: authType,
      key_path: authType === "private_key" && keyPath ? keyPath : undefined,
      default_workspace: workspace || undefined,
      remote_proxy: remoteProxy.trim() ? remoteProxy.trim() : undefined,
      remote_no_proxy: remoteNoProxy.trim() ? remoteNoProxy.trim() : undefined,
      created_at: existingServer ? existingServer.created_at : Date.now(),
      updated_at: Date.now(),
    };

    try {
      await invoke("save_server", {
        server: newServer,
        secret: secret || null,
      });
      await loadServers();
      setShowAddModal(false);
      resetForm();
    } catch (err) {
      alert(`Failed to save server: ${formatErrorMessage(err)}`);
    }
  };

  const handleConnect = async (srv: ServerConfig) => {
    setConnectingId(srv.id);
    setServerState(srv.id, "connecting");
    try {
      await invoke("connect_server", { serverId: srv.id });
      setServerState(srv.id, "connected");
      if (!activeServerId || serverStates[activeServerId] !== "connected") {
        setActiveServerId(srv.id);
      }
    } catch (err) {
      setServerState(srv.id, "failed", { error: formatErrorMessage(err) });
      alert(`SSH Connection to ${srv.name} failed: ${formatErrorMessage(err)}`);
    } finally {
      setConnectingId(null);
    }
  };

  const handleDisconnect = async (srvId: string) => {
    try {
      await invoke("disconnect_server", { serverId: srvId });
      await syncConnectionStates();
      if (activeServerId === srvId) {
        setActiveServerId(null);
      }
    } catch (err) {
      console.error("Failed to disconnect from server:", err);
    }
  };

  const handleActivate = (srv: ServerConfig) => {
    switchServer(srv.id);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this server configuration?")) {
      try {
        await invoke("delete_server", { id });
        await loadServers();
      } catch (err) {
        console.error("Failed to delete server:", err);
      }
    }
  };

  return (
    <div className="flex flex-col h-full select-none text-xs">
      {/* Header with Add & Key Management Buttons */}
      <div className="h-7 px-3 bg-vscode-sidebar/90 border-b border-vscode-border/40 flex items-center justify-between font-bold text-[11px] text-vscode-textBright uppercase flex-shrink-0">
        <span className="truncate min-w-0 mr-1">Configured Servers ({servers.length})</span>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setShowKeyManagerModal(true)}
            title="Manage SSH Private Keys / 私钥管理"
            className="p-1 text-vscode-textMuted hover:text-amber-400 hover:bg-vscode-hover rounded flex items-center gap-1 text-xs transition-colors"
          >
            <Key className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            title="Add New SSH Server"
            className="p-1 hover:text-white hover:bg-vscode-hover rounded flex items-center gap-1 text-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Web Preview Mode notice if in browser */}
      {!isRunningInTauri() && (
        <div className="mx-2 mt-2 px-2.5 py-1.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] leading-relaxed flex-shrink-0">
          🌐 <strong>浏览器 Web 预览模式</strong>：数据已暂存至浏览器。连接真实 SSH 请在终端执行 <code className="bg-black/30 px-1 rounded font-mono text-amber-200">pnpm tauri dev</code> 启动桌面端。
        </div>
      )}

      {/* Server List */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2 flex flex-col gap-2">
        {servers.map((srv) => {
          const status = serverStates[srv.id] || "disconnected";
          const isConnected = status === "connected";
          const isConnecting = status === "connecting" || connectingId === srv.id;
          const isActive = activeServerId === srv.id && isConnected;
          const currentWorkspace = serverRoots[srv.id];

          return (
            <div
              key={srv.id}
              className={`p-3 rounded-xl border transition-all flex flex-col gap-2 min-w-0 ${
                isActive
                  ? "bg-vscode-selected/15 border-vscode-activityBarActive ring-1 ring-vscode-activityBarActive/40 text-white shadow-sm"
                  : isConnected
                  ? "bg-emerald-950/20 border-emerald-500/40 text-vscode-text hover:border-emerald-500/70"
                  : "bg-vscode-bg/60 border-vscode-border text-vscode-text hover:border-vscode-border/80"
              }`}
            >
              <div className="flex items-center justify-between gap-1.5 min-w-0">
                <div className="flex items-center gap-2 font-medium min-w-0 flex-1">
                  <div
                    className={`p-1.5 rounded-lg flex-shrink-0 ${
                      isActive
                        ? "bg-vscode-activityBarActive/20 text-vscode-activityBarActive"
                        : isConnected
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-vscode-border/40 text-vscode-textMuted"
                    }`}
                  >
                    <Server className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-vscode-textBright truncate text-xs" title={srv.name}>
                        {srv.name}
                      </span>
                      {isActive && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-vscode-activityBarActive text-white font-medium flex-shrink-0">
                          Active
                        </span>
                      )}
                      {!isActive && isConnected && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-medium flex-shrink-0">
                          Connected
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] font-mono text-vscode-textMuted truncate">
                      {srv.username}@{srv.host}:{srv.port}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  {isConnected ? (
                    <button
                      onClick={() => handleDisconnect(srv.id)}
                      title="Disconnect SSH"
                      className="p-1.5 text-emerald-400 hover:text-rose-400 hover:bg-vscode-hover rounded-md transition-colors"
                    >
                      <Wifi className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleConnect(srv)}
                      disabled={isConnecting}
                      title={status === "failed" ? "Retry SSH Connection" : "Connect SSH"}
                      className={`p-1.5 rounded-md transition-colors ${
                        status === "failed"
                          ? "text-rose-400 hover:bg-rose-500/20"
                          : "text-vscode-textMuted hover:text-emerald-400 hover:bg-vscode-hover"
                      }`}
                    >
                      {isConnecting ? (
                        <Loader2 className="w-4 h-4 animate-spin text-vscode-activityBarActive" />
                      ) : (
                        <WifiOff className="w-4 h-4" />
                      )}
                    </button>
                  )}

                  <button
                    onClick={() => handleEdit(srv)}
                    title="Edit Server"
                    className="p-1.5 text-vscode-textMuted hover:text-white hover:bg-vscode-hover rounded-md transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleDelete(srv.id)}
                    title="Delete Server"
                    className="p-1.5 text-vscode-textMuted hover:text-rose-400 hover:bg-vscode-hover rounded-md transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="capitalize text-[10px] px-1.5 py-0.5 rounded bg-vscode-sidebar border border-vscode-border text-vscode-textMuted font-mono">
                  {srv.auth_type}
                </span>

                {srv.remote_proxy && (
                  <span
                    className="text-[10px] text-sky-400 px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-500/20 flex items-center gap-1 font-mono truncate max-w-[180px]"
                    title={`Proxy: ${srv.remote_proxy}`}
                  >
                    <Globe className="w-2.5 h-2.5 flex-shrink-0" />
                    <span className="truncate">{srv.remote_proxy}</span>
                  </span>
                )}
              </div>

              {/* Active Server Switch Row */}
              {isConnected && (
                <div className="pt-2 border-t border-vscode-border/50 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-vscode-textMuted">
                    {isActive ? (
                      <span className="text-emerald-400 font-medium flex items-center gap-1">
                        <Check className="w-3 h-3" /> Current Active Server
                      </span>
                    ) : (
                      "Connected (Standby)"
                    )}
                  </span>

                  {!isActive && (
                    <button
                      onClick={() => handleActivate(srv)}
                      className="px-2 py-0.5 rounded bg-vscode-activityBarActive text-white text-[11px] font-medium hover:brightness-110 transition-all flex items-center gap-1 shadow-xs"
                    >
                      <Radio className="w-3 h-3" />
                      Set Active (激活)
                    </button>
                  )}
                </div>
              )}

              {/* Categorized Projects for this Server */}
              {(() => {
                const srvProjects = recentProjects.filter((p) => p.server_id === srv.id);

                return (
                  <div className="pt-2 border-t border-vscode-border/50 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-vscode-textBright flex items-center gap-1.5">
                        <FolderTree className="w-3.5 h-3.5 text-vscode-activityBarActive" />
                        <span>Projects / 最近项目 ({srvProjects.length})</span>
                      </span>
                      <button
                        onClick={() => setOpenFolderServerId(srv.id)}
                        className="text-[10px] text-vscode-activityBarActive hover:underline flex items-center gap-1 font-medium cursor-pointer"
                        title={`Open a directory on ${srv.name}`}
                      >
                        <Plus className="w-3 h-3" />
                        Open Project
                      </button>
                    </div>

                    {srvProjects.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {srvProjects.map((p) => {
                          const isOpened = currentWorkspace === p.remote_path;
                          return (
                            <div
                              key={p.id}
                              onClick={async () => {
                                if (!isConnected) {
                                  await handleConnect(srv);
                                }
                                setActiveServerId(srv.id);
                                await setRoot(srv.id, p.remote_path, srv.name);
                                setActiveSidebarTab("explorer");
                              }}
                              className={`px-2.5 py-1.5 rounded-lg border flex items-center justify-between group cursor-pointer transition-all ${
                                isOpened
                                  ? "bg-vscode-selected/20 border-vscode-activityBarActive text-white"
                                  : "bg-vscode-bg/70 border-vscode-border hover:border-vscode-activityBarActive/80 hover:bg-vscode-hover text-vscode-text"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <FolderOpen
                                  className={`w-3.5 h-3.5 flex-shrink-0 ${
                                    isOpened ? "text-emerald-400" : "text-vscode-activityBarActive"
                                  }`}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium truncate flex items-center gap-1.5">
                                    <span className="text-vscode-textBright">{p.project_name}</span>
                                    {isOpened && (
                                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                                        Opened
                                      </span>
                                    )}
                                  </div>
                                  <div
                                    className="text-[10px] font-mono text-vscode-textMuted truncate"
                                    title={p.remote_path}
                                  >
                                    {p.remote_path}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeRecentProject(p.id);
                                  }}
                                  title="Remove from history"
                                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:text-rose-400 hover:bg-vscode-border text-vscode-textMuted transition-all"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                                <ChevronRight className="w-3.5 h-3.5 text-vscode-textMuted group-hover:text-white transition-transform group-hover:translate-x-0.5" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-2 rounded-lg bg-vscode-bg/40 border border-vscode-border/50 text-[11px] text-vscode-textMuted flex items-center justify-between">
                        <span>No projects opened yet</span>
                        <button
                          onClick={() => setOpenFolderServerId(srv.id)}
                          className="text-vscode-activityBarActive hover:underline text-[11px] font-medium"
                        >
                          + Open folder...
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          );
        })}

        {servers.length === 0 && (
          <div className="text-center py-10 text-vscode-textMuted flex flex-col items-center gap-2">
            <Server className="w-8 h-8 opacity-20" />
            <p>No SSH servers added yet.</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-2 text-vscode-activityBarActive hover:underline text-xs"
            >
              + Add your first server
            </button>
          </div>
        )}
      </div>

      {/* Add / Edit Server Modal Dialog (Fixed out-of-frame overflow) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-hidden">
          <div className="w-full max-w-lg bg-vscode-sidebar border border-vscode-border rounded-xl shadow-2xl flex flex-col max-h-[88vh] text-vscode-text overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-3 border-b border-vscode-border/60 flex items-center justify-between flex-shrink-0">
              <h2 className="text-sm font-semibold text-vscode-textBright flex items-center gap-2">
                <Server className="w-4 h-4 text-vscode-activityBarActive" />
                <span>{editingServerId ? "Edit SSH Server" : "Add SSH Server"}</span>
              </h2>
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setShowAddModal(false);
                }}
                className="p-1 rounded text-vscode-textMuted hover:text-white hover:bg-vscode-hover transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form with Scrollable Content Body */}
            <form onSubmit={handleSave} className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 flex flex-col gap-3">
                {/* Quick Parse SSH Command Input */}
                <div className="bg-vscode-bg/80 border border-vscode-activityBarActive/40 rounded-lg p-2.5 flex flex-col gap-2">
                  <div className="flex items-center justify-between min-w-0">
                    <span className="text-[11px] font-semibold text-vscode-textBright flex items-center gap-1.5 truncate min-w-0">
                      <Terminal className="w-3.5 h-3.5 text-vscode-activityBarActive flex-shrink-0" />
                      <span>Quick Parse SSH Command / 快捷命令解析</span>
                    </span>
                    {parseFeedback && (
                      <span
                        className={`text-[10px] truncate max-w-[220px] flex-shrink-0 ${
                          parseFeedback.type === "success" ? "text-emerald-400 font-medium" : "text-rose-400"
                        }`}
                        title={parseFeedback.message}
                      >
                        {parseFeedback.message}
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="e.g. ssh -i ~/ssh/sean -p 22 root@192.168.31.110"
                      value={sshCmdInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSshCmdInput(val);
                        // If pasted or contains full command flags, auto parse
                        if (
                          val.trim().startsWith("ssh ") ||
                          val.includes(" -i ") ||
                          val.includes(" -p ") ||
                          val.includes("@")
                        ) {
                          handleParseCommand(val);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleParseCommand(sshCmdInput);
                        }
                      }}
                      className="flex-1 min-w-0 bg-vscode-sidebar border border-vscode-border rounded px-2.5 py-1.5 text-xs font-mono outline-none focus:border-vscode-activityBarActive transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => handleParseCommand(sshCmdInput)}
                      className="px-3 py-1.5 rounded bg-vscode-activityBarActive text-white text-xs hover:brightness-110 font-medium transition-all flex items-center gap-1 flex-shrink-0 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Parse / 解析</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] text-vscode-textMuted flex-wrap">
                    <span>Quick Examples:</span>
                    <button
                      type="button"
                      onClick={() => {
                        const cmd = "ssh -i ~/ssh/sean -p 22 root@192.168.31.110";
                        setSshCmdInput(cmd);
                        handleParseCommand(cmd);
                      }}
                      className="font-mono text-[10px] text-vscode-textMuted hover:text-white bg-vscode-sidebar px-1.5 py-0.5 rounded border border-vscode-border/60 hover:border-vscode-border transition-colors cursor-pointer select-all"
                      title="Click to parse: ssh -i ~/ssh/sean -p 22 root@192.168.31.110"
                    >
                      ssh -i ~/ssh/sean -p 22 root@192.168.31.110
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const cmd = "ssh -p 2222 root@192.168.31.110";
                        setSshCmdInput(cmd);
                        handleParseCommand(cmd);
                      }}
                      className="font-mono text-[10px] text-vscode-textMuted hover:text-white bg-vscode-sidebar px-1.5 py-0.5 rounded border border-vscode-border/60 hover:border-vscode-border transition-colors cursor-pointer select-all"
                      title="Click to parse: ssh -p 2222 root@192.168.31.110"
                    >
                      ssh -p 2222 root@192.168.31.110
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-vscode-textMuted block mb-1">Server Name</label>
                  <input
                    required
                    placeholder="e.g. Ubuntu Production"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-vscode-bg border border-vscode-border rounded px-2.5 py-1.5 text-xs outline-none focus:border-vscode-activityBarActive transition-colors"
                  />
                </div>

                <div className="flex gap-2">
                  <div className="flex-1 min-w-0">
                    <label className="text-[11px] text-vscode-textMuted block mb-1">Host / IP</label>
                    <input
                      required
                      placeholder="192.168.1.100"
                      value={host}
                      onChange={(e) => {
                        const val = e.target.value;
                        const trimmed = val.trim();
                        if (
                          trimmed.startsWith("ssh ") ||
                          trimmed.startsWith("ssh.exe ") ||
                          trimmed.includes(" -p ") ||
                          trimmed.includes(" -i ")
                        ) {
                          setSshCmdInput(val);
                          handleParseCommand(val);
                        } else {
                          setHost(val);
                        }
                      }}
                      className="w-full bg-vscode-bg border border-vscode-border rounded px-2.5 py-1.5 text-xs outline-none focus:border-vscode-activityBarActive transition-colors font-mono"
                    />
                  </div>
                  <div className="w-24 flex-shrink-0">
                    <label className="text-[11px] text-vscode-textMuted block mb-1">Port</label>
                    <input
                      type="number"
                      value={port}
                      onChange={(e) => setPort(Number(e.target.value))}
                      className="w-full bg-vscode-bg border border-vscode-border rounded px-2.5 py-1.5 text-xs outline-none focus:border-vscode-activityBarActive transition-colors font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-vscode-textMuted block mb-1">Username</label>
                  <input
                    required
                    placeholder="root / ubuntu"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-vscode-bg border border-vscode-border rounded px-2.5 py-1.5 text-xs outline-none focus:border-vscode-activityBarActive transition-colors font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-vscode-textMuted block mb-1">Authentication</label>
                  <select
                    value={authType}
                    onChange={(e) => setAuthType(e.target.value as any)}
                    className="w-full bg-vscode-bg border border-vscode-border rounded px-2.5 py-1.5 text-xs outline-none focus:border-vscode-activityBarActive transition-colors cursor-pointer"
                  >
                    <option value="password">Password</option>
                    <option value="private_key">Private Key File</option>
                    <option value="agent">SSH Agent (SSH_AUTH_SOCK)</option>
                  </select>
                </div>

                {authType === "password" && (
                  <div>
                    <label className="text-[11px] text-vscode-textMuted block mb-1 flex items-center gap-1">
                      <Lock className="w-3 h-3 text-amber-400" /> Password (Stored in OS Keyring)
                    </label>
                    <input
                      type="password"
                      placeholder={editingServerId ? "Leave blank to keep existing password" : "Password"}
                      value={secret}
                      onChange={(e) => setSecret(e.target.value)}
                      className="w-full bg-vscode-bg border border-vscode-border rounded px-2.5 py-1.5 text-xs outline-none focus:border-vscode-activityBarActive transition-colors"
                    />
                  </div>
                )}

                {authType === "private_key" && (
                  <div className="p-3 bg-vscode-bg/40 border border-vscode-border rounded-lg flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] text-vscode-textMuted flex items-center gap-1">
                        <Key className="w-3.5 h-3.5 text-amber-400" />
                        <span className="font-medium text-vscode-textBright">Private Key / SSH 私钥</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowKeyManagerModal(true)}
                        className="text-[11px] text-vscode-activityBarActive hover:underline flex items-center gap-1 font-medium cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Manage Keys / 管理私钥</span>
                      </button>
                    </div>

                    {/* Saved Private Keys dropdown */}
                    {sshKeys.length > 0 && (
                      <div>
                        <label className="text-[10px] text-vscode-textMuted block mb-1">
                          Select Saved Key / 选择已保存私钥:
                        </label>
                        <select
                          value={keyPath.startsWith("key:") ? keyPath.replace("key:", "") : ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val) {
                              setKeyPath(`key:${val}`);
                              const found = sshKeys.find((k) => k.id === val);
                              if (found?.passphrase && !secret) {
                                setSecret(found.passphrase);
                              }
                            } else {
                              setKeyPath("");
                            }
                          }}
                          className="w-full bg-vscode-bg border border-vscode-border rounded px-2.5 py-1.5 text-xs outline-none focus:border-vscode-activityBarActive transition-colors cursor-pointer font-mono"
                        >
                          <option value="">-- Choose from saved keys or enter path below --</option>
                          {sshKeys.map((k) => (
                            <option key={k.id} value={k.id}>
                              🔑 {k.name} ({k.private_key.includes("OPENSSH") ? "OpenSSH" : k.private_key.includes("ED25519") ? "Ed25519" : "Key"})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="text-[10px] text-vscode-textMuted block mb-1">
                        File Path or Key ID / 本地路径或私钥标识:
                      </label>
                      <input
                        placeholder="/home/user/.ssh/id_ed25519 or key:id"
                        value={keyPath}
                        onChange={(e) => setKeyPath(e.target.value)}
                        className="w-full bg-vscode-bg border border-vscode-border rounded px-2.5 py-1.5 text-xs outline-none focus:border-vscode-activityBarActive transition-colors font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-vscode-textMuted block mb-1">Passphrase (Optional / 密码短语)</label>
                      <input
                        type="password"
                        placeholder={editingServerId ? "Leave blank to keep existing passphrase" : "Key Passphrase"}
                        value={secret}
                        onChange={(e) => setSecret(e.target.value)}
                        className="w-full bg-vscode-bg border border-vscode-border rounded px-2.5 py-1.5 text-xs outline-none focus:border-vscode-activityBarActive transition-colors"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-[11px] text-vscode-textMuted block mb-1">Default Workspace Path</label>
                  <input
                    placeholder="/var/www or /home/user/project"
                    value={workspace}
                    onChange={(e) => setWorkspace(e.target.value)}
                    className="w-full bg-vscode-bg border border-vscode-border rounded px-2.5 py-1.5 text-xs outline-none focus:border-vscode-activityBarActive transition-colors font-mono"
                  />
                </div>

                <div className="pt-2 border-t border-vscode-border/40">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] text-vscode-textMuted flex items-center gap-1">
                      <Globe className="w-3 h-3 text-sky-400" /> Remote Proxy (Optional / 默认无代理)
                    </label>
                    {remoteProxy && (
                      <button
                        type="button"
                        onClick={() => setRemoteProxy("")}
                        className="text-[10px] text-rose-400 hover:text-rose-300 transition-colors"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {/* Copyable & Clickable Example Chips */}
                  <div className="mb-2 bg-vscode-bg/60 border border-vscode-border/60 rounded p-2 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-[10px] text-vscode-textMuted">
                      <span>常用示例 (点击直接填入，或选中/右侧复制):</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[
                        "127.0.0.1:1080",
                        "127.0.0.1:7890",
                        "socks5://127.0.0.1:1080",
                        "http://127.0.0.1:10808",
                      ].map((ex) => (
                        <div key={ex} className="flex items-center">
                          <button
                            type="button"
                            onClick={() => setRemoteProxy(ex)}
                            title={`Click to fill: ${ex}`}
                            className="font-mono text-[10px] text-sky-400 hover:text-white bg-vscode-sidebar px-2 py-0.5 rounded-l border border-vscode-border hover:border-sky-400/60 transition-colors cursor-pointer select-all"
                          >
                            {ex}
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(ex);
                                setCopiedProxy(ex);
                                setTimeout(() => setCopiedProxy(null), 2000);
                              } catch (e) {
                                console.error("Clipboard error:", e);
                              }
                            }}
                            title={`Copy ${ex} to clipboard`}
                            className="bg-vscode-sidebar border-t border-r border-b border-vscode-border hover:border-sky-400/60 hover:text-white px-1.5 py-0.5 rounded-r text-vscode-textMuted transition-colors cursor-pointer"
                          >
                            {copiedProxy === ex ? (
                              <Check className="w-2.5 h-2.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-2.5 h-2.5" />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <input
                    placeholder="e.g. 127.0.0.1:1080 or http://127.0.0.1:1080"
                    value={remoteProxy}
                    onChange={(e) => setRemoteProxy(e.target.value.replace(/：/g, ":").trim())}
                    className="w-full bg-vscode-bg border border-vscode-border rounded px-2.5 py-1.5 text-xs outline-none focus:border-vscode-activityBarActive transition-colors font-mono text-[11px]"
                  />
                  <p className="text-[10px] text-vscode-textMuted/80 mt-1">
                    Injected into remote terminal (http_proxy, https_proxy & all_proxy)
                  </p>
                </div>

                <div>
                  <label className="text-[11px] text-vscode-textMuted block mb-1 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" /> No Proxy (Bypass List)
                  </label>
                  <textarea
                    rows={2}
                    placeholder={DEFAULT_NO_PROXY}
                    value={remoteNoProxy}
                    onChange={(e) => setRemoteNoProxy(e.target.value)}
                    className="w-full bg-vscode-bg border border-vscode-border rounded px-2.5 py-1.5 text-xs outline-none focus:border-vscode-activityBarActive transition-colors font-mono text-[11px] resize-none"
                  />
                  <p className="text-[10px] text-vscode-textMuted/80 mt-0.5">
                    Pre-filled: Docker (172.16.0.0/12), LAN (10.0.0.0/8, 192.168.0.0/16), loopback & *.local
                  </p>
                </div>
              </div>

              {/* Modal Footer (Fixed at bottom) */}
              <div className="px-5 py-3 bg-vscode-sidebar/90 border-t border-vscode-border/60 flex items-center justify-end gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setShowAddModal(false);
                  }}
                  className="px-3 py-1.5 rounded hover:bg-vscode-hover text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-vscode-activityBarActive text-white text-xs hover:brightness-110 font-medium transition-all shadow-xs"
                >
                  {editingServerId ? "Update Server" : "Save Server"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <OpenFolderModal
        isOpen={Boolean(openFolderServerId)}
        onClose={() => setOpenFolderServerId(null)}
        targetServerId={openFolderServerId}
      />

      <KeyManagerModal
        isOpen={showKeyManagerModal}
        onClose={() => setShowKeyManagerModal(false)}
        onSelectKey={(keyId) => {
          setKeyPath(`key:${keyId}`);
          setAuthType("private_key");
          const found = sshKeys.find((k) => k.id === keyId);
          if (found?.passphrase) {
            setSecret(found.passphrase);
          }
        }}
      />
    </div>
  );
};
