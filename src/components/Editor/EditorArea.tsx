import React, { useEffect } from "react";
import { useEditorStore } from "../../stores/editorStore";
import { useConnectionStore } from "../../stores/connectionStore";
import { useLayoutStore } from "../../stores/layoutStore";
import { EditorTabBar } from "./EditorTabBar";
import { CodeEditor } from "./CodeEditor";
import { ImageViewer } from "./ImageViewer";
import { MarkdownViewer } from "./MarkdownViewer";
import { ConflictModal } from "./ConflictModal";
import {
  Code2,
  Loader2,
  Sparkles,
  AlertTriangle,
  RefreshCw,
  BookOpen,
  PenLine,
  Columns2,
  FileText,
} from "lucide-react";

export const EditorArea: React.FC = () => {
  const {
    tabs,
    activeTabPath,
    loading,
    toggleSvgViewMode,
    setMarkdownViewMode,
    toggleMarkdownViewMode,
  } = useEditorStore();
  const { status, reconnectAttempt, reconnect } = useConnectionStore();
  const { isMobile } = useLayoutStore();
  const activeTab = tabs.find((t) => t.path === activeTabPath);

  // Global shortcut (Ctrl+E / Cmd+E or Ctrl+Shift+V) to toggle Markdown view mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeTab || activeTab.fileType !== "markdown") return;

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      if (modKey && (e.key === "e" || e.key === "E")) {
        e.preventDefault();
        toggleMarkdownViewMode(activeTab.path);
      } else if (modKey && e.shiftKey && (e.key === "v" || e.key === "V")) {
        e.preventDefault();
        toggleMarkdownViewMode(activeTab.path);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTab?.path, activeTab?.fileType, activeTab?.viewMode, toggleMarkdownViewMode]);

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden bg-vscode-bg relative">
      {/* Tabs Header */}
      <EditorTabBar />

      {/* Disconnection / Reconnection Banner */}
      {(status === "reconnecting" || status === "failed") && (
        <div
          className={`px-3 py-1.5 flex items-center justify-between text-xs border-b z-20 select-none animate-in fade-in duration-200 flex-shrink-0 ${
            status === "reconnecting"
              ? "bg-amber-950/40 border-amber-600/30 text-amber-200"
              : "bg-red-950/40 border-red-600/30 text-red-200"
          }`}
        >
          <div className="flex items-center gap-2 truncate mr-2 min-w-0 flex-1">
            {status === "reconnecting" ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
            )}
            <span className="truncate min-w-0">
              {status === "reconnecting"
                ? `Connection interrupted. Auto-reconnecting (${reconnectAttempt}/5)... Unsaved edits are buffered safely.`
                : "SSH connection lost. All editor changes remain safely in memory."}
            </span>
          </div>

          <button
            onClick={() => reconnect()}
            className="px-2.5 py-0.5 rounded bg-vscode-activityBarActive text-white hover:bg-vscode-activityBarActive/90 transition-colors text-[11px] font-medium flex-shrink-0 shadow-xs"
          >
            Reconnect Now
          </button>
        </div>
      )}

      {/* Editor Content or Empty Welcome Screen */}
      <div className="flex-1 min-h-0 min-w-0 relative overflow-hidden bg-vscode-bg">
        {activeTab ? (
          activeTab.fileType === "image" && activeTab.viewMode !== "source" ? (
            <ImageViewer key={activeTab.path} tab={activeTab} />
          ) : activeTab.fileType === "markdown" ? (
            <div className="w-full h-full flex flex-col relative">
              {/* Markdown Mode Switcher Bar */}
              <div className="h-8 px-3 bg-vscode-sidebar/90 border-b border-vscode-border/80 flex items-center justify-between text-xs text-vscode-textMuted flex-shrink-0 select-none">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium text-[11px] text-vscode-textBright/90 flex items-center gap-1.5 truncate">
                    <FileText className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                    <span className="truncate">{activeTab.name}</span>
                  </span>
                  {activeTab.viewMode === "preview" && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30">
                      阅读模式
                    </span>
                  )}
                  {activeTab.viewMode === "source" && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                      编辑源码模式
                    </span>
                  )}
                  {activeTab.viewMode === "split" && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      分屏对照模式
                    </span>
                  )}
                </div>

                {/* Mode Switcher Buttons */}
                <div className="flex items-center gap-1">
                  <div className="flex items-center bg-vscode-bg/80 p-0.5 rounded border border-vscode-border/70 text-[11px]">
                    <button
                      onClick={() => setMarkdownViewMode(activeTab.path, "preview")}
                      className={`px-2 py-0.5 rounded flex items-center gap-1 transition-all ${
                        activeTab.viewMode === "preview"
                          ? "bg-vscode-activityBarActive text-white font-medium shadow-xs"
                          : "text-vscode-textMuted hover:text-vscode-text hover:bg-white/5"
                      }`}
                      title="阅读模式 (Preview)"
                    >
                      <BookOpen className="w-3 h-3" />
                      <span>阅读</span>
                    </button>

                    <button
                      onClick={() => setMarkdownViewMode(activeTab.path, "source")}
                      className={`px-2 py-0.5 rounded flex items-center gap-1 transition-all ${
                        activeTab.viewMode === "source"
                          ? "bg-vscode-activityBarActive text-white font-medium shadow-xs"
                          : "text-vscode-textMuted hover:text-vscode-text hover:bg-white/5"
                      }`}
                      title="源码编辑模式 (Edit, Ctrl+E)"
                    >
                      <PenLine className="w-3 h-3" />
                      <span>编辑</span>
                    </button>

                    {!isMobile && (
                      <button
                        onClick={() => setMarkdownViewMode(activeTab.path, "split")}
                        className={`px-2 py-0.5 rounded flex items-center gap-1 transition-all ${
                          activeTab.viewMode === "split"
                            ? "bg-vscode-activityBarActive text-white font-medium shadow-xs"
                            : "text-vscode-textMuted hover:text-vscode-text hover:bg-white/5"
                        }`}
                        title="双向分屏实时对照 (Split View)"
                      >
                        <Columns2 className="w-3 h-3" />
                        <span>分屏</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Content depending on viewMode */}
              <div className="flex-1 min-h-0 min-w-0 relative overflow-hidden">
                {activeTab.viewMode === "preview" && (
                  <MarkdownViewer key={activeTab.path} tab={activeTab} />
                )}
                {activeTab.viewMode === "source" && (
                  <CodeEditor key={activeTab.path} tab={activeTab} />
                )}
                {activeTab.viewMode === "split" && (
                  <div className="w-full h-full flex min-h-0 min-w-0">
                    <div className="flex-1 min-w-0 h-full border-r border-vscode-border/80 relative">
                      <CodeEditor key={activeTab.path} tab={activeTab} />
                    </div>
                    <div className="flex-1 min-w-0 h-full relative">
                      <MarkdownViewer key={`${activeTab.path}-preview`} tab={activeTab} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col relative">
              {activeTab.fileType === "image" && activeTab.viewMode === "source" && (
                <div className="px-3 py-1 bg-vscode-sidebar/90 border-b border-vscode-border/80 flex items-center justify-between text-xs text-vscode-textMuted flex-shrink-0">
                  <span className="text-[11px]">Editing SVG Source Code</span>
                  <button
                    onClick={() => toggleSvgViewMode(activeTab.path)}
                    className="px-2 py-0.5 rounded bg-vscode-activityBarActive text-white text-[11px] hover:bg-vscode-activityBarActive/90 transition-colors font-medium shadow-xs"
                  >
                    View Preview
                  </button>
                </div>
              )}
              <div className="flex-1 min-h-0 relative">
                <CodeEditor key={activeTab.path} tab={activeTab} />
              </div>
            </div>
          )
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center select-none overflow-y-auto min-h-0">
            <div className="max-w-md p-8 border border-vscode-border/50 rounded-2xl bg-vscode-sidebar/30 backdrop-blur-sm flex flex-col items-center my-auto flex-shrink-0">
              <div className="w-14 h-14 rounded-2xl bg-vscode-activityBarActive/10 border border-vscode-activityBarActive/20 flex items-center justify-center mb-4 text-vscode-activityBarActive">
                <Code2 className="w-7 h-7" />
              </div>

              <h2 className="text-base font-semibold text-vscode-textBright mb-1 flex items-center gap-1.5">
                Remora Remote Code Editor
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              </h2>
              <p className="text-xs text-vscode-textMuted mb-6 max-w-xs leading-relaxed">
                Zero-lag remote file editing powered by CodeMirror 6 and SSH/SFTP streaming.
              </p>

              {/* Keyboard shortcuts hints */}
              <div className="w-full grid grid-cols-2 gap-2 text-[11px] text-vscode-textMuted border-t border-vscode-border/40 pt-4">
                <div className="flex justify-between items-center px-2 py-1 bg-vscode-bg/60 rounded">
                  <span>Save File</span>
                  <kbd className="px-1.5 py-0.5 bg-vscode-border/60 rounded font-mono text-[10px] text-vscode-textBright">
                    Ctrl+S
                  </kbd>
                </div>
                <div className="flex justify-between items-center px-2 py-1 bg-vscode-bg/60 rounded">
                  <span>Toggle Terminal</span>
                  <kbd className="px-1.5 py-0.5 bg-vscode-border/60 rounded font-mono text-[10px] text-vscode-textBright">
                    Ctrl+`
                  </kbd>
                </div>
                <div className="flex justify-between items-center px-2 py-1 bg-vscode-bg/60 rounded">
                  <span>Find in File</span>
                  <kbd className="px-1.5 py-0.5 bg-vscode-border/60 rounded font-mono text-[10px] text-vscode-textBright">
                    Ctrl+F
                  </kbd>
                </div>
                <div className="flex justify-between items-center px-2 py-1 bg-vscode-bg/60 rounded">
                  <span>Close Tab</span>
                  <kbd className="px-1.5 py-0.5 bg-vscode-border/60 rounded font-mono text-[10px] text-vscode-textBright">
                    Middle Click
                  </kbd>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Global Loading Spinner for Editor */}
        {loading && (
          <div className="absolute top-2 right-4 z-40 flex items-center gap-2 bg-vscode-sidebar/90 border border-vscode-border px-3 py-1.5 rounded-full shadow-lg text-xs text-vscode-textBright animate-in fade-in duration-150">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-vscode-activityBarActive" />
            <span>Fetching remote file...</span>
          </div>
        )}
      </div>

      {/* Conflict Dialog */}
      <ConflictModal />
    </div>
  );
};
