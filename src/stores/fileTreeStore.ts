import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  is_symlink: boolean;
  size: number;
  mtime: number;
}

interface FileTreeState {
  currentServerId: string | null;
  rootPath: string | null;
  tree: Record<string, FileEntry[]>;
  expandedPaths: string[];
  selectedPath: string | null;
  loadingPaths: string[];

  setRoot: (serverId: string, rootPath: string) => Promise<void>;
  loadDirectory: (dirPath: string) => Promise<void>;
  toggleExpand: (dirPath: string) => Promise<void>;
  collapseAll: () => void;
  setSelectedPath: (path: string | null) => void;
  createFile: (parentPath: string, name: string) => Promise<void>;
  createDir: (parentPath: string, name: string) => Promise<void>;
  renameItem: (oldPath: string, newName: string) => Promise<void>;
  deleteItem: (path: string, isDir: boolean) => Promise<void>;
  refreshPath: (path: string) => Promise<void>;
}

export const useFileTreeStore = create<FileTreeState>((set, get) => ({
  currentServerId: null,
  rootPath: null,
  tree: {},
  expandedPaths: [],
  selectedPath: null,
  loadingPaths: [],

  setRoot: async (serverId: string, rootPath: string) => {
    set({
      currentServerId: serverId,
      rootPath,
      tree: {},
      expandedPaths: [rootPath],
      selectedPath: null,
      loadingPaths: [rootPath],
    });
    await get().loadDirectory(rootPath);
  },

  loadDirectory: async (dirPath: string) => {
    const { currentServerId } = get();
    if (!currentServerId) return;

    set((state) => ({
      loadingPaths: Array.from(new Set([...state.loadingPaths, dirPath])),
    }));

    try {
      const entries = await invoke<FileEntry[]>("sftp_read_dir", {
        serverId: currentServerId,
        path: dirPath,
      });

      set((state) => ({
        tree: { ...state.tree, [dirPath]: entries },
        loadingPaths: state.loadingPaths.filter((p) => p !== dirPath),
      }));
    } catch (err) {
      console.error(`Failed to read directory ${dirPath}:`, err);
      set((state) => ({
        loadingPaths: state.loadingPaths.filter((p) => p !== dirPath),
      }));
    }
  },

  toggleExpand: async (dirPath: string) => {
    const { expandedPaths, tree } = get();
    const isExpanded = expandedPaths.includes(dirPath);

    if (isExpanded) {
      set({
        expandedPaths: expandedPaths.filter((p) => p !== dirPath && !p.startsWith(`${dirPath}/`)),
      });
    } else {
      set({ expandedPaths: [...expandedPaths, dirPath] });
      // If not loaded yet, fetch from server
      if (!tree[dirPath]) {
        await get().loadDirectory(dirPath);
      }
    }
  },

  collapseAll: () => {
    const { rootPath } = get();
    set({ expandedPaths: rootPath ? [rootPath] : [] });
  },

  setSelectedPath: (path: string | null) => {
    set({ selectedPath: path });
  },

  createFile: async (parentPath: string, name: string) => {
    const { currentServerId } = get();
    if (!currentServerId) return;

    const cleanParent = parentPath.replace(/\/+$/, "");
    const fullPath = `${cleanParent}/${name}`;

    await invoke("sftp_create_file", {
      serverId: currentServerId,
      path: fullPath,
    });

    await get().loadDirectory(parentPath);
    set((state) => ({
      expandedPaths: Array.from(new Set([...state.expandedPaths, parentPath])),
      selectedPath: fullPath,
    }));
  },

  createDir: async (parentPath: string, name: string) => {
    const { currentServerId } = get();
    if (!currentServerId) return;

    const cleanParent = parentPath.replace(/\/+$/, "");
    const fullPath = `${cleanParent}/${name}`;

    await invoke("sftp_create_dir", {
      serverId: currentServerId,
      path: fullPath,
    });

    await get().loadDirectory(parentPath);
    set((state) => ({
      expandedPaths: Array.from(new Set([...state.expandedPaths, parentPath])),
      selectedPath: fullPath,
    }));
  },

  renameItem: async (oldPath: string, newName: string) => {
    const { currentServerId, rootPath } = get();
    if (!currentServerId) return;

    const parts = oldPath.split("/");
    parts.pop();
    const parentPath = parts.join("/") || rootPath || "/";
    const newPath = `${parentPath.replace(/\/+$/, "")}/${newName}`;

    await invoke("sftp_rename", {
      serverId: currentServerId,
      oldPath,
      newPath,
    });

    await get().loadDirectory(parentPath);
  },

  deleteItem: async (path: string, isDir: boolean) => {
    const { currentServerId, rootPath, selectedPath } = get();
    if (!currentServerId) return;

    const parts = path.split("/");
    parts.pop();
    const parentPath = parts.join("/") || rootPath || "/";

    await invoke("sftp_remove", {
      serverId: currentServerId,
      path,
      isDir,
    });

    if (selectedPath === path) {
      set({ selectedPath: null });
    }

    await get().loadDirectory(parentPath);
  },

  refreshPath: async (path: string) => {
    await get().loadDirectory(path);
  },
}));
