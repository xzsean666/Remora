import React, { useState } from "react";
import {
  FilePlus,
  FolderPlus,
  RefreshCw,
  FoldHorizontal,
  FolderTree,
} from "lucide-react";
import { useFileTreeStore } from "../../../stores/fileTreeStore";
import { FileTreeNode } from "./FileTreeNode";
import { NewItemInput } from "./NewItemInput";
import { ContextMenu } from "../ContextMenu";

interface ProjectExplorerProps {
  onOpenFile?: (path: string, isPreview?: boolean) => void;
}

export const ProjectExplorer: React.FC<ProjectExplorerProps> = ({ onOpenFile }) => {
  const {
    rootPath,
    tree,
    collapseAll,
    createFile,
    createDir,
    refreshPath,
  } = useFileTreeStore();

  const [creatingType, setCreatingType] = useState<"file" | "dir" | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);

  if (!rootPath) {
    return (
      <div className="p-4 text-center text-vscode-textMuted flex flex-col items-center justify-center gap-3 mt-8">
        <FolderTree className="w-10 h-10 opacity-30 text-vscode-textBright" />
        <p className="text-xs font-medium text-vscode-textBright">No Folder Opened</p>
        <p className="text-[11px] text-vscode-textMuted leading-relaxed">
          You have not opened a workspace folder yet. Connect to a remote server to explore files.
        </p>
      </div>
    );
  }

  const rootEntries = tree[rootPath] || [];
  const rootName = rootPath.split("/").filter(Boolean).pop() || rootPath;

  const handleRootContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden select-none">
      {/* Explorer Section Title & Actions Header */}
      <div className="h-7 px-3 bg-vscode-sidebar/90 border-b border-vscode-border/40 flex items-center justify-between text-[11px] font-bold text-vscode-textBright uppercase group">
        <span
          onContextMenu={handleRootContextMenu}
          className="truncate cursor-pointer hover:underline"
          title={rootPath}
        >
          {rootName}
        </span>

        {/* Action icons */}
        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
          <button
            title="New File in Root"
            onClick={() => setCreatingType("file")}
            className="p-1 hover:text-white hover:bg-vscode-hover rounded"
          >
            <FilePlus className="w-3.5 h-3.5" />
          </button>
          <button
            title="New Folder in Root"
            onClick={() => setCreatingType("dir")}
            className="p-1 hover:text-white hover:bg-vscode-hover rounded"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
          <button
            title="Refresh Explorer"
            onClick={() => refreshPath(rootPath)}
            className="p-1 hover:text-white hover:bg-vscode-hover rounded"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            title="Collapse All Folders"
            onClick={collapseAll}
            className="p-1 hover:text-white hover:bg-vscode-hover rounded"
          >
            <FoldHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tree Content */}
      <div
        onContextMenu={handleRootContextMenu}
        className="flex-1 overflow-y-auto overflow-x-hidden py-1"
      >
        {/* Creating new item in root */}
        {creatingType && (
          <div className="h-6 flex items-center px-3">
            <NewItemInput
              onConfirm={async (name) => {
                const type = creatingType;
                setCreatingType(null);
                if (type === "file") {
                  await createFile(rootPath, name);
                } else {
                  await createDir(rootPath, name);
                }
              }}
              onCancel={() => setCreatingType(null)}
            />
          </div>
        )}

        {rootEntries.map((entry) => (
          <FileTreeNode
            key={entry.path}
            entry={entry}
            level={0}
            onOpenFile={onOpenFile}
          />
        ))}

        {rootEntries.length === 0 && !creatingType && (
          <div className="px-3 py-4 text-center text-xs text-vscode-textMuted/60 italic">
            Directory is empty
          </div>
        )}
      </div>

      {/* Root Context Menu */}
      {contextMenuPos && (
        <ContextMenu
          x={contextMenuPos.x}
          y={contextMenuPos.y}
          isDir={true}
          onClose={() => setContextMenuPos(null)}
          onNewFile={() => setCreatingType("file")}
          onNewFolder={() => setCreatingType("dir")}
          onRefresh={() => refreshPath(rootPath)}
          onCopyPath={() => navigator.clipboard.writeText(rootPath)}
        />
      )}
    </div>
  );
};
