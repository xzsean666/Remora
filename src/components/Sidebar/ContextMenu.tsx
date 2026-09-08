import React, { useEffect, useRef } from "react";
import { FilePlus, FolderPlus, Edit2, Trash2, Copy, RefreshCw, Download } from "lucide-react";

export interface ContextMenuAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onNewFile?: () => void;
  onNewFolder?: () => void;
  onRename?: () => void;
  onDelete?: () => void;
  onRefresh?: () => void;
  onCopyPath?: () => void;
  onDownload?: () => void;
  isDir: boolean;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  onClose,
  onNewFile,
  onNewFolder,
  onRename,
  onDelete,
  onRefresh,
  onCopyPath,
  onDownload,
  isDir,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  // Adjust coordinates if menu overflows window
  const menuWidth = 192;
  const menuHeight = 220;
  const adjustedX = Math.max(8, Math.min(x, window.innerWidth - menuWidth - 8));
  const adjustedY = Math.max(8, Math.min(y, window.innerHeight - menuHeight - 8));

  return (
    <div
      ref={menuRef}
      style={{ left: `${adjustedX}px`, top: `${adjustedY}px` }}
      className="fixed z-50 w-48 bg-vscode-sidebar border border-vscode-border rounded-md shadow-2xl py-1 text-xs text-vscode-text select-none backdrop-blur-md"
    >
      {isDir && onNewFile && (
        <button
          onClick={() => {
            onNewFile();
            onClose();
          }}
          className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-vscode-selected hover:text-white transition-colors text-left"
        >
          <FilePlus className="w-4 h-4 opacity-80" />
          <span>New File...</span>
        </button>
      )}

      {isDir && onNewFolder && (
        <button
          onClick={() => {
            onNewFolder();
            onClose();
          }}
          className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-vscode-selected hover:text-white transition-colors text-left"
        >
          <FolderPlus className="w-4 h-4 opacity-80" />
          <span>New Folder...</span>
        </button>
      )}

      {(isDir && (onNewFile || onNewFolder)) && (
        <div className="my-1 border-t border-vscode-border/60" />
      )}

      {onRename && (
        <button
          onClick={() => {
            onRename();
            onClose();
          }}
          className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-vscode-selected hover:text-white transition-colors text-left"
        >
          <Edit2 className="w-4 h-4 opacity-80" />
          <span>Rename...</span>
        </button>
      )}

      {onCopyPath && (
        <button
          onClick={() => {
            onCopyPath();
            onClose();
          }}
          className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-vscode-selected hover:text-white transition-colors text-left"
        >
          <Copy className="w-4 h-4 opacity-80" />
          <span>Copy Path</span>
        </button>
      )}

      {onRefresh && (
        <button
          onClick={() => {
            onRefresh();
            onClose();
          }}
          className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-vscode-selected hover:text-white transition-colors text-left"
        >
          <RefreshCw className="w-4 h-4 opacity-80" />
          <span>Refresh</span>
        </button>
      )}

      {onDownload && !isDir && (
        <button
          onClick={() => {
            onDownload();
            onClose();
          }}
          className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-vscode-selected hover:text-white transition-colors text-left"
        >
          <Download className="w-4 h-4 opacity-80" />
          <span>Download...</span>
        </button>
      )}

      {onDelete && (
        <>
          <div className="my-1 border-t border-vscode-border/60" />
          <button
            onClick={() => {
              onDelete();
              onClose();
            }}
            className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-red-600 hover:text-white text-red-400 transition-colors text-left"
          >
            <Trash2 className="w-4 h-4 opacity-80" />
            <span>Delete</span>
          </button>
        </>
      )}
    </div>
  );
};
