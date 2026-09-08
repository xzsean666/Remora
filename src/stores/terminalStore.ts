import { create } from "zustand";

export interface TerminalSession {
  id: string;
  title: string;
  serverId: string;
  serverName?: string;
  initialDir?: string;
  status: "connecting" | "connected" | "disconnected" | "closed";
}

interface TerminalState {
  sessions: TerminalSession[];
  activeSessionId: string | null;

  addSession: (session: TerminalSession) => void;
  removeSession: (id: string) => void;
  setActiveSession: (id: string) => void;
  updateSessionStatus: (id: string, status: TerminalSession["status"]) => void;
  renameSession: (id: string, title: string) => void;
  clearAllSessions: () => void;
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

  renameSession: (id, title) => {
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === id ? { ...s, title } : s)),
    }));
  },

  clearAllSessions: () => {
    set({ sessions: [], activeSessionId: null });
  },
}));
