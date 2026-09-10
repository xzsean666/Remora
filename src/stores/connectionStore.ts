import { create } from "zustand";
import { safeInvoke as invoke, isRunningInTauri, formatErrorMessage } from "../utils/tauriBridge";
import { listen } from "@tauri-apps/api/event";

export type ConnectionStatus =
  | "connected"
  | "connecting"
  | "reconnecting"
  | "disconnected"
  | "failed";

export interface BackendConnectionState {
  status: "disconnected" | "connecting" | "connected" | "reconnecting" | "failed";
  detail?: {
    attempt?: number;
    error?: string;
  };
}

interface ConnectionStateEvent {
  serverId: string;
  state: BackendConnectionState;
}

export interface ServerMeta {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  remoteProxy?: string;
  defaultWorkspace?: string;
}

interface ConnectionState {
  // Multi-server state maps
  serverStates: Record<string, ConnectionStatus>;
  serverDetails: Record<string, { attempt?: number; error?: string }>;
  serverMetas: Record<string, ServerMeta>;

  // Currently active server ID (which governs ProjectExplorer, Terminal, StatusBar)
  activeServerId: string | null;

  // Backward-compatible properties pointing to active server
  connectedServerId: string | null;
  connectedServerName: string | null;
  connectedServerProxy: string | null;
  status: ConnectionStatus;
  reconnectAttempt: number;
  errorMessage: string | null;

  // Server list & metadata
  serversList: ServerMeta[];
  setServersList: (list: ServerMeta[]) => void;
  loadServers: () => Promise<void>;
  registerServerMeta: (meta: ServerMeta) => void;
  setActiveServerId: (id: string | null) => void;
  setServerState: (
    id: string,
    status: ConnectionStatus,
    detail?: { attempt?: number; error?: string }
  ) => void;
  setConnectedServer: (id: string | null, name?: string | null, proxy?: string | null) => void;
  syncConnectionStates: () => Promise<void>;
  reconnect: (serverId?: string) => Promise<void>;
  initListener: () => Promise<() => void>;
  isServerConnected: (serverId: string) => boolean;
  getConnectedServerIds: () => string[];
  getActiveServerMeta: () => ServerMeta | null;
}

