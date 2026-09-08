import React, { useState } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { FileEntry, useFileTreeStore } from "../../../stores/fileTreeStore";
import { useTransferStore } from "../../../stores/transferStore";
import { getFileIcon } from "../../../utils/fileIcons";
import { NewItemInput } from "./NewItemInput";
import { ContextMenu } from "../ContextMenu";

interface FileTreeNodeProps {
  entry: FileEntry;
  level?: number;
  onOpenFile?: (path: string, isPreview?: boolean) => void;
}

export const FileTreeNode: React.FC<FileTreeNodeProps> = ({
  entry,
  level = 0,
  onOpenFile,
}) => {
  const {
    tree,
    expandedPaths,
    selectedPath,
    loadingPaths,
    toggleExpand,
    setSelectedPath,
    createFile,
    createDir,
    renameItem,
    deleteItem,
    refreshPath,
    currentServerId,
  } = useFileTreeStore();
  const { downloadFile } = useTransferStore();

  const isExpanded = expandedPaths.includes(entry.path);
  const isSelected = selectedPath === entry.path;
  const isLoading = loadingPaths.includes(entry.path);
  const children = tree[entry.path] || [];

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

  return (
    <div className="flex flex-col select-none text-xs">
      {/* Node Row */}
      <div
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        style={{ paddingLeft: `${Math.max(6, level * 14 + 6)}px` }}
        className={`h-6 flex items-center pr-2 cursor-pointer transition-colors group relative ${
          isSelected
            ? "bg-vscode-selected text-white"
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
        <span className="mr-1.5 flex items-center">
          {getFileIcon(entry.name, entry.is_dir, isExpanded)}
        </span>

        {/* Node Name or Rename Input */}
        {isRenaming ? (
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
        ) : (
          <span className="truncate flex-1 tracking-tight font-sans">{entry.name}</span>
        )}
      </div>

      {/* Children or New Item Input when expanded */}
      {entry.is_dir && isExpanded && (
        <div className="flex flex-col">
          {creatingType && (
            <div
              style={{ paddingLeft: `${(level + 1) * 14 + 6}px` }}
              className="h-6 flex items-center pr-2"
            >
              <span className="w-4 mr-0.5 flex-shrink-0" />
              <span className="mr-1.5 flex items-center">
                {getFileIcon("new", creatingType === "dir", false)}
              </span>
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
          )}

          {children.map((child) => (
            <FileTreeNode
              key={child.path}
              entry={child}
              level={level + 1}
              onOpenFile={onOpenFile}
            />
          ))}

          {children.length === 0 && !isLoading && !creatingType && (
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
          onDelete={() => deleteItem(entry.path, entry.is_dir)}
          onRefresh={entry.is_dir ? () => refreshPath(entry.path) : undefined}
          onCopyPath={() => navigator.clipboard.writeText(entry.path)}
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
