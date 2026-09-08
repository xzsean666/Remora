import React, { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { Channel } from "@tauri-apps/api/core";
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
  const { updateSessionStatus } = useTerminalStore();

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
      // This eliminates stale character residue accumulation which causes duplicate diff emissions
      // and multi-word repetitions ("有时候还输入很多").
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

    updateSessionStatus(session.id, "connecting");

    // Open remote terminal session in Tokio backend
    safeInvoke<string>("terminal_open", {
      serverId: session.serverId,
      cols: term.cols || 80,
      rows: term.rows || 24,
      initialDir: session.initialDir || null,
      remoteProxy: session.remoteProxy || null,
      onData: channel,
    })
      .then((backendId) => {
        if (isDisposed) {
          safeInvoke("terminal_close", { sessionId: backendId }).catch(console.error);
          return;
        }
        backendSessionIdRef.current = backendId;
        updateSessionStatus(session.id, "connected");

        // Send user input to backend with high-precision IME deduplication
        term.onData(async (inputData) => {
          if (!backendSessionIdRef.current || !inputData) return;

          const now = performance.now();
          const timeSinceComposition = now - lastCompositionEndTime;
          const timeSinceLastSend = now - lastSentTime;

          // High-precision IME deduplication guard:
          // If we are currently composing or within 150ms of composition end,
          // and the exact same input string is received within 100ms, it is a duplicate
          // fired by xterm's dual input path (_inputEvent + CompositionHelper). Drop it!
          // We also verify that the inputData matches the composed text or is CJK/multi-character,
          // ensuring single-key English rapid double typing (e.g. 'll' in 'hello') is never affected.
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
            console.error("Failed to write to terminal:", err);
          }
        });
      })
      .catch((err) => {
        console.error("Failed to open terminal session:", err);
        updateSessionStatus(session.id, "disconnected");
        term.writeln(`\r\n\x1b[31m[Remora] Error opening terminal: ${err}\x1b[0m\r\n`);
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
  }, [session.id, session.serverId, session.initialDir, session.remoteProxy, updateSessionStatus]);

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
      ref={containerRef}
      style={{ display: isActive ? "block" : "none" }}
      className="w-full h-full p-2 bg-[#181818] overflow-hidden"
    />
  );
};
