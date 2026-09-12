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
  currentDir?: string;
}

interface TerminalState {
  sessions: TerminalSession[];
  activeSessionId: string | null;

  addSession: (session: TerminalSession) => void;
  removeSession: (id: string) => void;
  setActiveSession: (id: string) => void;
  updateSessionStatus: (id: string, status: TerminalSession["status"]) => void;
  updateSessionCurrentDir: (id: string, currentDir: string) => void;
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

// Standard tmux setup command injected before attaching to any session:
// 1. set -g mouse on: enables native scroll wheel navigation into copy-mode
// 2. bind -n WheelUpPane / WheelDownPane: immediate smooth scroll response on first wheel/touch gesture
// 3. unbind-key -n MouseDown3*: unbinds tmux's default ASCII context menus (Horizontal/Vertical split, Kill, etc.)
//    so that the desktop/webview native right-click context menu (Paste/Copy) functions identically to normal terminals.
export const TMUX_SETUP_AND_ATTACH = (name: string) =>
  `tmux set -g mouse on 2>/dev/null; tmux bind -n WheelUpPane if-shell -F -t = "#{mouse_any_flag}" "send-keys -M" "if -Ft= '#{pane_in_mode}' 'send-keys -M' 'copy-mode -e; send-keys -M'" 2>/dev/null; tmux bind -n WheelDownPane if-shell -F -t = "#{mouse_any_flag}" "send-keys -M" "if -Ft= '#{pane_in_mode}' 'send-keys -M' ''" 2>/dev/null; tmux unbind-key -n MouseDown3Pane 2>/dev/null; tmux unbind-key -n MouseDown3Status 2>/dev/null; tmux unbind-key -n MouseDown3StatusLeft 2>/dev/null; tmux unbind-key -n M-MouseDown3Pane 2>/dev/null; tmux attach -d -t "${name}"\n`;

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

    // 1. 查找是否已存在同名 TMUX 终端（无论其处于 connected 还是 disconnected 状态）
    const matchingIndices: number[] = [];
    sessions.forEach((s, idx) => {
      if (s.serverId === serverId && s.tmuxSessionName === sessionName) {
        matchingIndices.push(idx);
      }
    });

    // 2. 如果已经存在且处于连接或连接中状态，优先直接切回该 Tab 并重聚焦
    if (matchingIndices.length > 0) {
      const existing = sessions[matchingIndices[0]];
      if (existing.status === "connected" || existing.status === "connecting") {
        set({ activeSessionId: existing.id });
        return existing.id;
      }
    }

    // 3. 分配稳定 Slot 编号 (保留用户最直观的快捷键槽位)
    const usedSlots = new Set(sessions.map((s) => s.slotNumber ?? 0));
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
      currentDir: initialDir,
      remoteProxy,
      status: "connecting",
      pendingCommand: TMUX_SETUP_AND_ATTACH(sessionName),
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

  updateSessionCurrentDir: (id, currentDir) => {
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === id ? { ...s, currentDir } : s)),
    }));
  },

  updateBackendSessionId: (id, backendId) => {
    set((state) => {
      const session = state.sessions.find((s) => s.id === id);
      let pending = session?.pendingCommand;
      if (!pending && session?.tmuxSessionName) {
        pending = TMUX_SETUP_AND_ATTACH(session.tmuxSessionName);
      }
      if (backendId && pending) {
        const delay = session?.tmuxSessionName ? 50 : 120;
        setTimeout(() => {
          const bytes =
            typeof pending === "string"
              ? Array.from(new TextEncoder().encode(pending))
              : pending;
          safeInvoke("terminal_write", {
            sessionId: backendId,
            data: bytes,
          }).catch(console.error);
        }, delay);
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
      ? TMUX_SETUP_AND_ATTACH(tmuxName)
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
