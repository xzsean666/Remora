import React, { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { Channel } from "@tauri-apps/api/core";
import { RotateCcw } from "lucide-react";
import { safeInvoke } from "../../utils/tauriBridge";
import { TerminalSession, useTerminalStore } from "../../stores/terminalStore";

interface XtermViewProps {
  session: TerminalSession;
  isActive: boolean;
}

export const XtermView: React.FC<XtermViewProps> = ({ session, isActive }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const backendSessionIdRef = useRef<string | null>(null);
  const startSessionRef = useRef<(() => void) | null>(null);
  const { updateSessionStatus, updateBackendSessionId, reconnectSession } = useTerminalStore();

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

    // Channel for high throughput binary output from PTY
    const channel = new Channel<number[] | Uint8Array>();
    channel.onmessage = (message) => {
      if (isDisposed) return;
      const data = message instanceof Uint8Array ? message : new Uint8Array(message);
      term.write(data);
    };

    const startSession = () => {
      if (isDisposed) return;

      // Close previous backend session if any
      const previousId = backendSessionIdRef.current;
      if (previousId) {
        backendSessionIdRef.current = null;
        updateBackendSessionId(session.id, null);
        safeInvoke("terminal_close", { sessionId: previousId }).catch(console.error);
      }

      updateSessionStatus(session.id, "connecting");

      if (connectTimeout) clearTimeout(connectTimeout);
      connectTimeout = setTimeout(() => {
        if (!backendSessionIdRef.current && !isDisposed) {
          updateSessionStatus(session.id, "disconnected");
          updateBackendSessionId(session.id, null);
          term.writeln("\r\n\x1b[31m[Remora] Connection handshake timed out (12s).\x1b[0m");
          term.writeln("\x1b[33mPress [Enter] or click 'Reconnect' to retry. (提示: 配合 TMUX 即可无缝续接后台任务)\x1b[0m\r\n");
        }
      }, 12000);

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
          if (isDisposed) {
            safeInvoke("terminal_close", { sessionId: backendId }).catch(console.error);
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
          console.error("Failed to open terminal session:", err);
          updateSessionStatus(session.id, "disconnected");
          updateBackendSessionId(session.id, null);
          term.writeln(`\r\n\x1b[31m[Remora] Error opening terminal: ${err}\x1b[0m`);
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

  // Fit and focus when switching to active tab
  useEffect(() => {
    if (isActive && fitAddonRef.current && termRef.current) {
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
  }, [isActive]);

  return (
    <div
      style={{ display: isActive ? "block" : "none" }}
      className="w-full h-full relative overflow-hidden"
    >
      {/* Disconnected floating recovery badge */}
      {session.status === "disconnected" && (
        <div className="absolute top-2 right-4 z-20 flex items-center gap-2 px-2.5 py-1 rounded bg-[#2a1313]/90 border border-red-500/40 text-red-200 text-xs shadow-md backdrop-blur-xs select-none">
          <span className="w-2 h-2 rounded-full bg-red-400" />
          <span className="font-mono text-[11px]">Disconnected</span>
          <button
            onClick={() => reconnectSession(session.id)}
            className="ml-1 px-2 py-0.5 rounded bg-red-800 hover:bg-red-700 text-white font-medium text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
            title="Reconnect terminal session"
          >
            <RotateCcw className="w-2.5 h-2.5" />
            Reconnect
          </button>
        </div>
      )}

      {/* Terminal View Container */}
      <div
        ref={containerRef}
        className="w-full h-full p-2 bg-[#181818] overflow-hidden"
      />
    </div>
  );
};
