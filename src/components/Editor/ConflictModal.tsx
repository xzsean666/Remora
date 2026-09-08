import React from "react";
import { AlertTriangle } from "lucide-react";
import { useEditorStore } from "../../stores/editorStore";

export const ConflictModal: React.FC = () => {
  const { conflictInfo, resolveConflict } = useEditorStore();

  if (!conflictInfo) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-hidden">
      <div className="bg-vscode-sidebar border border-vscode-border rounded-xl shadow-2xl max-w-md w-full max-h-[85vh] flex flex-col p-5 gap-4 text-xs animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
        <div className="flex items-start gap-3 min-w-0 flex-1 overflow-y-auto pr-1">
          <div className="p-2 rounded-full bg-amber-500/20 text-amber-400 flex-shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-vscode-textBright mb-1">
              File Conflict Detected
            </h3>
            <p className="text-vscode-textMuted leading-relaxed">
              The remote file has been modified externally since you opened it.
              Saving now might overwrite changes made by another process or editor.
            </p>
            <div className="mt-2 p-2 bg-vscode-bg/80 rounded border border-vscode-border font-mono text-[11px] text-vscode-text truncate min-w-0" title={conflictInfo.path}>
              {conflictInfo.path}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-vscode-border/60 flex-shrink-0">
          <button
            onClick={() => resolveConflict("cancel")}
            className="px-3 py-1.5 rounded bg-vscode-hover text-vscode-text hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => resolveConflict("reload")}
            className="px-3 py-1.5 rounded bg-vscode-bg text-vscode-textBright hover:bg-vscode-selected transition-colors border border-vscode-border"
          >
            Reload from Remote
          </button>
          <button
            onClick={() => resolveConflict("overwrite")}
            className="px-3 py-1.5 rounded bg-amber-600 text-white font-medium hover:bg-amber-500 transition-colors shadow-sm"
          >
            Overwrite Remote
          </button>
        </div>
      </div>
    </div>
  );
};
