import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
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

interface ConnectionState {
  connectedServerId: string | null;
  connectedServerName: string | null;
  status: ConnectionStatus;
  reconnectAttempt: number;
  errorMessage: string | null;

  setConnectedServer: (id: string | null, name?: string | null) => void;
  reconnect: (serverId?: string) => Promise<void>;
  initListener: () => Promise<() => void>;
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  connectedServerId: null,
  connectedServerName: null,
  status: "disconnected",
  reconnectAttempt: 0,
  errorMessage: null,

  setConnectedServer: (id, name = null) => {
    set({
      connectedServerId: id,
      connectedServerName: name,
      status: id ? "connected" : "disconnected",
      reconnectAttempt: 0,
      errorMessage: null,
    });
  },

  reconnect: async (serverId) => {
    const targetId = serverId || get().connectedServerId;
    if (!targetId) return;

    set({ status: "reconnecting", reconnectAttempt: 1, errorMessage: null });
    try {
      await invoke("reconnect_server", { serverId: targetId });
    } catch (err) {
      console.error("Failed to trigger reconnect:", err);
      set({ status: "failed", errorMessage: String(err) });
    }
  },

  initListener: async () => {
    const unlisten = await listen<ConnectionStateEvent>(
      "connection-state-changed",
      (event) => {
        const { serverId, state } = event.payload;
        const currentServerId = get().connectedServerId;

        if (currentServerId && currentServerId !== serverId) return;

        if (state.status === "connected") {
          set({
            status: "connected",
            reconnectAttempt: 0,
            errorMessage: null,
          });
        } else if (state.status === "reconnecting") {
          set({
            status: "reconnecting",
            reconnectAttempt: state.detail?.attempt || 1,
            errorMessage: null,
          });
        } else if (state.status === "failed") {
          set({
            status: "failed",
            errorMessage: state.detail?.error || "Connection failed",
          });
        } else if (state.status === "connecting") {
          set({ status: "connecting" });
        } else {
          set({ status: "disconnected" });
        }
      }
    );

    return unlisten;
  },
}));
