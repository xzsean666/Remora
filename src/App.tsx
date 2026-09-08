import { useEffect, useState } from "react";
import { ActivityBar } from "./components/ActivityBar/ActivityBar";
import { SidebarContainer } from "./components/Sidebar/SidebarContainer";
import { Splitter } from "./components/Layout/Splitter";
import { StatusBar } from "./components/StatusBar/StatusBar";
import { ProjectExplorer } from "./components/Sidebar/ProjectExplorer/ProjectExplorer";
import { ServerManager } from "./components/Sidebar/ServerManager/ServerManager";
import { EditorArea } from "./components/Editor/EditorArea";
import { TerminalPanel } from "./components/Terminal/TerminalPanel";
import { TransferPanel } from "./components/Sidebar/TransferManager/TransferPanel";
import { QuickInputPanel } from "./components/Sidebar/QuickInput/QuickInputPanel";
import { useLayoutStore } from "./stores/layoutStore";
import { useEditorStore } from "./stores/editorStore";
import { useFileTreeStore } from "./stores/fileTreeStore";
import { useConnectionStore } from "./stores/connectionStore";
import { useTerminalStore } from "./stores/terminalStore";
import { createNewWindow, checkUpdate, installUpdate, type UpdateInfo } from "./utils/tauriBridge";

