import React, { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { Channel } from "@tauri-apps/api/core";
import { RotateCcw, RefreshCw, X } from "lucide-react";
import { safeInvoke, formatErrorMessage } from "../../utils/tauriBridge";
import { TerminalSession, useTerminalStore } from "../../stores/terminalStore";
import { useConnectionStore } from "../../stores/connectionStore";
import { useLayoutStore } from "../../stores/layoutStore";

/**
 * Searches for standard tmux startup / alternate screen sequences:
 * \x1b[?1049h (standard smcup), \x1b[?1047h, \x1b[?47h, or \x1b[H\x1b[2J (origin clear)
 * Returns the starting byte index of the sequence, or -1 if not found.
 */
function findTmuxStartMarker(data: Uint8Array): number {
  const patterns: number[][] = [
    [0x1b, 0x5b, 0x3f, 0x31, 0x30, 0x34, 0x39, 0x68], // \x1b[?1049h
    [0x1b, 0x5b, 0x3f, 0x31, 0x30, 0x34, 0x37, 0x68], // \x1b[?1047h
    [0x1b, 0x5b, 0x3f, 0x34, 0x37, 0x68],             // \x1b[?47h
    [0x1b, 0x5b, 0x48, 0x1b, 0x5b, 0x32, 0x4a],       // \x1b[H\x1b[2J
  ];

  for (const pat of patterns) {
    if (data.length < pat.length) continue;
    for (let i = 0; i <= data.length - pat.length; i++) {
      let match = true;
      for (let j = 0; j < pat.length; j++) {
        if (data[i + j] !== pat[j]) {
          match = false;
          break;
        }
      }
      if (match) return i;
    }
  }
  return -1;
}

interface XtermViewProps {
  session: TerminalSession;
  isActive: boolean;
}

export const XtermView: React.FC<XtermViewProps> = ({ session, isActive }) => {
  const { isMobile, mobileTab } = useLayoutStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const backendSessionIdRef = useRef<string | null>(null);
  const startSessionRef = useRef<(() => void) | null>(null);
  const activeChannelRef = useRef<Channel<number[] | Uint8Array> | null>(null);
  const { updateSessionStatus, updateBackendSessionId, reconnectSession, removeSession } = useTerminalStore();

  const isTmuxSession = Boolean(session.tmuxSessionName);
  const [isAttachingTmux, setIsAttachingTmux] = useState(isTmuxSession);
  const isAttachingTmuxRef = useRef(isTmuxSession);
  const tmuxPreambleBufferRef = useRef<Uint8Array[]>([]);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: "bar",
      fontFamily: 'Consolas, Monaco, "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.2,
      allowProposedApi: true,
      theme: {
        background: "#181818",
        foreground: "#cccccc",
        cursor: "#ffffff",
        selectionBackground: "#264f78",
        black: "#000000",
        red: "#cd3131",
        green: "#0dbc79",
        yellow: "#e5e510",
        blue: "#2472c8",
        magenta: "#bc3fbc",
        cyan: "#11a8cd",
        white: "#e5e5e5",
        brightBlack: "#666666",
        brightRed: "#f14c4c",
        brightGreen: "#23d18b",
        brightYellow: "#f5f543",
        brightBlue: "#3b8eea",
        brightMagenta: "#d670d6",
        brightCyan: "#29b8db",
        brightWhite: "#e5e5e5",
      },
    });

    // Prevent IME Enter key (confirming phonetic letters) from emitting Carriage Return (\r)
    term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      if (event.isComposing && (event.key === "Enter" || event.keyCode === 13)) {
        return false;
      }
      return true;
    });

    // Intercept wheel events in alternate buffer when mouse tracking is not active.
    // By default, xterm synthesizes Up/Down arrow keystrokes (\x1b[A / \x1b[B), which cycles
    // prompt history in interactive AI chat CLIs (like agya). Suppressing it preserves normal terminal UX.
    term.attachCustomWheelEventHandler((_event: WheelEvent) => {
      if (term.buffer.active.type === "alternate" && term.modes.mouseTrackingMode === "none") {
        return false;
      }
      return true;
    });

    // Listen to shell prompt OSC title changes to track remote working directory in real-time
    term.onTitleChange((title) => {
      if (title) {
        const match = title.match(/:\s*(~?\/[^\x07\x1b\r\n]*)/);
        if (match && match[1]) {
          useTerminalStore.getState().updateSessionCurrentDir(session.id, match[1].trim());
        }
      }
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);

    // Try loading WebGL hardware acceleration, fallback gracefully
    try {
      const webglAddon = new WebglAddon();
      term.loadAddon(webglAddon);
    } catch (e) {
      console.warn("WebGL addon unavailable, falling back to Canvas renderer:", e);
    }

    fitAddon.fit();
    fitAddonRef.current = fitAddon;
    termRef.current = term;

    let isDisposed = false;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    let textareaClearTimer: ReturnType<typeof setTimeout> | null = null;
    let connectTimeout: ReturnType<typeof setTimeout> | null = null;

    // Track IME composition lifecycle to guard against duplicate input emissions
    let isComposing = false;
    let lastCompositionEndTime = 0;
    let lastComposedText = "";
    let lastSentData = "";
    let lastSentTime = 0;

    const textarea = term.textarea;
    const handleCompositionStart = () => {
      isComposing = true;
      if (textareaClearTimer) {
        clearTimeout(textareaClearTimer);
        textareaClearTimer = null;
      }
    };

    const handleCompositionUpdate = () => {
      isComposing = true;
    };

    const handleCompositionEnd = (e: CompositionEvent) => {
      isComposing = false;
      lastCompositionEndTime = performance.now();
      lastComposedText = e.data || "";

      // Schedule safe clearing of the hidden textarea value once xterm's microtask tick completes.
      if (textareaClearTimer) clearTimeout(textareaClearTimer);
      textareaClearTimer = setTimeout(() => {
        if (textarea && !isComposing) {
          textarea.value = "";
        }
      }, 10);
    };

    if (textarea) {
      textarea.addEventListener("compositionstart", handleCompositionStart);
      textarea.addEventListener("compositionupdate", handleCompositionUpdate);
      textarea.addEventListener("compositionend", handleCompositionEnd);
    }

    let tmuxSafetyTimeout: ReturnType<typeof setTimeout> | null = null;

    const startSession = async () => {
      if (isDisposed) return;

      // Close previous backend session if any (non-blocking fire-and-forget to avoid deadlock)
      const previousId = backendSessionIdRef.current;
      if (previousId) {
        backendSessionIdRef.current = null;
        updateBackendSessionId(session.id, null);
        safeInvoke("terminal_close", { sessionId: previousId }).catch(() => {});
      }

      // Ensure tmux attach command is always present if session is associated with tmux
      const tmuxName = session.tmuxSessionName;
      if (tmuxName && !session.pendingCommand) {
        useTerminalStore.getState().setPendingCommand(session.id, `tmux attach -d -t "${tmuxName}"\n`);
      }

      if (isTmuxSession) {
        isAttachingTmuxRef.current = true;
        setIsAttachingTmux(true);
        tmuxPreambleBufferRef.current = [];

        if (tmuxSafetyTimeout) clearTimeout(tmuxSafetyTimeout);
        tmuxSafetyTimeout = setTimeout(() => {
          if (isAttachingTmuxRef.current) {
            isAttachingTmuxRef.current = false;
            setIsAttachingTmux(false);
            if (termRef.current && tmuxPreambleBufferRef.current.length > 0) {
              for (const chunk of tmuxPreambleBufferRef.current) {
                termRef.current.write(chunk);
              }
              tmuxPreambleBufferRef.current = [];
            }
          }
        }, 1200);
      } else {
        isAttachingTmuxRef.current = false;
        setIsAttachingTmux(false);
      }

      updateSessionStatus(session.id, "connecting");

      // Create a fresh Tauri Channel for EVERY session attempt so it always has an active registered callback
      const channel = new Channel<number[] | Uint8Array>();
      activeChannelRef.current = channel;
      channel.onmessage = (message) => {
        if (isDisposed || activeChannelRef.current !== channel) return;
        const data = message instanceof Uint8Array ? message : new Uint8Array(message);

        if (isAttachingTmuxRef.current) {
          const markerIdx = findTmuxStartMarker(data);
          if (markerIdx !== -1) {
            // TMUX session established! Discard shell prompt / echo preamble, write clean tmux frame
            isAttachingTmuxRef.current = false;
            setIsAttachingTmux(false);
            if (tmuxSafetyTimeout) {
              clearTimeout(tmuxSafetyTimeout);
              tmuxSafetyTimeout = null;
            }
            tmuxPreambleBufferRef.current = [];
            const cleanTmuxData = data.subarray(markerIdx);
            term.write(cleanTmuxData);
            return;
          } else {
            // Buffer preamble (motd, prompt, command echo) in case of timeout fallback
            tmuxPreambleBufferRef.current.push(data);
            return;
          }
        }

        term.write(data);
      };

      // Verify server connection status and self-heal if disconnected
      const connState = useConnectionStore.getState();
      const currentServerStatus = connState.serverStates[session.serverId];
      if (currentServerStatus !== "connected") {
        term.writeln("\r\n\x1b[36m[Remora] Reconnecting SSH server...\x1b[0m");
        try {
          connState.setServerState(session.serverId, "connecting");
          await safeInvoke("connect_server", { serverId: session.serverId });
          connState.setServerState(session.serverId, "connected");
          connState.setActiveServerId(session.serverId);
        } catch (e) {
          updateSessionStatus(session.id, "disconnected");
          connState.setServerState(session.serverId, "failed", { error: String(e) });
          term.writeln(`\r\n\x1b[31m[Remora] SSH connection failed: ${e}\x1b[0m`);
          term.writeln("\x1b[33mPress [Enter] or click 'Reconnect' to retry.\x1b[0m\r\n");
          return;
        }
      }

      if (connectTimeout) clearTimeout(connectTimeout);
      connectTimeout = setTimeout(() => {
        if (!backendSessionIdRef.current && !isDisposed) {
          updateSessionStatus(session.id, "disconnected");
          updateBackendSessionId(session.id, null);
          term.writeln("\r\n\x1b[31m[Remora] Connection handshake timed out (15s).\x1b[0m");
          term.writeln("\x1b[33mPress [Enter] or click 'Reconnect' to retry. (提示: 配合 TMUX 即可无缝续接后台任务)\x1b[0m\r\n");
        }
      }, 15000);

      safeInvoke<string>("terminal_open", {
        serverId: session.serverId,
        cols: term.cols || 80,
        rows: term.rows || 24,
        initialDir: session.initialDir || null,
        remoteProxy: session.remoteProxy || null,
        onData: channel,
      })
        .then((backendId) => {
          if (connectTimeout) {
            clearTimeout(connectTimeout);
            connectTimeout = null;
          }
          if (isDisposed || activeChannelRef.current !== channel) {
            safeInvoke("terminal_close", { sessionId: backendId }).catch(() => {});
            return;
          }
          backendSessionIdRef.current = backendId;
          updateSessionStatus(session.id, "connected");
          updateBackendSessionId(session.id, backendId);
        })
        .catch((err) => {
          if (connectTimeout) {
            clearTimeout(connectTimeout);
            connectTimeout = null;
          }
          if (tmuxSafetyTimeout) {
            clearTimeout(tmuxSafetyTimeout);
            tmuxSafetyTimeout = null;
          }
          isAttachingTmuxRef.current = false;
          setIsAttachingTmux(false);
          console.error("Failed to open terminal session:", err);
          updateSessionStatus(session.id, "disconnected");
          updateBackendSessionId(session.id, null);
          term.writeln(`\r\n\x1b[31m[Remora] Error opening terminal: ${formatErrorMessage(err)}\x1b[0m`);
          term.writeln("\x1b[33mPress [Enter] or click 'Reconnect' to retry.\x1b[0m\r\n");
        });
    };

    startSessionRef.current = startSession;
    startSession();

    // Send user input to backend with high-precision IME deduplication
    term.onData(async (inputData) => {
      // When session is disconnected, pressing Enter or Space attempts automatic reconnection
      if (!backendSessionIdRef.current) {
        if (inputData === "\r" || inputData === "\n" || inputData === " ") {
          reconnectSession(session.id);
        }
        return;
      }

      const now = performance.now();
      const timeSinceComposition = now - lastCompositionEndTime;
      const timeSinceLastSend = now - lastSentTime;

      // High-precision IME deduplication guard
      const isRecentComposition = isComposing || timeSinceComposition < 150;
      const isCjkOrMultiChar = inputData.length > 1 || /[^\x00-\x7F]/.test(inputData);
      if (
        isRecentComposition &&
        inputData === lastSentData &&
        timeSinceLastSend < 100 &&
        (inputData === lastComposedText || isCjkOrMultiChar)
      ) {
        return;
      }

      lastSentData = inputData;
      lastSentTime = now;

      try {
        const bytes = Array.from(new TextEncoder().encode(inputData));
        await safeInvoke("terminal_write", {
          sessionId: backendSessionIdRef.current,
          data: bytes,
        });
      } catch (err) {
        console.warn("Failed to write to terminal, session disconnected:", err);
        backendSessionIdRef.current = null;
        updateSessionStatus(session.id, "disconnected");
        updateBackendSessionId(session.id, null);
        term.writeln(
          "\r\n\x1b[33m[Remora] Terminal session disconnected. Press [Enter] or click 'Reconnect' to restore.\x1b[0m\r\n"
        );
      }
    });

    // Resize observer to synchronize terminal dimensions
    const resizeObserver = new ResizeObserver(() => {
      if (!containerRef.current || !fitAddonRef.current || isDisposed) return;
      try {
        fitAddonRef.current.fit();
        const currentTerm = termRef.current;
        const currentBackendId = backendSessionIdRef.current;
        if (currentTerm && currentBackendId && currentTerm.cols > 0 && currentTerm.rows > 0) {
          if (resizeTimer) clearTimeout(resizeTimer);
          resizeTimer = setTimeout(() => {
            safeInvoke("terminal_resize", {
              sessionId: currentBackendId,
              cols: currentTerm.cols,
              rows: currentTerm.rows,
            }).catch(console.error);
          }, 80);
        }
      } catch {
        // ignore layout transitions
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      isDisposed = true;
      if (resizeTimer) clearTimeout(resizeTimer);
      if (textareaClearTimer) clearTimeout(textareaClearTimer);
      if (connectTimeout) clearTimeout(connectTimeout);
      if (tmuxSafetyTimeout) clearTimeout(tmuxSafetyTimeout);
      if (textarea) {
        textarea.removeEventListener("compositionstart", handleCompositionStart);
        textarea.removeEventListener("compositionupdate", handleCompositionUpdate);
        textarea.removeEventListener("compositionend", handleCompositionEnd);
      }
      resizeObserver.disconnect();
      const currentBackendId = backendSessionIdRef.current;
      if (currentBackendId) {
        safeInvoke("terminal_close", { sessionId: currentBackendId }).catch(console.error);
      }
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
  }, [session.id, session.serverId, session.initialDir, session.remoteProxy, updateSessionStatus, updateBackendSessionId, reconnectSession]);

  // Handle explicit session reconnect trigger (from Tab button, Enter key, or overlay button)
  useEffect(() => {
    if (session.reconnectCount && session.reconnectCount > 0) {
      if (termRef.current) {
        termRef.current.writeln("\r\n\x1b[36m[Remora] Reconnecting terminal session...\x1b[0m");
      }
      startSessionRef.current?.();
    }
  }, [session.reconnectCount]);

  // Fit and focus when switching to active tab or switching back to mobile terminal
  useEffect(() => {
    const isVisible = isActive && (!isMobile || mobileTab === "terminal");
    if (isVisible && fitAddonRef.current && termRef.current) {
      const timer = setTimeout(() => {
        try {
          fitAddonRef.current?.fit();
          termRef.current?.focus();
        } catch {
          // ignore layout timing
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isActive, isMobile, mobileTab]);

  return (
    <div
      style={{ display: isActive ? "block" : "none" }}
      className="w-full h-full relative overflow-hidden"
    >
      {/* Stealth TMUX Attaching Overlay */}
      {isAttachingTmux && session.status !== "disconnected" && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#181818] select-none animate-in fade-in duration-100">
          <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-vscode-sidebar/95 border border-vscode-border shadow-2xl backdrop-blur-md">
            <RefreshCw className="w-4 h-4 text-vscode-activityBarActive animate-spin" />
            <span className="text-xs font-medium text-vscode-textBright">
              正在接入 TMUX 会话{" "}
              <span className="text-amber-400 font-mono font-semibold">
                {session.tmuxSessionName || ""}
              </span>
              ...
            </span>
          </div>
        </div>
      )}

      {/* Disconnected floating recovery badge */}
      {session.status === "disconnected" && (
        <div className="absolute top-2 right-4 z-20 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#241212]/95 border border-red-500/50 text-red-200 text-xs shadow-xl backdrop-blur-md select-none animate-in fade-in duration-150">
          <span className="w-2 h-2 rounded-full bg-red-400" />
          <span className="font-mono text-[11px] font-medium">Disconnected</span>
          <button
            onClick={() => reconnectSession(session.id)}
            className="ml-1 px-2.5 py-1 rounded bg-red-800 hover:bg-red-700 active:bg-red-900 text-white font-medium text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            title="重新打开并恢复终端"
          >
            <RotateCcw className="w-3 h-3" />
            {session.tmuxSessionName ? "恢复 TMUX" : "重新连接"}
          </button>
          <button
            onClick={() => removeSession(session.id)}
            className="p-1 rounded hover:bg-red-900/60 text-red-300 hover:text-white transition-colors cursor-pointer"
            title="关闭该终端标签页"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Connecting floating badge (shown only when not in stealth overlay) */}
      {session.status === "connecting" && !isAttachingTmux && (
        <div className="absolute top-2 right-4 z-20 flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#13202e]/90 border border-sky-500/40 text-sky-200 text-xs shadow-md backdrop-blur-xs select-none">
          <RefreshCw className="w-3 h-3 text-sky-400 animate-spin" />
          <span className="font-mono text-[11px]">
            {session.tmuxSessionName ? "正在恢复 TMUX..." : "Connecting..."}
          </span>
        </div>
      )}

      {/* Terminal View Container with safe breathing padding */}
      <div className="w-full h-full bg-[#181818] px-2 pt-1 pb-1 overflow-hidden flex flex-col">
        <div
          ref={containerRef}
          className="w-full flex-1 overflow-hidden"
        />
      </div>
    </div>
  );
};
