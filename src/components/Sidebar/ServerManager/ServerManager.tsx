import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
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
} from "lucide-react";
import { useFileTreeStore } from "../../../stores/fileTreeStore";
import { useConnectionStore } from "../../../stores/connectionStore";

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
  const [activeServerId, setActiveServerId] = useState<string | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingServerId, setEditingServerId] = useState<string | null>(null);

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

  const { setRoot } = useFileTreeStore();
  const { setConnectedServer } = useConnectionStore();

  const loadServers = async () => {
    try {
      const res = await invoke<ServerConfig[]>("get_servers");
      setServers(res);
    } catch (err) {
      console.error("Failed to load servers:", err);
    }
  };

  useEffect(() => {
    loadServers();
  }, []);

  const resetForm = () => {
    setEditingServerId(null);
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
      alert(`Failed to save server: ${String(err)}`);
    }
  };

  const handleConnect = async (srv: ServerConfig) => {
    setConnectingId(srv.id);
    try {
      await invoke("connect_server", { serverId: srv.id });
      setActiveServerId(srv.id);
      setConnectedServer(srv.id, srv.name, srv.remote_proxy);
      if (srv.default_workspace) {
        await setRoot(srv.id, srv.default_workspace);
      }
    } catch (err) {
      alert(`SSH Connection failed: ${String(err)}`);
    } finally {
      setConnectingId(null);
    }
  };

  const handleDisconnect = async (srvId: string) => {
    try {
      await invoke("disconnect_server", { serverId: srvId });
      if (activeServerId === srvId) {
        setActiveServerId(null);
        setConnectedServer(null);
      }
    } catch (err) {
      console.error("Disconnect failed:", err);
    }
  };

  const handleDelete = async (srvId: string) => {
    if (confirm("Are you sure you want to delete this server?")) {
      await invoke("delete_server", { id: srvId });
      if (activeServerId === srvId) setActiveServerId(null);
      await loadServers();
    }
  };

  return (
    <div className="flex flex-col h-full select-none text-xs">
      {/* Header with Add Button */}
      <div className="h-7 px-3 bg-vscode-sidebar/90 border-b border-vscode-border/40 flex items-center justify-between font-bold text-[11px] text-vscode-textBright uppercase">
        <span>Configured Servers ({servers.length})</span>
        <button
          onClick={() => setShowAddModal(true)}
          title="Add New SSH Server"
          className="p-1 hover:text-white hover:bg-vscode-hover rounded flex items-center gap-1 text-xs"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Server List */}
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
        {servers.map((srv) => {
          const isConnected = activeServerId === srv.id;
          const isConnecting = connectingId === srv.id;

          return (
            <div
              key={srv.id}
              className={`p-2.5 rounded-lg border transition-all flex flex-col gap-1.5 ${
                isConnected
                  ? "bg-vscode-selected/20 border-vscode-activityBarActive text-white"
                  : "bg-vscode-bg/60 border-vscode-border text-vscode-text hover:border-vscode-border/80"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-medium">
                  <Server className="w-4 h-4 text-vscode-activityBarActive" />
                  <span className="truncate">{srv.name}</span>
                </div>

                <div className="flex items-center gap-1">
                  {isConnected ? (
                    <button
                      onClick={() => handleDisconnect(srv.id)}
                      title="Disconnect"
                      className="p-1 text-emerald-400 hover:text-rose-400 rounded"
                    >
                      <Wifi className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleConnect(srv)}
                      disabled={isConnecting}
                      title="Connect SSH"
                      className="p-1 text-vscode-textMuted hover:text-emerald-400 rounded"
                    >
                      {isConnecting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-vscode-activityBarActive" />
                      ) : (
                        <WifiOff className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}

                  <button
                    onClick={() => handleEdit(srv)}
                    title="Edit Server"
                    className="p-1 text-vscode-textMuted hover:text-white rounded"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleDelete(srv.id)}
                    title="Delete Server"
                    className="p-1 text-vscode-textMuted hover:text-rose-400 rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="text-[11px] text-vscode-textMuted flex items-center justify-between font-mono">
                <span>{srv.username}@{srv.host}:{srv.port}</span>
                <span className="capitalize text-[10px] px-1.5 py-0.5 rounded bg-vscode-sidebar border border-vscode-border">
                  {srv.auth_type}
                </span>
              </div>

              {srv.remote_proxy && (
                <div className="text-[10px] text-sky-400/90 flex items-center gap-1 font-mono">
                  <Globe className="w-3 h-3 text-sky-400 flex-shrink-0" />
                  <span className="truncate" title={`Remote proxy: ${srv.remote_proxy}`}>
                    Proxy: {srv.remote_proxy}
                  </span>
                </div>
              )}

              {isConnected && srv.default_workspace && (
                <button
                  onClick={() => setRoot(srv.id, srv.default_workspace!)}
                  className="mt-1 w-full py-1 px-2 rounded bg-vscode-selected text-white text-xs flex items-center justify-center gap-1.5 hover:brightness-110"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Explore {srv.default_workspace}</span>
                </button>
              )}
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

      {/* Add Server Modal Dialog */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-vscode-sidebar border border-vscode-border rounded-xl shadow-2xl p-4 flex flex-col gap-3 text-vscode-text">
            <h2 className="text-sm font-semibold text-vscode-textBright">
              {editingServerId ? "Edit SSH Server" : "Add SSH Server"}
            </h2>

            <form onSubmit={handleSave} className="flex flex-col gap-2.5">
              <div>
                <label className="text-[11px] text-vscode-textMuted block mb-1">Server Name</label>
                <input
                  required
                  placeholder="e.g. Ubuntu Production"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-vscode-bg border border-vscode-border rounded px-2 py-1 text-xs outline-none focus:border-vscode-activityBarActive"
                />
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[11px] text-vscode-textMuted block mb-1">Host / IP</label>
                  <input
                    required
                    placeholder="192.168.1.100"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    className="w-full bg-vscode-bg border border-vscode-border rounded px-2 py-1 text-xs outline-none focus:border-vscode-activityBarActive"
                  />
                </div>
                <div className="w-20">
                  <label className="text-[11px] text-vscode-textMuted block mb-1">Port</label>
                  <input
                    type="number"
                    value={port}
                    onChange={(e) => setPort(Number(e.target.value))}
                    className="w-full bg-vscode-bg border border-vscode-border rounded px-2 py-1 text-xs outline-none focus:border-vscode-activityBarActive"
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
                  className="w-full bg-vscode-bg border border-vscode-border rounded px-2 py-1 text-xs outline-none focus:border-vscode-activityBarActive"
                />
              </div>

              <div>
                <label className="text-[11px] text-vscode-textMuted block mb-1">Authentication</label>
                <select
                  value={authType}
                  onChange={(e) => setAuthType(e.target.value as any)}
                  className="w-full bg-vscode-bg border border-vscode-border rounded px-2 py-1 text-xs outline-none focus:border-vscode-activityBarActive"
                >
                  <option value="password">Password</option>
                  <option value="private_key">Private Key File</option>
                  <option value="agent">SSH Agent (SSH_AUTH_SOCK)</option>
                </select>
              </div>

              {authType === "password" && (
                <div>
                  <label className="text-[11px] text-vscode-textMuted block mb-1 flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Password (Stored in OS Keyring)
                  </label>
                  <input
                    type="password"
                    placeholder={editingServerId ? "Leave blank to keep existing password" : "Password"}
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    className="w-full bg-vscode-bg border border-vscode-border rounded px-2 py-1 text-xs outline-none focus:border-vscode-activityBarActive"
                  />
                </div>
              )}

              {authType === "private_key" && (
                <>
                  <div>
                    <label className="text-[11px] text-vscode-textMuted block mb-1 flex items-center gap-1">
                      <Key className="w-3 h-3" /> Private Key Path
                    </label>
                    <input
                      placeholder="/home/user/.ssh/id_ed25519"
                      value={keyPath}
                      onChange={(e) => setKeyPath(e.target.value)}
                      className="w-full bg-vscode-bg border border-vscode-border rounded px-2 py-1 text-xs outline-none focus:border-vscode-activityBarActive"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-vscode-textMuted block mb-1">Passphrase (Optional)</label>
                    <input
                      type="password"
                      placeholder={editingServerId ? "Leave blank to keep existing passphrase" : "Key Passphrase"}
                      value={secret}
                      onChange={(e) => setSecret(e.target.value)}
                      className="w-full bg-vscode-bg border border-vscode-border rounded px-2 py-1 text-xs outline-none focus:border-vscode-activityBarActive"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="text-[11px] text-vscode-textMuted block mb-1">Default Workspace Path</label>
                <input
                  placeholder="/var/www / /home/user/project"
                  value={workspace}
                  onChange={(e) => setWorkspace(e.target.value)}
                  className="w-full bg-vscode-bg border border-vscode-border rounded px-2 py-1 text-xs outline-none focus:border-vscode-activityBarActive"
                />
              </div>

              <div>
                <label className="text-[11px] text-vscode-textMuted block mb-1 flex items-center gap-1">
                  <Globe className="w-3 h-3 text-sky-400" /> Remote Proxy (Optional)
                </label>
                <input
                  placeholder="e.g. 127.0.0.1:1080 or http://127.0.0.1:1080"
                  value={remoteProxy}
                  onChange={(e) => setRemoteProxy(e.target.value)}
                  className="w-full bg-vscode-bg border border-vscode-border rounded px-2 py-1 text-xs outline-none focus:border-vscode-activityBarActive font-mono"
                />
                <p className="text-[10px] text-vscode-textMuted/70 mt-0.5">
                  Injected into remote terminal (http_proxy, https_proxy & all_proxy)
                </p>
              </div>

              <div>
                <label className="text-[11px] text-vscode-textMuted block mb-1 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" /> No Proxy (Bypass List)
                </label>
                <input
                  placeholder={DEFAULT_NO_PROXY}
                  value={remoteNoProxy}
                  onChange={(e) => setRemoteNoProxy(e.target.value)}
                  className="w-full bg-vscode-bg border border-vscode-border rounded px-2 py-1 text-xs outline-none focus:border-vscode-activityBarActive font-mono text-[11px]"
                />
                <p className="text-[10px] text-vscode-textMuted/70 mt-0.5">
                  Pre-filled: Docker (172.16.0.0/12), LAN (10.0.0.0/8, 192.168.0.0/16), loopback & *.local
                </p>
              </div>

              <div className="flex justify-end gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setShowAddModal(false);
                  }}
                  className="px-3 py-1.5 rounded hover:bg-vscode-hover text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded bg-vscode-activityBarActive text-white text-xs hover:brightness-110 font-medium"
                >
                  {editingServerId ? "Update Server" : "Save Server"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