export default function App() {
  const {
    sidebarWidth,
    setSidebarWidth,
    terminalHeight,
    setTerminalHeight,
    isSidebarOpen,
    isTerminalOpen,
    activeSidebarTab,
    toggleSidebarTab,
    initFromPreferences,
    resetLayout,
  } = useLayoutStore();

  const { currentServerId, rootPath, loadRecentProjects } = useFileTreeStore();
  const { openFile } = useEditorStore();
  const { initListener } = useConnectionStore();
  const { initTerminalListener } = useTerminalStore();

  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [manualCheckMsg, setManualCheckMsg] = useState<string | null>(null);

  useEffect(() => {
    initFromPreferences();
    loadRecentProjects();
    let unlistenConn: (() => void) | null = null;
    let unlistenTerm: (() => void) | null = null;

    initListener().then((u) => {
      unlistenConn = u;
    });
    initTerminalListener().then((u) => {
      unlistenTerm = u;
    });

    // Global keyboard shortcuts:
    // Ctrl+Shift+N (or Cmd+Shift+N) -> New Window
    // Ctrl+Shift+K (or Cmd+Shift+K) -> Quick Inputs Panel
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
        if (e.key === "n" || e.key === "N") {
          e.preventDefault();
          createNewWindow();
        } else if (e.key === "k" || e.key === "K") {
          e.preventDefault();
          toggleSidebarTab("snippets");
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    // Auto-check for updates 3s after startup
    const timer = setTimeout(() => {
      checkUpdate()
        .then((info) => {
          if (info && info.available) {
            setUpdateInfo(info);
          }
        })
        .catch(() => {});
    }, 3000);

    return () => {
      if (unlistenConn) unlistenConn();
      if (unlistenTerm) unlistenTerm();
      window.removeEventListener("keydown", handleKeyDown);
      clearTimeout(timer);
    };
  }, [initFromPreferences, initListener, initTerminalListener, loadRecentProjects]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-vscode-bg text-vscode-text select-none">
      {/* Update Available Notification Banner */}
      {updateInfo && (
        <div className="bg-vscode-selected px-4 py-1.5 flex items-center justify-between text-xs border-b border-vscode-border z-50 flex-shrink-0 animate-fadeIn">
          <div className="flex items-center gap-2 text-white">
            <span className="font-semibold">🚀 New Update Available:</span>
            <span>Version {updateInfo.latest_version} is available.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={isUpdating}
              onClick={async () => {
                setIsUpdating(true);
                try {
                  await installUpdate();
                } catch (e: any) {
                  alert("Update failed: " + (e?.message || e));
                  setIsUpdating(false);
                }
              }}
              className="px-2.5 py-0.5 bg-white text-vscode-selected font-medium rounded hover:bg-gray-100 transition-all text-xs disabled:opacity-50"
            >
              {isUpdating ? "Updating..." : "Upgrade & Restart"}
            </button>
            <button
              onClick={() => setUpdateInfo(null)}
              className="text-white/80 hover:text-white px-1.5 font-bold"
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Top Main Workspace: ActivityBar + Sidebar + Editor/Terminal Area */}
      <div className="flex-1 flex flex-row overflow-hidden min-h-0">
        {/* 1. Activity Bar */}
        <ActivityBar />

        {/* 2. Sidebar (Collapsible & Draggable) */}
        {isSidebarOpen && (
          <>
            <SidebarContainer>
              {activeSidebarTab === "explorer" && (
                <ProjectExplorer
                  onOpenFile={(path, isPreview) => {
                    if (currentServerId) {
                      openFile(currentServerId, path, isPreview);
                    }
                  }}
                />
              )}
              {activeSidebarTab === "servers" && <ServerManager />}
              {activeSidebarTab === "snippets" && <QuickInputPanel />}
              {activeSidebarTab === "transfers" && <TransferPanel />}
              {activeSidebarTab === "settings" && (
                <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-3 text-xs text-vscode-text">
                  <div className="p-3 bg-vscode-bg/60 border border-vscode-border rounded-lg flex flex-col gap-2">
                    <span className="font-semibold text-vscode-textBright text-xs">Layout & Panels</span>
                    <p className="text-[11px] text-vscode-textMuted leading-relaxed">
                      Reset sidebar width and terminal panel height to default dimensions.
                    </p>
                    <button
                      onClick={resetLayout}
                      className="mt-1 px-3 py-1.5 bg-vscode-selected text-white rounded hover:brightness-110 transition-all text-xs w-fit"
                    >
                      Reset Layout Defaults
                    </button>
                  </div>

                  <div className="p-3 bg-vscode-bg/60 border border-vscode-border rounded-lg flex flex-col gap-2">
                    <span className="font-semibold text-vscode-textBright text-xs">Software Updates</span>
                    <p className="text-[11px] text-vscode-textMuted leading-relaxed">
                      Check GitHub Releases for latest Remora updates.
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={async () => {
                          setManualCheckMsg("Checking for updates...");
                          try {
                            const info = await checkUpdate();
                            if (info && info.available) {
                              setUpdateInfo(info);
                              setManualCheckMsg(`Update found: v${info.latest_version}`);
                            } else {
                              setManualCheckMsg("Remora is up to date (v0.1.0)");
                            }
                          } catch (err: any) {
                            setManualCheckMsg("Failed to check updates: " + (err?.message || err));
                          }
                        }}
                        className="px-3 py-1.5 bg-vscode-hover text-vscode-textBright rounded border border-vscode-border hover:bg-vscode-selected hover:text-white transition-all text-xs w-fit"
                      >
                        Check for Updates
                      </button>
                      {manualCheckMsg && (
                        <span className="text-[11px] text-vscode-textMuted">{manualCheckMsg}</span>
                      )}
                    </div>
                  </div>

                  <div className="p-3 bg-vscode-bg/60 border border-vscode-border rounded-lg flex flex-col gap-1.5 text-[11px] text-vscode-textMuted">
                    <span className="font-semibold text-vscode-textBright text-xs">About Remora</span>
                    <p>Version: 0.1.0</p>
                    <p>Stack: Tauri 2 + Rust + React + CM6 + xterm.js</p>
                  </div>
                </div>
              )}
            </SidebarContainer>

            {/* Horizontal Splitter between Sidebar and Editor */}
            <Splitter
              direction="horizontal"
              onDrag={(delta) => setSidebarWidth(sidebarWidth + delta)}
            />
          </>
        )}

        {/* 3. Main Center + Bottom Panel Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-vscode-bg">
          {/* Editor Area */}
          <EditorArea />

          {/* Bottom Panel (Terminal / Output) */}
          {isTerminalOpen && (
            <>
              {/* Vertical Splitter between Editor and Bottom Panel */}
              <Splitter
                direction="vertical"
                onDrag={(delta) => setTerminalHeight(terminalHeight - delta)}
              />

              <div
                style={{ height: `${terminalHeight}px` }}
                className="border-t border-vscode-border flex flex-col flex-shrink-0 overflow-hidden"
              >
                <TerminalPanel />
              </div>
            </>
          )}
        </div>
      </div>

      {/* 4. Bottom Status Bar */}
      <StatusBar activePath={rootPath || undefined} />
    </div>
  );
}
