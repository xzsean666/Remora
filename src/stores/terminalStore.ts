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
  openTmuxSession: (params: {
    serverId: string;
    serverName?: string;
    sessionName: string;
    initialDir?: string;
    remoteProxy?: string;
  }) => string;
  closeTmuxTerminals: (serverId: string, sessionName: string) => void;
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

  openTmuxSession: ({ serverId, serverName, sessionName, initialDir, remoteProxy }) => {
    const { sessions } = get();

    // 1. 查找属于同一服务器且绑定同一 TMUX 会话的所有历史终端（包括新旧标题格式）
    const matchingIndices: number[] = [];
    const matchingSessions: TerminalSession[] = [];

    sessions.forEach((s, idx) => {
      const isSameServer = s.serverId === serverId;
      const isSameTmux =
        s.tmuxSessionName === sessionName ||
        (!s.tmuxSessionName &&
          (s.title.startsWith(`${sessionName} (tmux)`) ||
            s.title.includes(`tmux: ${sessionName}`) ||
            s.title.includes(`tmux:${sessionName}`)));
      if (isSameServer && isSameTmux) {
        matchingIndices.push(idx);
        matchingSessions.push(s);
      }
    });

    // 2. 彻底释放关闭之前所有重复/旧终端的底层后端 PTY 通道
    for (const old of matchingSessions) {
      if (old.backendSessionId) {
        safeInvoke("terminal_close", { sessionId: old.backendSessionId }).catch(() => {});
      }
    }

    // 3. 计算槽位号，避开其他会话
    const remainingSessions = sessions.filter((_, idx) => !matchingIndices.includes(idx));
    const usedSlots = new Set(remainingSessions.map((s) => s.slotNumber).filter(Boolean));
    let slotNumber = 1;
    while (usedSlots.has(slotNumber)) slotNumber++;

    // 4. 前置显示 TMUX 会话名称，后置服务器名称，一眼即可清晰分辨：
    // 如 "dev (tmux) [prod-server]" 或 "dev (tmux)"
    const srvSuffix = serverName ? ` [${serverName}]` : "";
    const title = `${sessionName} (tmux)${srvSuffix}`;

    const newId = `term-tmux-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newSession: TerminalSession = {
      id: newId,
      title,
      serverId,
      serverName,
      initialDir,
      remoteProxy,
      status: "connecting",
      pendingCommand: `tmux attach -d -t "${sessionName}"\n`,
      tmuxSessionName: sessionName,
      slotNumber,
    };

    // 5. 若此前已存在旧终端，就地在首个匹配位置替换，并清理其余重复项，确保该会话只占 1 个 Terminal
    let newSessions: TerminalSession[];
    if (matchingIndices.length > 0) {
      const firstIdx = matchingIndices[0];
      newSessions = [];
      sessions.forEach((s, idx) => {
        if (idx === firstIdx) {
          newSessions.push(newSession);
        } else if (!matchingIndices.includes(idx)) {
          newSessions.push(s);
        }
      });
    } else {
      newSessions = [...sessions, newSession];
    }

    set({
      sessions: newSessions,
      activeSessionId: newId,
    });

    return newId;
  },

  closeTmuxTerminals: (serverId, sessionName) => {
    const { sessions, activeSessionId } = get();
    const toRemove = sessions.filter(
      (s) =>
        s.serverId === serverId &&
        (s.tmuxSessionName === sessionName ||
          s.title.startsWith(`${sessionName} (tmux)`) ||
          s.title.includes(`tmux: ${sessionName}`) ||
          s.title.includes(`tmux:${sessionName}`))
    );
    if (toRemove.length === 0) return;

    for (const old of toRemove) {
      if (old.backendSessionId) {
        safeInvoke("terminal_close", { sessionId: old.backendSessionId }).catch(() => {});
      }
    }

    const remaining = sessions.filter((s) => !toRemove.some((r) => r.id === s.id));
    let newActiveId = activeSessionId;
    if (toRemove.some((r) => r.id === activeSessionId)) {
      newActiveId = remaining.length > 0 ? remaining[remaining.length - 1].id : null;
    }

    set({ sessions: remaining, activeSessionId: newActiveId });
  },

  removeSession: (id) => {
    const { sessions, activeSessionId } = get();
    const index = sessions.findIndex((s) => s.id === id);
    if (index === -1) return;

    const sessionToRemove = sessions[index];
    if (sessionToRemove?.backendSessionId) {
      safeInvoke("terminal_close", { sessionId: sessionToRemove.backendSessionId }).catch(() => {});
    }

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
      const match =
        old.title.match(/^([^(\[\s]+)\s*\((?:tmux)\)/i) ||
        old.title.match(/tmux:\s*([^\s\]\)]+)/i);
      if (match) tmuxName = match[1];
    }

    // Auto-normalize title with session name in front if this is a tmux session
    let newTitle = old.title;
    if (tmuxName) {
      const srvSuffix = old.serverName ? ` [${old.serverName}]` : "";
      newTitle = `${tmuxName} (tmux)${srvSuffix}`;
    }

    const pendingCmd = tmuxName
      ? `tmux attach -d -t "${tmuxName}"\n`
      : old.pendingCommand;

    // Clean up old backend session in background (non-blocking)
    if (old.backendSessionId) {
      safeInvoke("terminal_close", { sessionId: old.backendSessionId }).catch(() => {});
    }

    // Clean up any other duplicate sessions for this tmux session if any
    let cleanedSessions = sessions;
    if (tmuxName) {
      const duplicateSessions = sessions.filter(
        (s) =>
          s.id !== id &&
          s.serverId === old.serverId &&
          (s.tmuxSessionName === tmuxName ||
            s.title.startsWith(`${tmuxName} (tmux)`) ||
            s.title.includes(`tmux: ${tmuxName}`))
      );
      for (const dup of duplicateSessions) {
        if (dup.backendSessionId) {
          safeInvoke("terminal_close", { sessionId: dup.backendSessionId }).catch(() => {});
        }
      }
      if (duplicateSessions.length > 0) {
        cleanedSessions = sessions.filter(
          (s) => !duplicateSessions.some((dup) => dup.id === s.id)
        );
      }
    }

    // Generate a fresh unique session ID to cleanly mount a fresh XtermView component
    const newId = `term-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newSession: TerminalSession = {
      ...old,
      id: newId,
      title: newTitle,
      status: "connecting",
      backendSessionId: undefined,
      tmuxSessionName: tmuxName || old.tmuxSessionName,
      pendingCommand: pendingCmd,
      reconnectCount: (old.reconnectCount || 0) + 1,
    };

    set({
      sessions: cleanedSessions.map((s) => (s.id === id ? newSession : s)),
      activeSessionId: activeSessionId === id ? newId : activeSessionId,
    });
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
