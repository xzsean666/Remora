import { useEffect } from "react";
import { ActivityBar } from "./components/ActivityBar/ActivityBar";
import { SidebarContainer } from "./components/Sidebar/SidebarContainer";
import { Splitter } from "./components/Layout/Splitter";
import { StatusBar } from "./components/StatusBar/StatusBar";
import { ProjectExplorer } from "./components/Sidebar/ProjectExplorer/ProjectExplorer";
import { ServerManager } from "./components/Sidebar/ServerManager/ServerManager";
import { EditorArea } from "./components/Editor/EditorArea";
import { TerminalPanel } from "./components/Terminal/TerminalPanel";
import { TransferPanel } from "./components/Sidebar/TransferManager/TransferPanel";
import { useLayoutStore } from "./stores/layoutStore";
import { useEditorStore } from "./stores/editorStore";
import { useFileTreeStore } from "./stores/fileTreeStore";
import { useConnectionStore } from "./stores/connectionStore";

export default function App() {
  const {
    sidebarWidth,
    setSidebarWidth,
    terminalHeight,
    setTerminalHeight,
    isSidebarOpen,
    isTerminalOpen,
    activeSidebarTab,
    initFromPreferences,
  } = useLayoutStore();

  const { currentServerId, rootPath } = useFileTreeStore();
  const { openFile } = useEditorStore();
  const { initListener } = useConnectionStore();

  useEffect(() => {
    initFromPreferences();
    let unlisten: (() => void) | null = null;
    initListener().then((u) => {
      unlisten = u;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, [initFromPreferences, initListener]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-vscode-bg text-vscode-text select-none">
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
              {activeSidebarTab === "transfers" && <TransferPanel />}
              {activeSidebarTab === "settings" && (
                <div className="p-4 text-xs text-center py-10 text-vscode-textMuted/70">
                  Workspace Preferences & Layout
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
