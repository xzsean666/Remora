import React, { useState } from "react";
import { ChevronDown, ChevronRight, Loader2, AlertCircle, RotateCw } from "lucide-react";
import { FileEntry, useFileTreeStore } from "../../../stores/fileTreeStore";
import { useTransferStore } from "../../../stores/transferStore";
import { useGitStore } from "../../../stores/gitStore";
import { useTerminalStore } from "../../../stores/terminalStore";
import { useLayoutStore } from "../../../stores/layoutStore";
import { getFileIcon } from "../../../utils/fileIcons";
import { NewItemInput } from "./NewItemInput";
import { ContextMenu } from "../ContextMenu";

interface FileTreeNodeProps {
  entry: FileEntry;
  level?: number;
  onOpenFile?: (path: string, isPreview?: boolean) => void;
  onInternalDrop?: (e: React.DragEvent, targetDir: string) => void;
  filterQuery?: string;
}

function hasMatchingChild(
  dirPath: string,
  query: string,
  tree: Record<string, FileEntry[]>
): boolean {
  const children = tree[dirPath] || [];
  for (const child of children) {
    if (child.name.toLowerCase().includes(query)) return true;
    if (child.is_dir && hasMatchingChild(child.path, query, tree)) return true;
  }
  return false;
}

export const FileTreeNode: React.FC<FileTreeNodeProps> = ({
  entry,
  level = 0,
  onOpenFile,
  onInternalDrop,
  filterQuery = "",
}) => {
  const {
    tree,
    rootPath,
    expandedPaths,
    selectedPath,
    loadingPaths,
    dirErrors,
    dragOverPath,
    setDragOverPath,
    toggleExpand,
    setSelectedPath,
    createFile,
    createDir,
    renameItem,
    requestDelete,
    refreshPath,
    currentServerId,
  } = useFileTreeStore();
  const { downloadFile } = useTransferStore();

  const changes = useGitStore((s) => s.changes);
  const ignored = useGitStore((s) => s.ignored);
  const isRepo = useGitStore((s) => s.isRepo);

  const cleanQuery = (filterQuery || "").trim().toLowerCase();
  const nameMatches = !cleanQuery || entry.name.toLowerCase().includes(cleanQuery);
  const childMatches = entry.is_dir && cleanQuery ? hasMatchingChild(entry.path, cleanQuery, tree) : false;

  if (cleanQuery && !nameMatches && !childMatches) {
    return null;
  }

  const isExpanded = cleanQuery
    ? (childMatches || expandedPaths.includes(entry.path))
    : expandedPaths.includes(entry.path);

  const isSelected = selectedPath === entry.path;
  const isLoading = loadingPaths.includes(entry.path);
  const isDragOver = entry.is_dir && dragOverPath === entry.path;
  const children = tree[entry.path] || [];
  const nodeError = entry.is_dir ? dirErrors[entry.path] : null;

  const parentPath = entry.path.substring(0, entry.path.lastIndexOf("/")) || "/";

  // Calculate relative path for Git & .gitignore matching
  const relPath = rootPath && entry.path.startsWith(rootPath)
    ? entry.path.slice(rootPath.length).replace(/^\/+/, "")
    : entry.path;

  const isIgnored = isRepo && (
    relPath === ".git" ||
    relPath.startsWith(".git/") ||
    ignored.some((ign) => {
      const cleanIgn = ign.replace(/^\/+/, "").replace(/\/+$/, "");
      return relPath === cleanIgn || relPath.startsWith(cleanIgn + "/");
    })
  );

  const gitChange = isRepo && !isIgnored
    ? changes.find((c) => {
        const cleanChange = c.path.replace(/^\/+/, "").replace(/\/+$/, "");
        if (!entry.is_dir) {
          return relPath === cleanChange;
        } else {
          return cleanChange === relPath || cleanChange.startsWith(relPath + "/");
        }
      })
    : undefined;

  let gitColorClass = "";
  let gitBadge: string | null = null;
  let gitBadgeColor = "";

  if (isIgnored) {
    gitColorClass = "opacity-50 text-vscode-textMuted/70";
  } else if (gitChange) {
    if (gitChange.status === "M") {
      gitColorClass = "text-amber-400";
      gitBadge = "M";
      gitBadgeColor = "text-amber-400";
    } else if (gitChange.status === "U" || gitChange.status === "A") {
      gitColorClass = "text-emerald-400";
      gitBadge = gitChange.status;
      gitBadgeColor = "text-emerald-400";
    } else if (gitChange.status === "D") {
      gitColorClass = "text-rose-400";
      gitBadge = "D";
      gitBadgeColor = "text-rose-400";
    } else if (gitChange.status === "R") {
      gitColorClass = "text-sky-400";
      gitBadge = "R";
      gitBadgeColor = "text-sky-400";
    }
  }

  // Local interaction states
  const [isRenaming, setIsRenaming] = useState(false);
  const [creatingType, setCreatingType] = useState<"file" | "dir" | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPath(entry.path);
    if (!entry.is_dir) {
      onOpenFile?.(entry.path, true);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (entry.is_dir) {
      toggleExpand(entry.path);
    } else {
      onOpenFile?.(entry.path, false);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedPath(entry.path);
    setContextMenuPos({ x: e.clientX, y: e.clientY });
  };

  const handleDragStart = (e: React.DragEvent) => {
    if (isRenaming) return;
    e.dataTransfer.setData(
      "application/remora-entry",
      JSON.stringify({
        path: entry.path,
        name: entry.name,
        is_dir: entry.is_dir,
      })
    );
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    if (entry.is_dir) {
      if (dragOverPath !== entry.path) {
        setDragOverPath(entry.path);
      }
    } else {
      if (dragOverPath !== parentPath) {
        setDragOverPath(parentPath);
      }
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (entry.is_dir && dragOverPath === entry.path) {
      setDragOverPath(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverPath(null);
    const targetDir = entry.is_dir ? entry.path : parentPath;
    onInternalDrop?.(e, targetDir);
  };

  return (
    <div className="flex flex-col select-none text-xs">
      {/* Node Row */}
      <div
        draggable={!isRenaming}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        data-folder-path={entry.is_dir ? entry.path : undefined}
        data-file-path={!entry.is_dir ? entry.path : undefined}
        data-parent-path={parentPath}
        data-is-dir={entry.is_dir ? "true" : "false"}
        style={{ paddingLeft: `${Math.max(6, level * 14 + 6)}px` }}
        className={`h-6 flex items-center pr-2 cursor-pointer transition-all group relative min-w-0 overflow-hidden ${
          isDragOver
            ? "bg-vscode-activityBarActive/25 ring-1 ring-inset ring-vscode-activityBarActive text-white"
            : isSelected
            ? "bg-vscode-selected text-white"
            : isIgnored
            ? "opacity-50 text-vscode-textMuted/70 hover:bg-vscode-hover hover:opacity-80"
            : gitColorClass
            ? `${gitColorClass} hover:bg-vscode-hover hover:brightness-110`
            : "text-vscode-text hover:bg-vscode-hover hover:text-vscode-textBright"
        }`}
      >
        {/* Expand / Loading Icon */}
        {entry.is_dir ? (
          <span
            onClick={(e) => {
              e.stopPropagation();
              toggleExpand(entry.path);
            }}
            className="w-4 h-4 flex items-center justify-center mr-0.5 text-vscode-textMuted hover:text-vscode-textBright flex-shrink-0"
          >
            {isLoading ? (
              <Loader2 className="w-3 h-3 animate-spin text-vscode-activityBarActive" />
            ) : isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </span>
        ) : (
          <span className="w-4 mr-0.5 flex-shrink-0" />
        )}

        {/* File Type Icon */}
        <span className="mr-1.5 flex items-center flex-shrink-0">
          {getFileIcon(entry.name, entry.is_dir, isExpanded)}
        </span>

        {/* Node Name or Rename Input */}
        {isRenaming ? (
          <div className="flex-1 min-w-0">
            <NewItemInput
              initialValue={entry.name}
              onConfirm={async (newName) => {
                setIsRenaming(false);
                if (newName && newName !== entry.name) {
                  await renameItem(entry.path, newName);
                }
              }}
              onCancel={() => setIsRenaming(false)}
            />
          </div>
        ) : (
          <div className="flex-1 min-w-0 flex items-center justify-between gap-1 pr-1">
            <span
              className="truncate tracking-tight font-sans min-w-0"
              title={`${entry.name}${isIgnored ? " [gitignored]" : gitBadge ? ` [git: ${gitBadge}]` : ""}`}
            >
              {entry.name}
            </span>
            {gitBadge && !isIgnored && (
              <span
                className={`text-[10px] font-mono font-bold px-1 rounded bg-vscode-bg/60 flex-shrink-0 ${gitBadgeColor}`}
                title={`Git status: ${gitBadge}`}
              >
                {gitBadge}
              </span>
            )}
            {isIgnored && (
              <span
                className="text-[9px] font-mono opacity-50 flex-shrink-0 select-none text-vscode-textMuted"
                title="Ignored by .gitignore"
              >
                I
              </span>
            )}
          </div>
        )}
      </div>

      {/* Children or New Item Input when expanded */}
      {entry.is_dir && isExpanded && (
        <div className="flex flex-col">
          {creatingType && (
            <div
              style={{ paddingLeft: `${(level + 1) * 14 + 6}px` }}
              className="h-6 flex items-center pr-2 min-w-0 overflow-hidden"
            >
              <span className="w-4 mr-0.5 flex-shrink-0" />
              <span className="mr-1.5 flex items-center flex-shrink-0">
                {getFileIcon("new", creatingType === "dir", false)}
              </span>
              <div className="flex-1 min-w-0">
                <NewItemInput
                  onConfirm={async (name) => {
                    const type = creatingType;
                    setCreatingType(null);
                    if (type === "file") {
                      await createFile(entry.path, name);
                    } else {
                      await createDir(entry.path, name);
                    }
                  }}
                  onCancel={() => setCreatingType(null)}
                />
              </div>
            </div>
          )}

          {children.map((child) => (
            <FileTreeNode
              key={child.path}
              entry={child}
              level={level + 1}
              onOpenFile={onOpenFile}
              onInternalDrop={onInternalDrop}
              filterQuery={filterQuery}
            />
          ))}

          {nodeError && !isLoading && (
            <div
              style={{ paddingLeft: `${(level + 1) * 14 + 8}px` }}
              className="py-1 pr-2 flex items-center justify-between gap-1 text-[11px] text-rose-400 bg-rose-500/10 rounded my-0.5"
            >
              <div className="flex items-center gap-1 min-w-0 flex-1 truncate" title={nodeError}>
                <AlertCircle className="w-3 h-3 flex-shrink-0 text-rose-400" />
                <span className="truncate">{nodeError}</span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  refreshPath(entry.path);
                }}
                className="px-1.5 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[10px] flex items-center gap-1 flex-shrink-0 transition-colors cursor-pointer"
                title="Retry loading directory / 重试加载目录"
              >
                <RotateCw className="w-2.5 h-2.5" />
                <span>Retry</span>
              </button>
            </div>
          )}

          {children.length === 0 && !isLoading && !creatingType && !nodeError && (
            <div
              style={{ paddingLeft: `${(level + 1) * 14 + 10}px` }}
              className="py-1 text-[11px] text-vscode-textMuted/60 italic"
            >
              Empty folder
            </div>
          )}
        </div>
      )}

      {/* Context Menu */}
      {contextMenuPos && (
        <ContextMenu
          x={contextMenuPos.x}
          y={contextMenuPos.y}
          isDir={entry.is_dir}
          onClose={() => setContextMenuPos(null)}
          onNewFile={entry.is_dir ? () => setCreatingType("file") : undefined}
          onNewFolder={entry.is_dir ? () => setCreatingType("dir") : undefined}
          onRename={() => setIsRenaming(true)}
          onDelete={() => requestDelete(entry.path, entry.name, entry.is_dir)}
          onRefresh={entry.is_dir ? () => refreshPath(entry.path) : undefined}
          onCopyPath={() => navigator.clipboard.writeText(entry.path)}
          onCopyRelativePath={() => navigator.clipboard.writeText(relPath)}
          onOpenInTerminal={() => {
            const targetDir = entry.is_dir ? entry.path : parentPath;
            const { activeSessionId, sendDataToActiveTerminal, addSession, sessions } = useTerminalStore.getState();
            useLayoutStore.getState().setTerminalOpen(true);
            if (useLayoutStore.getState().isMobile) {
              useLayoutStore.getState().setMobileTab("terminal");
            }
            if (activeSessionId) {
              sendDataToActiveTerminal(`cd "${targetDir}"\n`);
            } else if (currentServerId) {
              const usedSlots = new Set(sessions.map((s) => s.slotNumber).filter(Boolean));
              let slotNumber = 1;
              while (usedSlots.has(slotNumber)) slotNumber++;

              addSession({
                id: `term-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                title: `${slotNumber}: bash`,
                serverId: currentServerId,
                initialDir: targetDir,
                status: "connecting",
                slotNumber,
              });
            }
          }}
          onDownload={
            !entry.is_dir && currentServerId
              ? () => downloadFile(currentServerId, entry.path, `/tmp/${entry.name}`)
              : undefined
          }
        />
      )}
    </div>
  );
};
