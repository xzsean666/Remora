import React, { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { Channel } from "@tauri-apps/api/core";
import { RotateCcw, RefreshCw, X } from "lucide-react";
import { safeInvoke, formatErrorMessage } from "../../utils/tauriBridge";
import { TerminalSession, useTerminalStore, TMUX_SETUP_AND_ATTACH } from "../../stores/terminalStore";
import { useConnectionStore } from "../../stores/connectionStore";
import { useLayoutStore } from "../../stores/layoutStore";
import { useFileTreeStore } from "../../stores/fileTreeStore";

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
  const isMobileDevice =
    isMobile ||
    (typeof navigator !== "undefined" &&
      (/android|iphone|ipad|ipod/i.test(navigator.userAgent) ||
        navigator.maxTouchPoints > 1));
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
    // and automatically refresh workspace file tree when command finishes and returns to prompt
    let refreshDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    term.onTitleChange((title) => {
      if (title) {
        const match = title.match(/:\s*(~?\/[^\x07\x1b\r\n]*)/);
        if (match && match[1]) {
          useTerminalStore.getState().updateSessionCurrentDir(session.id, match[1].trim());
        }
        if (refreshDebounceTimer) clearTimeout(refreshDebounceTimer);
        refreshDebounceTimer = setTimeout(() => {
          const { rootPath, refreshPath } = useFileTreeStore.getState();
          if (rootPath) {
            refreshPath(rootPath).catch(() => {});
          }
        }, 800);
      }
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);

    // Stop xterm internal mouse-tracking from capturing right-click (e.button === 2) when in TMUX or alternate screens.
    // When mouse tracking is enabled, xterm swallows right-click and sends SGR escape sequences to TMUX,
    // which triggers tmux's internal ASCII popup menu instead of the standard terminal right-click menu (paste/copy).
    // Intercepting button === 2 in capture phase allows the event to proceed directly to contextmenu and xterm's rightClickHandler.
    const containerEl = containerRef.current;
    const handleMouseCapture = (e: MouseEvent) => {
      if (e.button === 2) {
        e.stopImmediatePropagation();
      }
    };

    // Mobile Touch Gesture Support for TMUX and Terminal Scrolling
    // xterm.js natively ignores touch events when mouse tracking is active (areMouseEventsActive === true),
    // which causes mobile users to be unable to scroll the terminal when attached to TMUX.
    // By capturing touch drag events on mobile and translating them to synthetic WheelEvents,
    // we seamlessly trigger TMUX's SGR mouse scrolling (WheelUpPane / WheelDownPane) or xterm's viewport scrolling,
    // complete with velocity-based momentum physics.
    let touchStartY = 0;
    let touchStartX = 0;
    let lastTouchY = 0;
    let lastTouchX = 0;
    let accumulatedDeltaY = 0;
    let isVerticalScrolling = false;
    let touchVelocity = 0;
    let lastTouchTime = 0;
    let momentumRafId: number | null = null;

    const dispatchSyntheticWheel = (deltaY: number, clientX: number, clientY: number) => {
      const target = term.element || containerRef.current;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const safeX = clientX > 0 ? clientX : rect.left + rect.width / 2;
      const safeY = clientY > 0 ? clientY : rect.top + rect.height / 2;

      const wheelEvent = new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        clientX: safeX,
        clientY: safeY,
        deltaY,
        deltaMode: WheelEvent.DOM_DELTA_PIXEL,
      });
      target.dispatchEvent(wheelEvent);
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      if (momentumRafId !== null) {
        cancelAnimationFrame(momentumRafId);
        momentumRafId = null;
      }
      const touch = e.touches[0];
      touchStartY = touch.clientY;
      touchStartX = touch.clientX;
      lastTouchY = touch.clientY;
      lastTouchX = touch.clientX;
      accumulatedDeltaY = 0;
      isVerticalScrolling = false;
      touchVelocity = 0;
      lastTouchTime = performance.now();
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;

      if (!isVerticalScrolling) {
        // Detect vertical intent: moved > 6px and vertical distance dominates horizontal
        if (Math.abs(deltaY) > 6 && Math.abs(deltaY) > Math.abs(deltaX)) {
          isVerticalScrolling = true;
        } else if (Math.abs(deltaX) > 8) {
          // Horizontal swipe, let browser or tab bar handle it
          return;
        }
      }

      if (isVerticalScrolling) {
        if (e.cancelable) {
          e.preventDefault();
        }

        const currentY = touch.clientY;
        const moveY = currentY - lastTouchY;
        const now = performance.now();
        const dt = now - lastTouchTime;
        if (dt > 0) {
          // Exponential moving average filter for touch velocity (px/ms)
          touchVelocity = 0.7 * (moveY / dt) + 0.3 * touchVelocity;
        }
        lastTouchY = currentY;
        lastTouchX = touch.clientX;
        lastTouchTime = now;

        accumulatedDeltaY += moveY;
        const stepThreshold = 20; // 20px per terminal scroll step for smooth response

        while (Math.abs(accumulatedDeltaY) >= stepThreshold) {
          const isScrollUp = accumulatedDeltaY > 0;
          if (isScrollUp) {
            accumulatedDeltaY -= stepThreshold;
          } else {
            accumulatedDeltaY += stepThreshold;
          }

          // Dragging DOWN (moveY > 0): pulls content down -> scroll UP in history (deltaY = -100)
          // Dragging UP (moveY < 0): pushes content up -> scroll DOWN towards prompt (deltaY = 100)
          const wheelDelta = isScrollUp ? -100 : 100;
          dispatchSyntheticWheel(wheelDelta, touch.clientX, touch.clientY);
        }
      }
    };

    const handleTouchEnd = (_e: TouchEvent) => {
      if (!isVerticalScrolling) return;
      isVerticalScrolling = false;

      // Inertial momentum scrolling on quick flick
      if (Math.abs(touchVelocity) > 0.35) {
        let currentVelocity = touchVelocity;
        const stepThreshold = 20;
        let momentumAccum = 0;

        const runMomentum = () => {
          momentumAccum += currentVelocity * 16;
          currentVelocity *= 0.91; // friction decay

          while (Math.abs(momentumAccum) >= stepThreshold) {
            const isScrollUp = momentumAccum > 0;
            if (isScrollUp) {
              momentumAccum -= stepThreshold;
            } else {
              momentumAccum += stepThreshold;
            }
            dispatchSyntheticWheel(isScrollUp ? -100 : 100, lastTouchX, lastTouchY);
          }

          if (Math.abs(currentVelocity) > 0.05) {
            momentumRafId = requestAnimationFrame(runMomentum);
          } else {
            momentumRafId = null;
          }
        };

        momentumRafId = requestAnimationFrame(runMomentum);
      }
    };

    const handleTouchCancel = () => {
      isVerticalScrolling = false;
      if (momentumRafId !== null) {
        cancelAnimationFrame(momentumRafId);
        momentumRafId = null;
      }
    };

    if (containerEl) {
      containerEl.addEventListener("mousedown", handleMouseCapture, true);
      containerEl.addEventListener("mouseup", handleMouseCapture, true);
      containerEl.addEventListener("touchstart", handleTouchStart, { passive: true });
      containerEl.addEventListener("touchmove", handleTouchMove, { passive: false });
      containerEl.addEventListener("touchend", handleTouchEnd, { passive: true });
      containerEl.addEventListener("touchcancel", handleTouchCancel, { passive: true });
    }

    // Try loading WebGL hardware acceleration only on desktop.
    // On mobile devices (Android/iOS WebView), WebGL compositor layers suffer from
    // frame drops, buffer reallocation flickering during orientation/keyboard resize,
    // and context loss. The built-in DOM renderer in xterm 5 is rock-solid, ultra-fast,
    // and completely immune to mobile WebView flickering.
    if (!isMobileDevice) {
      try {
        const webglAddon = new WebglAddon();
        webglAddon.onContextLoss(() => {
          console.warn("Terminal WebGL context lost, disposing addon gracefully...");
          webglAddon.dispose();
        });
        term.loadAddon(webglAddon);
      } catch (e) {
        console.warn("WebGL addon unavailable, falling back to DOM renderer:", e);
      }
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
        useTerminalStore.getState().setPendingCommand(
          session.id,
          TMUX_SETUP_AND_ATTACH(tmuxName)
        );
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

    // Track last sent dimensions to deduplicate terminal_resize calls.
    // TMUX redraws the entire alternate screen buffer with clear-screen escape sequences (\x1b[H\x1b[2J)
    // whenever it receives SIGWINCH. Deduplicating dimensions ensures TMUX never clears screen unless
    // rows or cols actually changed.
    let lastCols = term.cols || 80;
    let lastRows = term.rows || 24;

    // Resize observer to synchronize terminal dimensions
    const resizeObserver = new ResizeObserver(() => {
      if (!containerRef.current || !fitAddonRef.current || isDisposed) return;
      try {
        fitAddonRef.current.fit();
        const currentTerm = termRef.current;
        const currentBackendId = backendSessionIdRef.current;
        if (currentTerm && currentBackendId && currentTerm.cols > 0 && currentTerm.rows > 0) {
          // If cols and rows haven't changed, skip resize to avoid triggering TMUX full-screen redraw
          if (currentTerm.cols === lastCols && currentTerm.rows === lastRows) {
            return;
          }
          if (resizeTimer) clearTimeout(resizeTimer);
          // Debounce 150ms on mobile (to allow virtual keyboard insets animation to settle) and 80ms on desktop
          const debounceDelay = isMobileDevice ? 150 : 80;
          resizeTimer = setTimeout(() => {
            if (isDisposed || !backendSessionIdRef.current) return;
            const termInstance = termRef.current;
            if (!termInstance || termInstance.cols <= 0 || termInstance.rows <= 0) return;
            if (termInstance.cols === lastCols && termInstance.rows === lastRows) return;
            lastCols = termInstance.cols;
            lastRows = termInstance.rows;
            safeInvoke("terminal_resize", {
              sessionId: backendSessionIdRef.current,
              cols: termInstance.cols,
              rows: termInstance.rows,
            }).catch(console.error);
          }, debounceDelay);
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
      if (refreshDebounceTimer) clearTimeout(refreshDebounceTimer);
      if (textarea) {
        textarea.removeEventListener("compositionstart", handleCompositionStart);
        textarea.removeEventListener("compositionupdate", handleCompositionUpdate);
        textarea.removeEventListener("compositionend", handleCompositionEnd);
      }
      if (momentumRafId !== null) {
        cancelAnimationFrame(momentumRafId);
        momentumRafId = null;
      }
      if (containerEl) {
        containerEl.removeEventListener("mousedown", handleMouseCapture, true);
        containerEl.removeEventListener("mouseup", handleMouseCapture, true);
        containerEl.removeEventListener("touchstart", handleTouchStart);
        containerEl.removeEventListener("touchmove", handleTouchMove);
        containerEl.removeEventListener("touchend", handleTouchEnd);
        containerEl.removeEventListener("touchcancel", handleTouchCancel);
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
          // Auto-focus terminal on desktop for immediate keyboard input.
          // On mobile, skip auto-focusing on tab switch to avoid popping up IME keyboard
          // and triggering unnecessary viewport insets layout recalculations.
          if (!isMobileDevice) {
            termRef.current?.focus();
          }
        } catch {
          // ignore layout timing
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isActive, isMobile, mobileTab, isMobileDevice]);

  return (
    <div
      style={{
        visibility: isActive ? "visible" : "hidden",
        pointerEvents: isActive ? "auto" : "none",
      }}
      className={`w-full h-full absolute inset-0 overflow-hidden ${
        isActive ? "z-10" : "z-0"
      }`}
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
          className="w-full flex-1 overflow-hidden touch-none"
          style={{ touchAction: "none" }}
        />
      </div>
    </div>
  );
};
