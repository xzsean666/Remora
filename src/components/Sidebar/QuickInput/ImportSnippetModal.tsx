import React, { useState, useMemo } from "react";
import { X, FileUp, Check, Layers, AlertTriangle, Sparkles } from "lucide-react";
import { QuickSnippet } from "../../../utils/tauriBridge";

interface ImportSnippetModalProps {
  isOpen: boolean;
  fileName: string;
  parsedSnippets: QuickSnippet[];
  onClose: () => void;
  onConfirm: (snippets: QuickSnippet[], overwrite: boolean) => Promise<void>;
}

export const ImportSnippetModal: React.FC<ImportSnippetModalProps> = ({
  isOpen,
  fileName,
  parsedSnippets,
  onClose,
  onConfirm,
}) => {
  const [overwrite, setOverwrite] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Group statistics
  const groupStats = useMemo(() => {
    const map = new Map<string, number>();
    parsedSnippets.forEach((s) => {
      const g = s.group_name || "General";
      map.set(g, (map.get(g) || 0) + 1);
    });
    return Array.from(map.entries());
  }, [parsedSnippets]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirm(parsedSnippets, overwrite);
      onClose();
    } catch (err: any) {
      setError(err?.message || "导入失败，请检查数据格式");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-vscode-bg border border-vscode-border rounded-lg shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-vscode-border bg-vscode-sidebar/50 flex-shrink-0">
          <div className="flex items-center gap-2">
            <FileUp className="w-4 h-4 text-vscode-activityBarActive" />
            <h3 className="text-sm font-semibold text-vscode-textBright">
              导入快捷输入 (Import Quick Snippets)
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-vscode-hover text-vscode-textMuted hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-xs">
          {error && (
            <div className="p-2.5 rounded bg-red-950/60 border border-red-500/50 text-red-200 text-xs">
              {error}
            </div>
          )}

          {/* Overview Info Card */}
          <div className="p-3 bg-vscode-sidebar/40 border border-vscode-border/80 rounded-md flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-vscode-textMuted text-[11px]">文件名称:</span>
              <span className="font-mono text-vscode-textBright text-[11px] font-medium truncate max-w-[280px]">
                {fileName}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-vscode-textMuted text-[11px]">有效命令数:</span>
              <span className="font-semibold text-emerald-400 text-xs">
                {parsedSnippets.length} 条快捷输入
              </span>
            </div>
            <div className="flex flex-col gap-1.5 pt-1 border-t border-vscode-border/40">
              <span className="text-[11px] text-vscode-textMuted flex items-center gap-1">
                <Layers className="w-3 h-3 text-vscode-activityBarActive" />
                <span>包含分组 ({groupStats.length}):</span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {groupStats.map(([grp, count]) => (
                  <span
                    key={grp}
                    className="px-2 py-0.5 rounded text-[11px] bg-vscode-hover text-vscode-textBright border border-vscode-border/60"
                  >
                    {grp}{" "}
                    <span className="text-vscode-textMuted text-[10px]">({count})</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Samples Preview List */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-vscode-textMuted">
              数据预览 (前 {Math.min(parsedSnippets.length, 3)} 条):
            </span>
            <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1">
              {parsedSnippets.slice(0, 3).map((item, idx) => (
                <div
                  key={idx}
                  className="p-2 bg-[#141414] border border-vscode-border/60 rounded text-[11px] flex flex-col gap-0.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-vscode-textBright truncate">
                      {item.title}
                    </span>
                    <span className="text-[10px] text-vscode-textMuted font-mono">
                      [{item.group_name}]
                    </span>
                  </div>
                  <pre className="font-mono text-[10px] text-emerald-400/90 truncate">
                    $ {item.command}
                  </pre>
                </div>
              ))}
            </div>
          </div>

          {/* Import Strategy Options */}
          <div className="flex flex-col gap-2 pt-1 border-t border-vscode-border/60">
            <span className="text-[11px] font-semibold text-vscode-textBright">
              导入模式 (Import Mode):
            </span>

            {/* Merge Option */}
            <label
              onClick={() => setOverwrite(false)}
              className={`p-2.5 rounded-md border flex items-start gap-2.5 cursor-pointer transition-colors ${
                !overwrite
                  ? "bg-vscode-selected/15 border-vscode-activityBarActive text-vscode-textBright"
                  : "bg-vscode-sidebar/30 border-vscode-border/70 text-vscode-textMuted hover:bg-vscode-hover/40"
              }`}
            >
              <input
                type="radio"
                name="importMode"
                checked={!overwrite}
                onChange={() => setOverwrite(false)}
                className="mt-0.5 accent-vscode-activityBarActive cursor-pointer"
              />
              <div className="flex flex-col">
                <span className="font-medium text-xs text-vscode-textBright flex items-center gap-1">
                  <span>合并更新 (Merge & Update) - 推荐</span>
                  <Sparkles className="w-3 h-3 text-amber-400" />
                </span>
                <span className="text-[11px] text-vscode-textMuted mt-0.5">
                  保留现有快捷输入库，同 ID 项执行更新，其余新条目无缝追加合并。
                </span>
              </div>
            </label>

            {/* Overwrite Option */}
            <label
              onClick={() => setOverwrite(true)}
              className={`p-2.5 rounded-md border flex items-start gap-2.5 cursor-pointer transition-colors ${
                overwrite
                  ? "bg-red-950/20 border-red-500/80 text-vscode-textBright"
                  : "bg-vscode-sidebar/30 border-vscode-border/70 text-vscode-textMuted hover:bg-vscode-hover/40"
              }`}
            >
              <input
                type="radio"
                name="importMode"
                checked={overwrite}
                onChange={() => setOverwrite(true)}
                className="mt-0.5 accent-red-500 cursor-pointer"
              />
              <div className="flex flex-col">
                <span className="font-medium text-xs text-red-300 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-red-400" />
                  <span>全量覆盖 (Overwrite All)</span>
                </span>
                <span className="text-[11px] text-vscode-textMuted mt-0.5">
                  清空本地现有的全部快捷输入，完全以导入文件的内容替代。
                </span>
              </div>
            </label>
          </div>
        </div>

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
            onClick={handleConfirm}
            disabled={isSubmitting || parsedSnippets.length === 0}
            className="px-4 py-1.5 rounded bg-vscode-activityBarActive hover:bg-vscode-activityBarActive/90 text-white font-medium transition-colors text-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs"
          >
            <Check className="w-3.5 h-3.5" />
            {isSubmitting ? "正在导入..." : `确认导入 (${parsedSnippets.length} 条)`}
          </button>
        </div>
      </div>
    </div>
  );
};
