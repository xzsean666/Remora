import React, { useState, useEffect } from "react";
import { X, Check, FolderPlus, Terminal, Sparkles } from "lucide-react";
import { QuickSnippet, formatErrorMessage } from "../../../utils/tauriBridge";

interface SnippetEditModalProps {
  isOpen: boolean;
  snippet?: QuickSnippet | null;
  existingGroups: string[];
  initialGroup?: string;
  onClose: () => void;
  onSave: (snippet: QuickSnippet) => Promise<void>;
}

export const SnippetEditModal: React.FC<SnippetEditModalProps> = ({
  isOpen,
  snippet,
  existingGroups,
  initialGroup,
  onClose,
  onSave,
}) => {
  const isEditing = !!snippet;

  const [title, setTitle] = useState("");
  const [command, setCommand] = useState("");
  const [groupName, setGroupName] = useState("General");
  const [isNewGroup, setIsNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [autoExecute, setAutoExecute] = useState(true);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (snippet) {
      setTitle(snippet.title);
      setCommand(snippet.command);
      setGroupName(snippet.group_name || "General");
      setIsNewGroup(false);
      setNewGroupName("");
      setAutoExecute(snippet.auto_execute);
      setDescription(snippet.description || "");
    } else {
      setTitle("");
      setCommand("");
      const defaultGrp =
        initialGroup && initialGroup !== "ALL"
          ? initialGroup
          : existingGroups.length > 0
          ? existingGroups[0]
          : "General";
      setGroupName(defaultGrp);
      setIsNewGroup(false);
      setNewGroupName("");
      setAutoExecute(true);
      setDescription("");
    }
    setError(null);
  }, [snippet, isOpen, initialGroup, existingGroups]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please enter a title for the quick input.");
      return;
    }
    if (!command.trim()) {
      setError("Please enter the command / text to input.");
      return;
    }

    const finalGroup = isNewGroup ? newGroupName.trim() : groupName.trim();
    if (!finalGroup) {
      setError("Please specify a group name.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const now = Date.now();
    const payload: QuickSnippet = {
      id: snippet ? snippet.id : `snip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: title.trim(),
      command: command.trim(),
      group_name: finalGroup,
      auto_execute: autoExecute,
      description: description.trim() || null,
      sort_order: snippet ? snippet.sort_order : 0,
      created_at: snippet ? snippet.created_at : now,
      updated_at: now,
    };

    try {
      await onSave(payload);
      onClose();
    } catch (err: any) {
      setError(formatErrorMessage(err) || "Failed to save quick input.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-vscode-bg border border-vscode-border rounded-lg shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[min(90vh,calc(100dvh-1rem))] my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-vscode-border bg-vscode-sidebar/50 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-vscode-activityBarActive" />
            <h3 className="text-sm font-semibold text-vscode-textBright">
              {isEditing ? "编辑快捷输入 (Edit Quick Input)" : "新建快捷输入 (New Quick Input)"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-vscode-hover text-vscode-textMuted hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-xs">
          {error && (
            <div className="p-2.5 rounded bg-red-950/60 border border-red-500/50 text-red-200 text-xs flex items-center gap-2">
              <span className="font-semibold">Error:</span>
              <span>{error}</span>
            </div>
          )}

          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-vscode-textMuted flex items-center gap-1">
              <span>名称 / 标题 (Title)</span>
              <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 查看系统状态, Docker 容器监控, Git Log"
              autoFocus
              className="px-2.5 py-1.5 bg-vscode-input border border-vscode-border rounded text-vscode-text focus:outline-hidden focus:border-vscode-activityBarActive transition-colors"
            />
          </div>

          {/* Group */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-vscode-textMuted flex items-center gap-1">
                <span>所属分组 (Group)</span>
                <span className="text-red-400">*</span>
              </label>
              <button
                type="button"
                onClick={() => setIsNewGroup(!isNewGroup)}
                className="text-[11px] text-vscode-activityBarActive hover:underline flex items-center gap-1 cursor-pointer"
              >
                <FolderPlus className="w-3 h-3" />
                {isNewGroup ? "选择已有分组" : "新建新分组"}
              </button>
            </div>

            {isNewGroup ? (
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="输入新分组名称 (e.g. Kubernetes, Redis, Database)"
                className="px-2.5 py-1.5 bg-vscode-input border border-vscode-border rounded text-vscode-text focus:outline-hidden focus:border-vscode-activityBarActive transition-colors"
              />
            ) : (
              <select
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="px-2.5 py-1.5 bg-vscode-input border border-vscode-border rounded text-vscode-text focus:outline-hidden focus:border-vscode-activityBarActive transition-colors"
              >
                {existingGroups.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
                {existingGroups.length === 0 && <option value="General">General</option>}
              </select>
            )}
          </div>

          {/* Command */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-vscode-textMuted flex items-center gap-1">
              <span>快捷命令内容 (Command)</span>
              <span className="text-red-400">*</span>
            </label>
            <textarea
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="e.g. docker ps -a 或 git status 或 ./deploy.sh"
              rows={3}
              className="px-2.5 py-2 bg-[#141414] font-mono text-[12px] border border-vscode-border rounded text-vscode-textBright focus:outline-hidden focus:border-vscode-activityBarActive transition-colors resize-y leading-relaxed"
            />
            <span className="text-[10px] text-vscode-textMuted">
              支持单行或多行 Shell 命令，点击时将直接发送至活动终端。
            </span>
          </div>

          {/* Auto-execute Checkbox */}
          <div className="p-3 bg-vscode-sidebar/40 border border-vscode-border/70 rounded-md flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              id="autoExecuteCheckbox"
              checked={autoExecute}
              onChange={(e) => setAutoExecute(e.target.checked)}
              className="mt-0.5 rounded accent-vscode-activityBarActive cursor-pointer"
            />
            <label htmlFor="autoExecuteCheckbox" className="flex flex-col cursor-pointer select-none">
              <span className="text-xs font-semibold text-vscode-textBright flex items-center gap-1">
                <span>自动回车执行 (Auto-execute with Enter)</span>
                {autoExecute && <Sparkles className="w-3 h-3 text-amber-400" />}
              </span>
              <span className="text-[11px] text-vscode-textMuted mt-0.5">
                勾选：点击后自动追加回车换行立即执行；取消勾选：仅填入命令行暂不执行，方便继续补充参数。
              </span>
            </label>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-vscode-textMuted">
              备注说明 (Description - Optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="说明此快捷命令的使用场景或作用"
              className="px-2.5 py-1.5 bg-vscode-input border border-vscode-border rounded text-vscode-text focus:outline-hidden focus:border-vscode-activityBarActive transition-colors"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-vscode-border bg-vscode-sidebar/50 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded hover:bg-vscode-hover text-vscode-text transition-colors text-xs cursor-pointer"
          >
            取消 (Cancel)
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-1.5 rounded bg-vscode-activityBarActive hover:bg-vscode-activityBarActive/90 text-white font-medium transition-colors text-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs"
          >
            <Check className="w-3.5 h-3.5" />
            {isSubmitting ? "保存中..." : isEditing ? "保存修改" : "创建快捷输入"}
          </button>
        </div>
      </div>
    </div>
  );
};
