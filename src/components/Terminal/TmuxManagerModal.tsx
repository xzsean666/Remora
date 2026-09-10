import React, { useState, useEffect, useCallback } from "react";
import {
  Layers,
  RefreshCw,
  Plus,
  Trash2,
  Play,
  X,
  AlertTriangle,
  Clock,
  Terminal,
  Server,
} from "lucide-react";
import {
  listTmuxSessions,
  killTmuxSession,
  createTmuxSession,
  TmuxSessionInfo,
  formatErrorMessage,
} from "../../utils/tauriBridge";
import { useTerminalStore } from "../../stores/terminalStore";
import { useConnectionStore } from "../../stores/connectionStore";
import { useFileTreeStore } from "../../stores/fileTreeStore";
import { useLayoutStore } from "../../stores/layoutStore";

interface TmuxManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TmuxManagerModal: React.FC<TmuxManagerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { currentServerId, rootPath } = useFileTreeStore();
  const { activeServerId, connectedServerName, connectedServerProxy } =
    useConnectionStore();
  const {
    openTmuxSession,
    closeTmuxTerminals,
    sendDataToActiveTerminal,
  } = useTerminalStore();
  const { setTerminalOpen, setMobileTab, isMobile } = useLayoutStore();

  const effectiveServerId = activeServerId || currentServerId;

  const [loading, setLoading] = useState(false);
  const [installed, setInstalled] = useState(true);
  const [sessions, setSessions] = useState<TmuxSessionInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newSessionName, setNewSessionName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [deletingName, setDeletingName] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    if (!effectiveServerId) {
      setError("尚未连接到 SSH 服务器，请先连接服务器。");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await listTmuxSessions(effectiveServerId);
      setInstalled(res.installed);
      setSessions(res.sessions || []);
      if (res.error) {
        setError(res.error);
      }
    } catch (err: any) {
      setError(formatErrorMessage(err) || "获取 TMUX 会话列表失败");
    } finally {
      setLoading(false);
    }
  }, [effectiveServerId]);

  useEffect(() => {
    if (isOpen) {
      fetchSessions();
    }
  }, [isOpen, fetchSessions]);

  if (!isOpen) return null;

  const handleEnterSession = (sessionName: string) => {
    if (!effectiveServerId) return;

    openTmuxSession({
      serverId: effectiveServerId,
      serverName: connectedServerName || undefined,
      sessionName,
      initialDir: rootPath || undefined,
      remoteProxy: connectedServerProxy || undefined,
    });

    setTerminalOpen(true);
    if (isMobile) {
      setMobileTab("terminal");
    }
    onClose();
  };

  const handleCreateSession = async (openImmediately: boolean = true) => {
    if (!effectiveServerId) return;
    const raw = newSessionName.trim();
    const finalName =
      raw ||
      `remora_${Date.now().toString(36).slice(-4)}`;

    setIsCreating(true);
    setError(null);
    try {
      await createTmuxSession(effectiveServerId, finalName);
      setNewSessionName("");
      if (openImmediately) {
        handleEnterSession(finalName);
      } else {
        await fetchSessions();
      }
    } catch (err: any) {
      setError(formatErrorMessage(err) || "创建 TMUX 会话失败");
    } finally {
      setIsCreating(false);
    }
  };

  const handleKillSession = async (sessionName: string) => {
    if (!effectiveServerId) return;
    const confirmed = window.confirm(
      `确定要终止 TMUX 会话 "${sessionName}" 吗？\n会话中运行的程序将会退出。`
    );
    if (!confirmed) return;

    setDeletingName(sessionName);
    setError(null);
    try {
      await killTmuxSession(effectiveServerId, sessionName);
      // 同步清理已终止会话对应的前端终端标签
      closeTmuxTerminals(effectiveServerId, sessionName);
      await fetchSessions();
    } catch (err: any) {
      setError(formatErrorMessage(err) || "终止会话失败");
    } finally {
      setDeletingName(null);
    }
  };

  const handleInstallTmux = () => {
    const installCmd = `if command -v apt-get >/dev/null 2>&1; then (which sudo >/dev/null 2>&1 && sudo apt-get update -qq && sudo apt-get install -y tmux) || (apt-get update -qq && apt-get install -y tmux); elif command -v yum >/dev/null 2>&1; then (which sudo >/dev/null 2>&1 && sudo yum install -y tmux) || yum install -y tmux; elif command -v dnf >/dev/null 2>&1; then (which sudo >/dev/null 2>&1 && sudo dnf install -y tmux) || dnf install -y tmux; elif command -v apk >/dev/null 2>&1; then (which sudo >/dev/null 2>&1 && sudo apk add tmux) || apk add tmux; elif command -v pacman >/dev/null 2>&1; then (which sudo >/dev/null 2>&1 && sudo pacman -Sy --noconfirm tmux) || pacman -Sy --noconfirm tmux; fi\n`;
    sendDataToActiveTerminal(installCmd);
    onClose();
  };

  const formatCreatedTime = (timestamp: number) => {
    if (!timestamp) return "未知时间";
    try {
      const date = new Date(timestamp * 1000);
      return date.toLocaleString([], {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return String(timestamp);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-xs">
      <div
        className="bg-[#1e1e1e] border border-[#3e3e3e] rounded-xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 bg-[#252526] border-b border-[#333333] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm font-semibold text-vscode-textBright">
              TMUX 会话管理器
            </h2>
            {connectedServerName && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#333333] text-gray-300 border border-[#444444] flex items-center gap-1">
                <Server className="w-3 h-3 text-emerald-400" />
                {connectedServerName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={fetchSessions}
              disabled={loading}
              title="刷新远端会话列表"
              className="p-1.5 rounded hover:bg-[#333333] text-gray-400 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded hover:bg-[#333333] text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="p-2.5 rounded bg-red-950/50 border border-red-800/60 text-red-300 text-xs flex items-center justify-between">
              <span>{error}</span>
              <button
                type="button"
                onClick={fetchSessions}
                className="underline hover:text-white ml-2 text-[11px]"
              >
                重试
              </button>
            </div>
          )}

          {!installed && (
            <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-800/60 text-amber-200 text-xs flex flex-col gap-2">
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>远端服务器尚未安装 TMUX</span>
              </div>
              <p className="text-gray-300 text-[11px] leading-relaxed">
                TMUX 能够让您的编译、训练与会话常驻在后台，即使网络中断或手机锁屏也不会中断任务。
              </p>
              <button
                type="button"
                onClick={handleInstallTmux}
                className="self-start px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-black font-semibold text-xs transition-colors"
              >
                在终端中一键自动安装 TMUX
              </button>
            </div>
          )}

          {/* Quick Create Form */}
          <div className="bg-[#252526] p-3 rounded-lg border border-[#333333]">
            <div className="text-xs font-medium text-gray-300 mb-2 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-amber-400" />
              <span>新建独立 TMUX 会话</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newSessionName}
                onChange={(e) => setNewSessionName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateSession(true)}
                placeholder="会话名 (留空自动生成，如 dev, worker, test)"
                className="flex-1 px-3 py-1.5 bg-[#1e1e1e] border border-[#3e3e3e] focus:border-amber-500 rounded text-xs text-white placeholder-gray-500 outline-none"
              />
              <button
                type="button"
                onClick={() => handleCreateSession(true)}
                disabled={isCreating}
                className="px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-black font-medium text-xs transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1 whitespace-nowrap"
              >
                {isCreating ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-black" />
                )}
                <span>新建并打开</span>
              </button>
            </div>
          </div>

          {/* Sessions List */}
          <div>
            <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
              <span className="font-medium">
                服务器活跃会话 ({sessions.length})
              </span>
              {loading && (
                <span className="text-[11px] text-amber-400 animate-pulse">
                  正在同步...
                </span>
              )}
            </div>

            {sessions.length === 0 ? (
              <div className="p-6 rounded-lg border border-dashed border-[#333333] text-center text-gray-400 text-xs space-y-1.5">
                <Terminal className="w-6 h-6 mx-auto text-gray-600 mb-2" />
                <p className="font-medium text-gray-300">暂无活跃的 TMUX 会话</p>
                <p className="text-gray-500 text-[11px]">
                  普通终端即开即用；若需要后台保活任务，可点击上方新建会话。
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {sessions.map((s) => (
                  <div
                    key={s.name}
                    className="p-3 bg-[#252526] hover:bg-[#2b2b2c] border border-[#333333] rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-bold text-amber-400">
                          {s.name}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#333333] text-gray-300 border border-[#444444]">
                          {s.windows} 窗口
                        </span>
                        {s.attached ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800">
                            已附着
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700">
                            后台空闲
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>创建于 {formatCreatedTime(s.created_at)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => handleEnterSession(s.name)}
                        title="新建独立终端并进入该 TMUX 会话"
                        className="px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs transition-all active:scale-95 flex items-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-black" />
                        <span>进入</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleKillSession(s.name)}
                        disabled={deletingName === s.name}
                        title="销毁该会话"
                        className="p-1.5 rounded hover:bg-red-950/50 text-gray-500 hover:text-red-400 transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-[#252526] border-t border-[#333333] text-[11px] text-gray-400 flex items-center justify-between flex-shrink-0">
          <span>💡 提示：在 TMUX 中按 DETACH 或 Ctrl+B d 即可脱离返回普通终端。</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded hover:bg-[#333333] text-gray-300 text-xs transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};
