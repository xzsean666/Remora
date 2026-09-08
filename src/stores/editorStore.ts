import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export interface EditorTab {
  serverId: string;
  path: string;
  name: string;
  content: string;
  savedContent: string;
  mtime: number;
  isDirty: boolean;
  isPreview: boolean;
  cursor?: { line: number; ch: number };
}

export interface ConflictInfo {
  serverId: string;
  path: string;
  expectedMtime: number;
  message: string;
}

interface ReadFileResponse {
  content: string;
  mtime: number;
  size: number;
}

interface WriteFileResponse {
  success: boolean;
  new_mtime: number;
}

interface EditorState {
  tabs: EditorTab[];
  activeTabPath: string | null;
  loading: boolean;
  conflictInfo: ConflictInfo | null;

  openFile: (serverId: string, path: string, isPreview?: boolean) => Promise<void>;
  closeTab: (path: string) => void;
  closeOtherTabs: (path: string) => void;
  closeAllTabs: () => void;
  setActiveTab: (path: string) => void;
  pinTab: (path: string) => void;
  updateContent: (path: string, content: string) => void;
  saveActiveFile: () => Promise<boolean>;
  saveFile: (path: string, forceOverwrite?: boolean) => Promise<boolean>;
  resolveConflict: (action: "overwrite" | "reload" | "cancel") => Promise<void>;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  tabs: [],
  activeTabPath: null,
  loading: false,
  conflictInfo: null,

  openFile: async (serverId: string, path: string, isPreview = false) => {
    const { tabs } = get();
    const existingIndex = tabs.findIndex((t) => t.path === path);

    // If file is already opened in a tab
    if (existingIndex >= 0) {
      if (!isPreview && tabs[existingIndex].isPreview) {
        // Promote preview tab to permanent tab
        const updatedTabs = [...tabs];
        updatedTabs[existingIndex] = { ...updatedTabs[existingIndex], isPreview: false };
        set({ tabs: updatedTabs, activeTabPath: path });
      } else {
        set({ activeTabPath: path });
      }
      return;
    }

    set({ loading: true });
    try {
      const res = await invoke<ReadFileResponse>("sftp_read_file", {
        serverId,
        path,
      });

      const fileName = path.split("/").filter(Boolean).pop() || path;
      const newTab: EditorTab = {
        serverId,
        path,
        name: fileName,
        content: res.content,
        savedContent: res.content,
        mtime: res.mtime,
        isDirty: false,
        isPreview,
      };

      const currentTabs = get().tabs;
      let newTabs: EditorTab[];

      if (isPreview) {
        // Replace existing clean preview tab if one exists
        const previewIdx = currentTabs.findIndex((t) => t.isPreview && !t.isDirty);
        if (previewIdx >= 0) {
          newTabs = [...currentTabs];
          newTabs[previewIdx] = newTab;
        } else {
          newTabs = [...currentTabs, newTab];
        }
      } else {
        newTabs = [...currentTabs, newTab];
      }

      set({
        tabs: newTabs,
        activeTabPath: path,
        loading: false,
      });
    } catch (err) {
      console.error("Failed to read file via SFTP:", err);
      set({ loading: false });
    }
  },

  closeTab: (path: string) => {
    const { tabs, activeTabPath } = get();
    const tabIndex = tabs.findIndex((t) => t.path === path);
    if (tabIndex === -1) return;

    const newTabs = tabs.filter((t) => t.path !== path);
    let newActivePath = activeTabPath;

    if (activeTabPath === path) {
      if (newTabs.length === 0) {
        newActivePath = null;
      } else if (tabIndex >= newTabs.length) {
        newActivePath = newTabs[newTabs.length - 1].path;
      } else {
        newActivePath = newTabs[tabIndex].path;
      }
    }

    set({ tabs: newTabs, activeTabPath: newActivePath });
  },

  closeOtherTabs: (path: string) => {
    const { tabs } = get();
    const remaining = tabs.filter((t) => t.path === path);
    set({ tabs: remaining, activeTabPath: path });
  },

  closeAllTabs: () => {
    set({ tabs: [], activeTabPath: null });
  },

  setActiveTab: (path: string) => {
    set({ activeTabPath: path });
  },

  pinTab: (path: string) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.path === path ? { ...t, isPreview: false } : t)),
    }));
  },

  updateContent: (path: string, content: string) => {
    set((state) => ({
      tabs: state.tabs.map((tab) => {
        if (tab.path === path) {
          const isDirty = content !== tab.savedContent;
          // Editing content makes it permanent (not preview)
          return {
            ...tab,
            content,
            isDirty,
            isPreview: isDirty ? false : tab.isPreview,
          };
        }
        return tab;
      }),
    }));
  },

  saveActiveFile: async () => {
    const { activeTabPath, saveFile } = get();
    if (!activeTabPath) return false;
    return saveFile(activeTabPath);
  },

  saveFile: async (path: string, forceOverwrite = false) => {
    const { tabs } = get();
    const tab = tabs.find((t) => t.path === path);
    if (!tab) return false;

    // If not dirty and not forcing overwrite, skip
    if (!tab.isDirty && !forceOverwrite) return true;

    try {
      const res = await invoke<WriteFileResponse>("sftp_write_file", {
        serverId: tab.serverId,
        path: tab.path,
        content: tab.content,
        expectedMtime: forceOverwrite ? null : tab.mtime,
      });

      if (res.success) {
        set((state) => ({
          tabs: state.tabs.map((t) =>
            t.path === path
              ? {
                  ...t,
                  savedContent: t.content,
                  mtime: res.new_mtime,
                  isDirty: false,
                }
              : t
          ),
          conflictInfo: null,
        }));
        return true;
      }
      return false;
    } catch (err: unknown) {
      const errorMessage = typeof err === "string" ? err : (err as Error)?.message || String(err);
      if (errorMessage.includes("Conflict detected")) {
        set({
          conflictInfo: {
            serverId: tab.serverId,
            path: tab.path,
            expectedMtime: tab.mtime,
            message: errorMessage,
          },
        });
      } else {
        console.error("Failed to save file via SFTP:", errorMessage);
      }
      return false;
    }
  },

  resolveConflict: async (action: "overwrite" | "reload" | "cancel") => {
    const { conflictInfo, saveFile, tabs } = get();
    if (!conflictInfo) return;

    if (action === "overwrite") {
      await saveFile(conflictInfo.path, true);
    } else if (action === "reload") {
      try {
        const res = await invoke<ReadFileResponse>("sftp_read_file", {
          serverId: conflictInfo.serverId,
          path: conflictInfo.path,
        });
        set({
          tabs: tabs.map((t) =>
            t.path === conflictInfo.path
              ? {
                  ...t,
                  content: res.content,
                  savedContent: res.content,
                  mtime: res.mtime,
                  isDirty: false,
                }
              : t
          ),
          conflictInfo: null,
        });
      } catch (err) {
        console.error("Failed to reload file after conflict:", err);
      }
    } else {
      set({ conflictInfo: null });
    }
  },
}));
