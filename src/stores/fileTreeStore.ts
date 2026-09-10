import { create } from "zustand";
import { safeInvoke as invoke, formatErrorMessage } from "../utils/tauriBridge";

export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  is_symlink: boolean;
  size: number;
  mtime: number;
}

export interface RecentProject {
  id: string;
  server_id: string;
  server_name: string;
  project_name: string;
  remote_path: string;
  last_opened_at: number;
}

interface FileTreeState {
  currentServerId: string | null;
  rootPath: string | null;
  serverRoots: Record<string, string>;
  recentProjects: RecentProject[];
  tree: Record<string, FileEntry[]>;
  expandedPaths: string[];
  selectedPath: string | null;
  loadingPaths: string[];
  dirErrors: Record<string, string>;
  dragOverPath: string | null;
  deleteTarget: { path: string; name: string; isDir: boolean } | null;

  setRoot: (serverId: string, rootPath: string, serverName?: string) => Promise<void>;
  switchServer: (serverId: string | null) => Promise<void>;
  closeWorkspace: () => void;
  loadRecentProjects: () => Promise<void>;
  removeRecentProject: (id: string) => Promise<void>;
  loadDirectory: (dirPath: string) => Promise<void>;
  toggleExpand: (dirPath: string) => Promise<void>;
  collapseAll: () => void;
  setSelectedPath: (path: string | null) => void;
  setDragOverPath: (path: string | null) => void;
  requestDelete: (path: string, name: string, isDir: boolean) => void;
  cancelDelete: () => void;
  confirmDelete: (permanent: boolean) => Promise<void>;
  checkFileExists: (serverId: string, remotePath: string) => Promise<boolean>;
  moveItem: (oldPath: string, targetDir: string, newName?: string, overwrite?: boolean) => Promise<void>;
  createFile: (parentPath: string, name: string) => Promise<void>;
  createDir: (parentPath: string, name: string) => Promise<void>;
  renameItem: (oldPath: string, newName: string) => Promise<void>;
  deleteItem: (path: string, isDir: boolean, permanent?: boolean) => Promise<void>;
  refreshPath: (path: string) => Promise<void>;
}

