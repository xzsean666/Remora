import React, { useEffect, useState } from "react";
import { Trash2, AlertTriangle, X, ShieldAlert, ArchiveRestore } from "lucide-react";

interface DeleteConfirmModalProps {
  target: {
    path: string;
    name: string;
    isDir: boolean;
  } | null;
  onConfirm: (permanent: boolean) => void;
  onCancel: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  target,
  onConfirm,
  onCancel,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  if (!target) return null;

  const handleTrash = async () => {
    setIsDeleting(true);
    try {
      await onConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePermanent = async () => {
    setIsDeleting(true);
    try {
      await onConfirm(true);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-hidden select-none animate-in fade-in duration-150">
      <div className="bg-vscode-sidebar border border-vscode-border rounded-xl shadow-2xl max-w-md w-full flex flex-col p-5 gap-4 text-xs">
        {/* Header */}
        <div className="flex items-start gap-3 min-w-0">
          <div className="p-2.5 rounded-xl bg-red-500/15 text-red-400 flex-shrink-0">
            <Trash2 className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-vscode-textBright">
                Delete {target.isDir ? "Folder" : "File"} / 删除确认
              </h3>
              <button
                onClick={onCancel}
                disabled={isDeleting}
                className="text-vscode-textMuted hover:text-vscode-textBright p-1 rounded transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-vscode-textMuted mt-1 leading-relaxed text-[11px]">
              确定要删除远端服务器上的此项吗？
            </p>
            <div
              className="mt-2 p-2 bg-vscode-bg/80 rounded border border-vscode-border font-mono text-[11px] text-vscode-textBright break-all"
              title={target.path}
            >
              <div className="text-vscode-textMuted text-[10px] uppercase font-sans tracking-wider mb-0.5">
                {target.isDir ? "Folder to delete" : "File to delete"}:
              </div>
              <span className="text-amber-300 font-semibold">{target.name}</span>
              <div className="text-vscode-textMuted text-[10px] truncate mt-0.5 opacity-80 font-normal">
                {target.path}
              </div>
            </div>
          </div>
        </div>

        {/* Informative Note */}
        <div className="p-2.5 rounded-lg bg-vscode-bg/50 border border-vscode-border/70 flex flex-col gap-1.5 text-[11px] leading-relaxed">
          <div className="flex items-center gap-1.5 text-blue-400 font-medium">
            <ArchiveRestore className="w-3.5 h-3.5 flex-shrink-0" />
            <span>【推荐】移至远端回收站 (Move to Trash)</span>
          </div>
          <p className="text-vscode-textMuted text-[10.5px] pl-5">
            文件将安全保存至服务器 <code className="text-vscode-textBright font-mono">~/.local/share/Trash</code>，误删可随时找回。
          </p>
          <div className="flex items-center gap-1.5 text-red-400/90 font-medium mt-1">
            <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
            <span>【彻底清除】永久删除 (Delete Permanently)</span>
          </div>
          <p className="text-vscode-textMuted text-[10.5px] pl-5">
            直接在远端服务器擦除（目录包含的所有内容将递归清理），操作不可逆。
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-vscode-border/60">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onCancel}
            className="px-3 py-1.5 rounded bg-vscode-hover hover:bg-vscode-border text-vscode-text hover:text-white transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
          >
            <span>Cancel (取消)</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isDeleting}
              onClick={handlePermanent}
              className="px-2.5 py-1.5 rounded border border-red-500/40 text-red-400 hover:bg-red-950/40 hover:text-red-200 transition-colors text-xs font-medium flex items-center gap-1 cursor-pointer disabled:opacity-50"
              title="Permanently remove file or directory without moving to trash"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>永久删除</span>
            </button>

            <button
              type="button"
              autoFocus
              disabled={isDeleting}
              onClick={handleTrash}
              className="px-3.5 py-1.5 rounded bg-vscode-activityBarActive hover:bg-vscode-activityBarActive/90 text-white font-medium shadow-sm transition-all flex items-center gap-1.5 text-xs cursor-pointer disabled:opacity-50"
              title="Move file into remote Trash folder (~/.local/share/Trash)"
            >
              <ArchiveRestore className="w-3.5 h-3.5" />
              <span>移至回收站</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