function deriveActiveFields(
  activeId: string | null,
  states: Record<string, ConnectionStatus>,
  metas: Record<string, ServerMeta>,
  details: Record<string, { attempt?: number; error?: string }>
) {
  if (!activeId) {
    return {
      connectedServerId: null,
      connectedServerName: null,
      connectedServerProxy: null,
      status: "disconnected" as ConnectionStatus,
      reconnectAttempt: 0,
      errorMessage: null,
    };
  }

  const meta = metas[activeId];
  const st = states[activeId] || "disconnected";
  const detail = details[activeId];

  return {
    connectedServerId: activeId,
    connectedServerName: meta ? meta.name : activeId,
    connectedServerProxy: meta?.remoteProxy || null,
    status: st,
    reconnectAttempt: detail?.attempt || 0,
    errorMessage: detail?.error || null,
  };
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  serverStates: {},
  serverDetails: {},
  serverMetas: {},
  serversList: [],
  activeServerId: null,

  connectedServerId: null,
  connectedServerName: null,
  connectedServerProxy: null,
  status: "disconnected",
  reconnectAttempt: 0,
  errorMessage: null,

  setServersList: (list) => {
    set((state) => {
      const metas = { ...state.serverMetas };
      list.forEach((s) => {
        metas[s.id] = s;
      });
      return { serversList: list, serverMetas: metas };
    });
  },

  loadServers: async () => {
    try {
      const res = await invoke<Array<{
        id: string;
        name: string;
        host: string;
        port: number;
        username: string;
        remote_proxy?: string;
        default_workspace?: string;
      }>>("get_servers");
      if (res && Array.isArray(res)) {
        const metas: ServerMeta[] = res.map((s) => ({
          id: s.id,
          name: s.name,
          host: s.host,
          port: s.port,
          username: s.username,
          remoteProxy: s.remote_proxy,
          defaultWorkspace: s.default_workspace,
        }));
        get().setServersList(metas);
      }
    } catch (err) {
      console.warn("Failed to load servers in connectionStore:", err);
    }
  },

  registerServerMeta: (meta) => {
    set((state) => {
      const serverMetas = { ...state.serverMetas, [meta.id]: meta };
      const derived = deriveActiveFields(
        state.activeServerId,
        state.serverStates,
        serverMetas,
        state.serverDetails
      );
      return { serverMetas, ...derived };
    });
  },

  setActiveServerId: (id) => {
    set((state) => {
      const derived = deriveActiveFields(
        id,
        state.serverStates,
        state.serverMetas,
        state.serverDetails
      );
      return {
        activeServerId: id,
        ...derived,
      };
    });
  },

  setServerState: (id, status, detail) => {
    set((state) => {
      const serverStates = { ...state.serverStates, [id]: status };
      const serverDetails = detail
        ? { ...state.serverDetails, [id]: detail }
        : { ...state.serverDetails };

      let nextActiveId = state.activeServerId;

      // If this server just connected and there's no active server, activate it!
      if (status === "connected" && (!nextActiveId || state.serverStates[nextActiveId] !== "connected")) {
        nextActiveId = id;
      }

      // If active server disconnected, try to switch to another connected server
      if (status === "disconnected" && nextActiveId === id) {
        const remainingConnected = Object.keys(serverStates).find(
          (k) => k !== id && serverStates[k] === "connected"
        );
        nextActiveId = remainingConnected || null;
      }

      const derived = deriveActiveFields(
        nextActiveId,
        serverStates,
        state.serverMetas,
        serverDetails
      );

      return {
        serverStates,
        serverDetails,
        activeServerId: nextActiveId,
        ...derived,
      };
    });
  },

  setConnectedServer: (id, name = null, proxy = null) => {
    if (!id) {
      get().setActiveServerId(null);
      return;
    }

    if (name) {
      get().registerServerMeta({
        id,
        name,
        host: "",
        port: 22,
        username: "",
        remoteProxy: proxy || undefined,
      });
    }

    get().setServerState(id, "connected");
    get().setActiveServerId(id);
  },

  syncConnectionStates: async () => {
    try {
      const allStates = await invoke<Record<string, BackendConnectionState | string>>(
        "get_all_connection_states"
      );
      if (!allStates || typeof allStates !== "object") return;

      set((state) => {
        const updatedStates = { ...state.serverStates };
        const updatedDetails = { ...state.serverDetails };

        for (const [srvId, rawState] of Object.entries(allStates)) {
          if (typeof rawState === "string") {
            updatedStates[srvId] = rawState as ConnectionStatus;
          } else if (rawState && typeof rawState === "object") {
            updatedStates[srvId] = rawState.status as ConnectionStatus;
            if (rawState.detail) {
              updatedDetails[srvId] = rawState.detail;
            }
          }
        }

        let nextActive = state.activeServerId;
        if (!nextActive || updatedStates[nextActive] !== "connected") {
          const firstConnected = Object.keys(updatedStates).find(
            (k) => updatedStates[k] === "connected"
          );
          if (firstConnected) nextActive = firstConnected;
        }

        const derived = deriveActiveFields(
          nextActive,
          updatedStates,
          state.serverMetas,
          updatedDetails
        );

        return {
          serverStates: updatedStates,
          serverDetails: updatedDetails,
          activeServerId: nextActive,
          ...derived,
        };
      });
    } catch (err) {
      console.warn("Failed to sync connection states:", err);
    }
  },

  reconnect: async (serverId) => {
    const targetId = serverId || get().activeServerId;
    if (!targetId) return;

    get().setServerState(targetId, "reconnecting", { attempt: 1 });

    try {
      await invoke("reconnect_server", { serverId: targetId });
    } catch (err) {
      console.error("Failed to trigger reconnect:", err);
      get().setServerState(targetId, "failed", { error: formatErrorMessage(err) });
    }
  },

  initListener: async () => {
    // Load servers and sync initial states on startup
    await get().loadServers();
    await get().syncConnectionStates();

    if (!isRunningInTauri()) {
      return () => {};
    }

    const unlisten = await listen<ConnectionStateEvent>(
      "connection-state-changed",
      (event) => {
        const { serverId, state } = event.payload;
        get().setServerState(serverId, state.status, state.detail);
      }
    );

    return unlisten;
  },

  isServerConnected: (serverId: string) => {
    return get().serverStates[serverId] === "connected";
  },

  getConnectedServerIds: () => {
    const states = get().serverStates;
    return Object.keys(states).filter((k) => states[k] === "connected");
  },

  getActiveServerMeta: () => {
    const { activeServerId, serverMetas } = get();
    if (!activeServerId) return null;
    return serverMetas[activeServerId] || null;
  },
}));
