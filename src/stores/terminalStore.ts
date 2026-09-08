import { create } from "zustand";
import { listen } from "@tauri-apps/api/event";
import { isRunningInTauri, safeInvoke } from "../utils/tauriBridge";

export interface TerminalSession {
  id: string;
  title: string;
  serverId: string;
  serverName?: string;
  initialDir?: string;
  remoteProxy?: string;
  status: "connecting" | "connected" | "disconnected" | "closed";
  backendSessionId?: string;
  reconnectCount?: number;
}

interface TerminalState {
  sessions: TerminalSession[];
  activeSessionId: string | null;

  addSession: (session: TerminalSession) => void;
  removeSession: (id: string) => void;
  setActiveSession: (id: string) => void;
  updateSessionStatus: (id: string, status: TerminalSession["status"]) => void;
  updateBackendSessionId: (id: string, backendId: string | null) => void;
  reconnectSession: (id: string) => void;
  renameSession: (id: string, title: string) => void;
  clearAllSessions: () => void;
  sendDataToActiveTerminal: (data: string | number[]) => Promise<void>;
  initTerminalListener: () => Promise<() => void>;
}

export const useTerminalStore = create<TerminalState>((set, get) => ({
  sessions: [],
  activeSessionId: null,

  addSession: (session) => {
    set((state) => ({
      sessions: [...state.sessions, session],
      activeSessionId: session.id,
    }));
  },

  removeSession: (id) => {
    const { sessions, activeSessionId } = get();
    const index = sessions.findIndex((s) => s.id === id);
    if (index === -1) return;

    const remaining = sessions.filter((s) => s.id !== id);
    let newActiveId = activeSessionId;

    if (activeSessionId === id) {
      if (remaining.length === 0) {
        newActiveId = null;
      } else if (index >= remaining.length) {
        newActiveId = remaining[remaining.length - 1].id;
      } else {
        newActiveId = remaining[index].id;
      }
    }

    set({ sessions: remaining, activeSessionId: newActiveId });
  },

  setActiveSession: (id) => {
    set({ activeSessionId: id });
  },

  updateSessionStatus: (id, status) => {
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === id ? { ...s, status } : s)),
    }));
  },

  updateBackendSessionId: (id, backendId) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id ? { ...s, backendSessionId: backendId || undefined } : s
      ),
    }));
  },

  reconnectSession: (id) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id
          ? {
              ...s,
              status: "connecting",
              reconnectCount: (s.reconnectCount || 0) + 1,
            }
          : s
      ),
    }));
  },

  renameSession: (id, title) => {
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === id ? { ...s, title } : s)),
    }));
  },

  clearAllSessions: () => {
    set({ sessions: [], activeSessionId: null });
  },

  sendDataToActiveTerminal: async (data: string | number[]) => {
    const { sessions, activeSessionId } = get();
    const active = sessions.find((s) => s.id === activeSessionId);
    if (!active || !active.backendSessionId) return;

    let bytes: number[];
    if (typeof data === "string") {
      bytes = Array.from(new TextEncoder().encode(data));
    } else {
      bytes = data;
    }

    try {
      await safeInvoke("terminal_write", {
        sessionId: active.backendSessionId,
        data: bytes,
      });
    } catch (e) {
      console.error("Failed to send data to active terminal:", e);
    }
  },

  initTerminalListener: async () => {
    if (!isRunningInTauri()) return () => {};

    const unlisten = await listen<{ sessionId: string; serverId: string; reason?: string }>(
      "terminal-session-closed",
      (event) => {
        const { sessionId } = event.payload;
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId || s.backendSessionId === sessionId
              ? { ...s, status: "disconnected", backendSessionId: undefined }
              : s
          ),
        }));
      }
    );

    return unlisten;
  },
}));
