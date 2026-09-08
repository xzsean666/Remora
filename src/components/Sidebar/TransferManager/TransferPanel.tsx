import React, { useEffect } from "react";
import {
  ArrowUpRight,
  ArrowDownLeft,
  X,
  Trash2,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  Ban,
  UploadCloud,
} from "lucide-react";
import { useTransferStore, TransferItem } from "../../../stores/transferStore";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export const TransferPanel: React.FC = () => {
  const {
    transfers,
    fetchTransfers,
    listenProgress,
    cancelTransfer,
    clearCompleted,
  } = useTransferStore();

  useEffect(() => {
    fetchTransfers();
    let unlistenFn: (() => void) | null = null;
    listenProgress().then((unlisten) => {
      unlistenFn = unlisten;
    });

    return () => {
      if (unlistenFn) unlistenFn();
    };
  }, [fetchTransfers, listenProgress]);

  const activeCount = transfers.filter(
    (t) => t.status === "transferring" || t.status === "pending"
  ).length;

  return (
    <div className="flex flex-col h-full overflow-hidden select-none bg-vscode-sidebar text-xs">
      {/* Header */}
      <div className="h-7 px-3 bg-vscode-sidebar/90 border-b border-vscode-border/40 flex items-center justify-between text-[11px] font-bold text-vscode-textBright uppercase">
        <div className="flex items-center gap-1.5">
          <span>Transfers</span>
          {activeCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-vscode-activityBarActive text-[10px] text-white font-mono">
              {activeCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            title="Refresh Transfers"
            onClick={fetchTransfers}
            className="p-1 hover:text-white hover:bg-vscode-hover rounded transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            title="Clear Completed"
            onClick={clearCompleted}
            className="p-1 hover:text-white hover:bg-vscode-hover rounded transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Transfers List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {transfers.length === 0 ? (
          <div className="p-4 text-center text-vscode-textMuted flex flex-col items-center justify-center gap-2 mt-10">
            <UploadCloud className="w-10 h-10 opacity-30 text-vscode-textBright" />
            <p className="text-xs font-medium text-vscode-textBright">No Transfers</p>
            <p className="text-[11px] text-vscode-textMuted leading-relaxed max-w-[200px]">
              Uploaded files via drag & drop or downloaded files will show here with real-time progress.
            </p>
          </div>
        ) : (
          transfers.map((item) => (
            <TransferCard
              key={item.id}
              item={item}
              onCancel={() => cancelTransfer(item.id)}
            />
          ))
        )}
      </div>
    </div>
  );
};

interface TransferCardProps {
  item: TransferItem;
  onCancel: () => void;
}

const TransferCard: React.FC<TransferCardProps> = ({ item, onCancel }) => {
  const percentage = Math.min(
    100,
    Math.round((item.transferred_bytes / (item.total_bytes || 1)) * 100)
  );

  const isUploading = item.direction === "upload";

  return (
    <div className="p-2.5 rounded-md border border-vscode-border/60 bg-vscode-bg/40 flex flex-col gap-1.5 group">
      {/* Title & Direction */}
      <div className="flex items-center justify-between gap-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {isUploading ? (
            <span className="p-1 rounded bg-blue-500/10 text-blue-400 flex-shrink-0">
              <ArrowUpRight className="w-3.5 h-3.5" />
            </span>
          ) : (
            <span className="p-1 rounded bg-emerald-500/10 text-emerald-400 flex-shrink-0">
              <ArrowDownLeft className="w-3.5 h-3.5" />
            </span>
          )}
          <span className="truncate font-medium text-vscode-textBright text-xs" title={item.filename}>
            {item.filename}
          </span>
        </div>

        {/* Cancel button if active */}
        {(item.status === "pending" || item.status === "transferring") && (
          <button
            onClick={onCancel}
            title="Cancel Transfer"
            className="p-1 rounded text-vscode-textMuted hover:text-red-400 hover:bg-vscode-hover transition-colors flex-shrink-0"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Progress Bar */}
      <div className="w-full h-1.5 bg-vscode-border/50 rounded-full overflow-hidden">
        <div
          style={{ width: `${percentage}%` }}
          className={`h-full transition-all duration-150 ${
            item.status === "completed"
              ? "bg-emerald-500"
              : item.status === "failed"
              ? "bg-red-500"
              : item.status === "cancelled"
              ? "bg-amber-500"
              : "bg-vscode-activityBarActive"
          }`}
        />
      </div>

      {/* Stats Footer */}
      <div className="flex items-center justify-between text-[10px] text-vscode-textMuted font-mono">
        <span>
          {formatBytes(item.transferred_bytes)} / {formatBytes(item.total_bytes)}
        </span>

        <div className="flex items-center gap-1.5">
          {item.status === "transferring" && (
            <span className="text-blue-400 font-sans">
              {formatBytes(item.speed_bps)}/s
            </span>
          )}

          {item.status === "completed" && (
            <span className="flex items-center gap-1 text-emerald-400 font-sans">
              <CheckCircle2 className="w-3 h-3" />
              Done
            </span>
          )}

          {item.status === "failed" && (
            <span
              className="flex items-center gap-1 text-red-400 font-sans truncate max-w-[90px]"
              title={item.error_message || "Transfer failed"}
            >
              <AlertCircle className="w-3 h-3" />
              Failed
            </span>
          )}

          {item.status === "cancelled" && (
            <span className="flex items-center gap-1 text-amber-400 font-sans">
              <Ban className="w-3 h-3" />
              Cancelled
            </span>
          )}

          {item.status === "pending" && (
            <span className="flex items-center gap-1 text-vscode-textMuted font-sans">
              <Clock className="w-3 h-3" />
              Pending
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
