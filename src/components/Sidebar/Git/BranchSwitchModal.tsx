import React, { useState } from "react";
import { GitBranch, Plus, Check, X, RefreshCw } from "lucide-react";
import { useGitStore } from "../../../stores/gitStore";
import { useFileTreeStore } from "../../../stores/fileTreeStore";
import { useConnectionStore } from "../../../stores/connectionStore";
import { formatErrorMessage } from "../../../utils/tauriBridge";

interface BranchSwitchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BranchSwitchModal: React.FC<BranchSwitchModalProps> = ({ isOpen, onClose }) => {
  const { currentBranch, branches, switchBranch } = useGitStore();
  const { currentServerId, rootPath } = useFileTreeStore();
  const { activeServerId } = useConnectionStore();

  const effectiveServerId = activeServerId || currentServerId;

  const [searchTerm, setSearchTerm] = useState("");
  const [newBranchName, setNewBranchName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredBranches = branches.filter((b) =>
    b.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSwitch = async (branch: string) => {
    if (!effectiveServerId || !rootPath) return;
    if (branch === currentBranch) {
      onClose();
      return;
    }

    setSwitchingTo(branch);
    setError(null);
    try {
      await switchBranch(effectiveServerId, rootPath, branch, false);
      onClose();
    } catch (err: any) {
      setError(formatErrorMessage(err) || `切换分支到 ${branch} 失败`);
    } finally {
      setSwitchingTo(null);
    }
  };

  const handleCreateAndSwitch = async () => {
    if (!effectiveServerId || !rootPath) return;
    const name = newBranchName.trim();
    if (!name) return;

    setSwitchingTo(name);
    setError(null);
    try {
      await switchBranch(effectiveServerId, rootPath, name, true);
      setNewBranchName("");
      setIsCreating(false);
      onClose();
    } catch (err: any) {
      setError(formatErrorMessage(err) || `新建并切换分支 ${name} 失败`);
    } finally {
      setSwitchingTo(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/60 backdrop-blur-xs select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#252526] border border-vscode-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh] animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 bg-[#1f1f1f] border-b border-vscode-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-vscode-activityBarActive" />
            <h3 className="text-sm font-semibold text-vscode-textBright">选择分支 (Switch Branch)</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-vscode-hover text-vscode-textMuted hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Action Input */}
        <div className="p-3 border-b border-vscode-border/70 space-y-2 bg-[#252526]">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜索已有分支..."
            className="w-full px-3 py-1.5 bg-[#1e1e1e] border border-vscode-border focus:border-vscode-activityBarActive rounded text-xs text-white placeholder-gray-500 outline-none"
            autoFocus
          />

          {error && (
            <div className="p-2 rounded bg-red-950/40 border border-red-800/60 text-red-300 text-[11px] leading-tight">
              {error}
            </div>
          )}

          {/* Quick create branch toggle */}
          {isCreating ? (
            <div className="flex items-center gap-1.5 pt-1">
              <input
                type="text"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateAndSwitch()}
                placeholder="新分支名 (如 feature/new-page)"
                className="flex-1 px-2.5 py-1 bg-[#1e1e1e] border border-amber-500/70 focus:border-amber-400 rounded text-xs text-white font-mono placeholder-gray-500 outline-none"
              />
              <button
                type="button"
                onClick={handleCreateAndSwitch}
                disabled={!newBranchName.trim() || Boolean(switchingTo)}
                className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs transition-colors disabled:opacity-50 flex items-center gap-1 cursor-pointer"
              >
                {switchingTo ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                <span>创建</span>
              </button>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-2 py-1 rounded hover:bg-vscode-hover text-vscode-textMuted hover:text-white text-xs"
              >
                取消
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              className="w-full py-1 px-2 rounded hover:bg-vscode-hover text-[11px] text-vscode-activityBarActive hover:text-sky-300 flex items-center justify-center gap-1 transition-colors cursor-pointer border border-vscode-border/50"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>新建分支 (Create new branch)</span>
            </button>
          )}
        </div>

        {/* Branch List */}
        <div className="p-2 overflow-y-auto flex-1 space-y-1">
          {filteredBranches.length === 0 ? (
            <div className="p-4 text-center text-xs text-vscode-textMuted">
              未找到匹配的分支
            </div>
          ) : (
            filteredBranches.map((b) => {
              const isCurrent = b === currentBranch;
              const isSwitching = switchingTo === b;

              return (
                <button
                  key={b}
                  type="button"
                  onClick={() => handleSwitch(b)}
                  disabled={Boolean(switchingTo)}
                  className={`w-full px-3 py-2 rounded-lg text-xs font-mono flex items-center justify-between transition-colors cursor-pointer text-left ${
                    isCurrent
                      ? "bg-vscode-activityBarActive/15 text-vscode-activityBarActive font-semibold border border-vscode-activityBarActive/30"
                      : "text-vscode-text hover:bg-vscode-hover hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate flex-1 min-w-0 mr-2">
                    <GitBranch className={`w-3.5 h-3.5 flex-shrink-0 ${isCurrent ? "text-vscode-activityBarActive" : "text-vscode-textMuted"}`} />
                    <span className="truncate">{b}</span>
                  </div>

                  {isSwitching ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-vscode-activityBarActive flex-shrink-0" />
                  ) : isCurrent ? (
                    <span className="flex items-center gap-1 text-[10px] text-vscode-activityBarActive flex-shrink-0">
                      <Check className="w-3.5 h-3.5" />
                      <span>当前分支</span>
                    </span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
