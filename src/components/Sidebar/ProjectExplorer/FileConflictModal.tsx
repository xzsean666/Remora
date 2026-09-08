import React, { useState, useEffect } from "react";
import { AlertTriangle, Replace, FileEdit, X } from "lucide-react";

export interface FileConflictItem {
  id: string;
  filename: string;
  sourcePath: string; // local path or remote source path
  targetDir: string;
  isInternalMove?: boolean;
}

export function suggestNewName(filename: string, existingNames?: string[]): string {
  const dotIndex = filename.lastIndexOf(".");
  let baseName = filename;
  let ext = "";
  if (dotIndex > 0) {
    baseName = filename.substring(0, dotIndex);
    ext = filename.substring(dotIndex);
  }

  const match = baseName.match(/^(.*?)(?: \((\d+)\))?$/);
  const prefix = match ? match[1] : baseName;
  let counter = match && match[2] ? parseInt(match[2], 10) + 1 : 1;

  let candidate = `${prefix} (${counter})${ext}`;
  if (existingNames && existingNames.length > 0) {
    const nameSet = new Set(existingNames);
    while (nameSet.has(candidate)) {
      counter++;
      candidate = `${prefix} (${counter})${ext}`;
    }
  }
  return candidate;
}

interface FileConflictModalProps {
  conflict: FileConflictItem | null;
  currentIndex?: number;
  totalConflicts?: number;
  existingNames?: string[];
  onReplace: () => void;
  onRename: (newName: string) => void;
  onCancel: () => void;
  onReplaceAll?: () => void;
}

export const FileConflictModal: React.FC<FileConflictModalProps> = ({
  conflict,
  currentIndex = 1,
  totalConflicts = 1,
  existingNames = [],
  onReplace,
  onRename,
  onCancel,
  onReplaceAll,
}) => {
  const [renameValue, setRenameValue] = useState("");

  useEffect(() => {
    if (conflict) {
      setRenameValue(suggestNewName(conflict.filename, existingNames));
    }
  }, [conflict, existingNames]);

  if (!conflict) return null;

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (renameValue.trim() && renameValue.trim() !== conflict.filename) {
      onRename(renameValue.trim());
    } else if (renameValue.trim() === conflict.filename) {
      // If user kept the same name, treat as replace
      onReplace();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-hidden select-none animate-in fade-in duration-150">
      <div className="bg-vscode-sidebar border border-vscode-border rounded-xl shadow-2xl max-w-md w-full flex flex-col p-5 gap-4 text-xs">
        {/* Header */}
        <div className="flex items-start gap-3 min-w-0">
          <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-400 flex-shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-vscode-textBright">
                File Conflict / 文件同名冲突
              </h3>
              {totalConflicts > 1 && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-vscode-activityBarActive/20 text-vscode-activityBarActive">
                  {currentIndex} / {totalConflicts}
                </span>
              )}
            </div>
            <p className="text-vscode-textMuted mt-1 leading-relaxed text-[11px]">
              An item named <code className="text-amber-300 font-mono font-semibold">{conflict.filename}</code> already exists in destination folder.
            </p>
            <div
              className="mt-1.5 p-1.5 bg-vscode-bg/80 rounded border border-vscode-border font-mono text-[10px] text-vscode-textMuted truncate"
              title={conflict.targetDir}
            >
              Target: {conflict.targetDir}
            </div>
          </div>
        </div>

        {/* Rename Input Area */}
        <form onSubmit={handleRenameSubmit} className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium text-vscode-textBright flex items-center gap-1.5">
            <FileEdit className="w-3.5 h-3.5 text-vscode-activityBarActive" />
            <span>Rename & Keep Both (重命名另存):</span>
          </label>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="flex-1 px-2.5 py-1.5 bg-vscode-bg border border-vscode-border rounded focus:border-vscode-activityBarActive focus:outline-none text-vscode-textBright font-mono text-xs"
              placeholder="Enter new file name..."
            />
            <button
              type="submit"
              disabled={!renameValue.trim()}
              className="px-3 py-1.5 bg-vscode-selected text-white font-medium rounded hover:brightness-110 disabled:opacity-50 transition-all flex items-center gap-1 text-xs"
              title="Save with new name"
            >
              <FileEdit className="w-3 h-3" />
              <span>Rename</span>
            </button>
          </div>
        </form>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-vscode-border/60">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded bg-vscode-hover hover:bg-vscode-border text-vscode-text hover:text-white transition-colors flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            <span>Cancel</span>
          </button>

          <div className="flex items-center gap-2">
            {totalConflicts > 1 && onReplaceAll && (
              <button
                type="button"
                onClick={onReplaceAll}
                className="px-2.5 py-1.5 rounded bg-vscode-bg border border-vscode-border text-vscode-textBright hover:bg-vscode-selected hover:text-white transition-colors text-xs"
              >
                Replace All
              </button>
            )}

            <button
              type="button"
              onClick={onReplace}
              className="px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-white font-medium shadow-sm transition-all flex items-center gap-1 text-xs"
              title="Overwrite existing file on remote server"
            >
              <Replace className="w-3.5 h-3.5" />
              <span>Replace (替换)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
