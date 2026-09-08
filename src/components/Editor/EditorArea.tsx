import React from "react";
import { useEditorStore } from "../../stores/editorStore";
import { useConnectionStore } from "../../stores/connectionStore";
import { EditorTabBar } from "./EditorTabBar";
import { CodeEditor } from "./CodeEditor";
import { ConflictModal } from "./ConflictModal";
import { Code2, Loader2, Sparkles, AlertTriangle, RefreshCw } from "lucide-react";

export const EditorArea: React.FC = () => {
  const { tabs, activeTabPath, loading } = useEditorStore();
  const { status, reconnectAttempt, reconnect } = useConnectionStore();
  const activeTab = tabs.find((t) => t.path === activeTabPath);

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden bg-vscode-bg relative">
      {/* Tabs Header */}
      <EditorTabBar />

      {/* Disconnection / Reconnection Banner */}
      {(status === "reconnecting" || status === "failed") && (
        <div
          className={`px-3 py-1.5 flex items-center justify-between text-xs border-b z-20 select-none animate-in fade-in duration-200 ${
            status === "reconnecting"
              ? "bg-amber-950/40 border-amber-600/30 text-amber-200"
              : "bg-red-950/40 border-red-600/30 text-red-200"
          }`}
        >
          <div className="flex items-center gap-2 truncate mr-2">
            {status === "reconnecting" ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
            )}
            <span className="truncate">
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
          <CodeEditor key={activeTab.path} tab={activeTab} />
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center select-none">
            <div className="max-w-md p-8 border border-vscode-border/50 rounded-2xl bg-vscode-sidebar/30 backdrop-blur-sm flex flex-col items-center">
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