export const useFileTreeStore = create<FileTreeState>((set, get) => ({
  currentServerId: null,
  rootPath: null,
  serverRoots: {},
  recentProjects: [],
  tree: {},
  expandedPaths: [],
  selectedPath: null,
  loadingPaths: [],
  dirErrors: {},
  dragOverPath: null,
  deleteTarget: null,

  loadRecentProjects: async () => {
    try {
      const res = await invoke<RecentProject[]>("get_recent_projects", { limit: 50 });
      set({ recentProjects: res || [] });
    } catch (e) {
      console.warn("Failed to load recent projects:", e);
    }
  },

  removeRecentProject: async (id: string) => {
    try {
      await invoke("remove_recent_project", { id });
      set((state) => ({
        recentProjects: state.recentProjects.filter((p) => p.id !== id),
      }));
    } catch (e) {
      console.error("Failed to remove recent project:", e);
    }
  },

  setRoot: async (serverId: string, rootPath: string, serverName?: string) => {
    // Normalize path (remove trailing slash unless root '/')
    const cleanPath = rootPath.length > 1 && rootPath.endsWith("/") ? rootPath.slice(0, -1) : rootPath;
    const projectName = cleanPath.split("/").filter(Boolean).pop() || cleanPath;

    set((state) => ({
      currentServerId: serverId,
      rootPath: cleanPath,
      serverRoots: { ...state.serverRoots, [serverId]: cleanPath },
      tree: {},
      expandedPaths: [cleanPath],
      selectedPath: null,
      loadingPaths: [cleanPath],
      dirErrors: {},
    }));

    // Record into SQLite recent_projects
    try {
      await invoke("add_recent_project", {
        project: {
          id: `${serverId}:${cleanPath}`,
          server_id: serverId,
          server_name: serverName || serverId,
          project_name: projectName,
          remote_path: cleanPath,
          last_opened_at: Date.now(),
        },
      });
      await get().loadRecentProjects();
    } catch (e) {
      console.warn("Failed to record recent project:", e);
    }

    await get().loadDirectory(cleanPath);
  },

  switchServer: async (serverId: string | null) => {
    if (!serverId) {
      set({
        currentServerId: null,
        rootPath: null,
        tree: {},
        expandedPaths: [],
        selectedPath: null,
        loadingPaths: [],
        dirErrors: {},
      });
      return;
    }

    const { serverRoots } = get();
    const existingRoot = serverRoots[serverId];

    if (existingRoot) {
      set({
        currentServerId: serverId,
        rootPath: existingRoot,
        tree: {},
        expandedPaths: [existingRoot],
        selectedPath: null,
        loadingPaths: [existingRoot],
        dirErrors: {},
      });
      await get().loadDirectory(existingRoot);
    } else {
      set({
        currentServerId: serverId,
        rootPath: null,
        tree: {},
        expandedPaths: [],
        selectedPath: null,
        loadingPaths: [],
        dirErrors: {},
      });
    }
  },

  closeWorkspace: () => {
    const { currentServerId, serverRoots } = get();
    const updatedRoots = { ...serverRoots };
    if (currentServerId) {
      delete updatedRoots[currentServerId];
    }
    set({
      rootPath: null,
      serverRoots: updatedRoots,
      tree: {},
      expandedPaths: [],
      selectedPath: null,
      loadingPaths: [],
      dirErrors: {},
    });
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

      set((state) => {
        const nextErrors = { ...state.dirErrors };
        delete nextErrors[dirPath];
        return {
          tree: { ...state.tree, [dirPath]: entries },
          loadingPaths: state.loadingPaths.filter((p) => p !== dirPath),
          dirErrors: nextErrors,
        };
      });
    } catch (err) {
      console.error(`Failed to read directory ${dirPath}:`, err);
      const errMsg = formatErrorMessage(err).replace(/^Error:\s*/, "");
      set((state) => ({
        loadingPaths: state.loadingPaths.filter((p) => p !== dirPath),
        dirErrors: { ...state.dirErrors, [dirPath]: errMsg },
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

  setDragOverPath: (path: string | null) => {
    set({ dragOverPath: path });
  },

  checkFileExists: async (serverId: string, remotePath: string): Promise<boolean> => {
    try {
      await invoke("sftp_stat", { serverId, path: remotePath });
      return true;
    } catch {
      const parts = remotePath.split("/");
      const filename = parts.pop();
      const parent = parts.join("/") || "/";
      const entries = get().tree[parent];
      if (entries && filename) {
        return entries.some((e) => e.name === filename);
      }
      return false;
    }
  },

  moveItem: async (oldPath: string, targetDir: string, newName?: string, overwrite?: boolean) => {
    const { currentServerId, rootPath } = get();
    if (!currentServerId) return;

    const parts = oldPath.split("/");
    const oldName = parts.pop() || "";
    const sourceParent = parts.join("/") || rootPath || "/";
    const cleanTargetDir = targetDir.replace(/\/+$/, "");
    const finalName = newName || oldName;
    const destPath = `${cleanTargetDir}/${finalName}`;

    if (oldPath === destPath) return;

    if (overwrite) {
      try {
        await invoke("sftp_remove", {
          serverId: currentServerId,
          path: destPath,
          isDir: false,
        });
      } catch (e) {
        console.warn("Failed to remove existing file before overwrite:", e);
      }
    }

    await invoke("sftp_rename", {
      serverId: currentServerId,
      oldPath,
      newPath: destPath,
    });

    await get().loadDirectory(sourceParent);
    if (sourceParent !== cleanTargetDir) {
      await get().loadDirectory(cleanTargetDir);
    }
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

  requestDelete: (path: string, name: string, isDir: boolean) => {
    set({ deleteTarget: { path, name, isDir } });
  },

  cancelDelete: () => {
    set({ deleteTarget: null });
  },

  confirmDelete: async (permanent: boolean) => {
    const { deleteTarget, deleteItem } = get();
    if (!deleteTarget) return;
    const { path, isDir } = deleteTarget;
    set({ deleteTarget: null });
    await deleteItem(path, isDir, permanent);
  },

  deleteItem: async (path: string, isDir: boolean, permanent = false) => {
    const { currentServerId, rootPath, selectedPath } = get();
    if (!currentServerId) return;

    const parts = path.split("/");
    parts.pop();
    const parentPath = parts.join("/") || rootPath || "/";

    if (permanent) {
      await invoke("sftp_remove", {
        serverId: currentServerId,
        path,
        isDir,
      });
    } else {
      await invoke("sftp_trash", {
        serverId: currentServerId,
        path,
      });
    }

    if (selectedPath === path) {
      set({ selectedPath: null });
    }

    await get().loadDirectory(parentPath);
  },

  refreshPath: async (path: string) => {
    await get().loadDirectory(path);
  },
}));
