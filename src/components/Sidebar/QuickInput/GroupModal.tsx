import React, { useState, useEffect } from "react";
import { X, Check, Folder } from "lucide-react";
import { formatErrorMessage } from "../../../utils/tauriBridge";

interface GroupModalProps {
  isOpen: boolean;
  mode: "create" | "rename";
  initialGroupName?: string;
  onClose: () => void;
  onConfirm: (groupName: string) => Promise<void>;
}

export const GroupModal: React.FC<GroupModalProps> = ({
  isOpen,
  mode,
  initialGroupName = "",
  onClose,
  onConfirm,
}) => {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setName(initialGroupName);
    setError(null);
  }, [initialGroupName, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("分组名称不能为空 (Group name cannot be empty)");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onConfirm(name.trim());
      onClose();
    } catch (err: any) {
      setError(formatErrorMessage(err) || "操作失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-vscode-bg border border-vscode-border rounded-lg shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-vscode-border bg-vscode-sidebar/50">
          <div className="flex items-center gap-2">
            <Folder className="w-4 h-4 text-vscode-activityBarActive" />
            <h3 className="text-sm font-semibold text-vscode-textBright">
              {mode === "create" ? "新建分组 (New Group)" : "重命名分组 (Rename Group)"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-vscode-hover text-vscode-textMuted hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3 text-xs">
          {error && (
            <div className="p-2 rounded bg-red-950/60 border border-red-500/50 text-red-200 text-xs">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-vscode-textMuted">
              分组名称 (Group Name)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Docker, Kubernetes, Database, Monitoring"
              autoFocus
              className="px-2.5 py-1.5 bg-vscode-input border border-vscode-border rounded text-vscode-text focus:outline-hidden focus:border-vscode-activityBarActive transition-colors"
            />
          </div>

          <div className="flex items-center justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded hover:bg-vscode-hover text-vscode-text transition-colors text-xs cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-3.5 py-1.5 rounded bg-vscode-activityBarActive hover:bg-vscode-activityBarActive/90 text-white font-medium transition-colors text-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs"
            >
              <Check className="w-3.5 h-3.5" />
              {loading ? "提交中..." : "确定"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
