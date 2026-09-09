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
  pendingCommand?: string | number[];
  slotNumber?: number;
  tmuxSessionName?: string;
}

interface TerminalState {
  sessions: TerminalSession[];
  activeSessionId: string | null;

  addSession: (session: TerminalSession) => void;
  removeSession: (id: string) => void;
  setActiveSession: (id: string) => void;
  updateSessionStatus: (id: string, status: TerminalSession["status"]) => void;
  updateBackendSessionId: (id: string, backendId: string | null) => void;
  setPendingCommand: (id: string, cmd: string | number[] | null) => void;
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
    set((state) => {
      const session = state.sessions.find((s) => s.id === id);
      const pending = session?.pendingCommand;
      if (backendId && pending) {
        setTimeout(() => {
          const bytes =
            typeof pending === "string"
              ? Array.from(new TextEncoder().encode(pending))
              : pending;
          safeInvoke("terminal_write", {
            sessionId: backendId,
            data: bytes,
          }).catch(console.error);
        }, 120);
      }
      return {
        sessions: state.sessions.map((s) =>
          s.id === id
            ? {
                ...s,
                backendSessionId: backendId || undefined,
                pendingCommand: backendId ? undefined : s.pendingCommand,
              }
            : s
        ),
      };
    });
  },

  setPendingCommand: (id, cmd) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id ? { ...s, pendingCommand: cmd || undefined } : s
      ),
    }));
  },

  reconnectSession: (id) => {
    const { sessions, activeSessionId } = get();
    const old = sessions.find((s) => s.id === id);
    if (!old) return;

    // Auto detect tmux session name from property or title
    let tmuxName = old.tmuxSessionName;
    if (!tmuxName) {
      const match = old.title.match(/tmux:\s*([^\s\]\)]+)/);
      if (match) tmuxName = match[1];
    }

    const pendingCmd = tmuxName
      ? `tmux attach -d -t "${tmuxName}"\n`
      : old.pendingCommand;

    // Clean up old backend session in background (non-blocking)
    if (old.backendSessionId) {
      safeInvoke("terminal_close", { sessionId: old.backendSessionId }).catch(() => {});
    }

    // Generate a fresh unique session ID to cleanly mount a fresh XtermView component
    const newId = `term-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newSession: TerminalSession = {
      ...old,
      id: newId,
      status: "connecting",
      backendSessionId: undefined,
      tmuxSessionName: tmuxName || old.tmuxSessionName,
      pendingCommand: pendingCmd,
      reconnectCount: (old.reconnectCount || 0) + 1,
    };

    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === id ? newSession : s)),
      activeSessionId: activeSessionId === id ? newId : activeSessionId,
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
    const { sessions, activeSessionId, reconnectSession, setPendingCommand } = get();
    const active = sessions.find((s) => s.id === activeSessionId);
    if (!active) return;

    if (!active.backendSessionId || active.status === "disconnected") {
      // Buffer command and automatically trigger terminal session reconnect
      setPendingCommand(active.id, data);
      reconnectSession(active.id);
      return;
    }

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
