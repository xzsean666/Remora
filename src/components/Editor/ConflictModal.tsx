import React from "react";
import { AlertTriangle } from "lucide-react";
import { useEditorStore } from "../../stores/editorStore";

export const ConflictModal: React.FC = () => {
  const { conflictInfo, resolveConflict } = useEditorStore();

  if (!conflictInfo) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-vscode-sidebar border border-vscode-border rounded-lg shadow-2xl max-w-md w-full p-5 flex flex-col gap-4 text-xs animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-amber-500/20 text-amber-400 flex-shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-vscode-textBright mb-1">
              File Conflict Detected
            </h3>
            <p className="text-vscode-textMuted leading-relaxed">
              The remote file has been modified externally since you opened it.
              Saving now might overwrite changes made by another process or editor.
            </p>
            <div className="mt-2 p-2 bg-vscode-bg/80 rounded border border-vscode-border font-mono text-[11px] text-vscode-text truncate">
              {conflictInfo.path}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-vscode-border/60">
          <button
            onClick={() => resolveConflict("cancel")}
            className="px-3 py-1.5 rounded bg-vscode-hover text-vscode-text hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => resolveConflict("reload")}
            className="px-3 py-1.5 rounded bg-vscode-input text-vscode-textBright hover:bg-vscode-selected transition-colors"
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
