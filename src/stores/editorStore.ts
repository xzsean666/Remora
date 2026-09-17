import { create } from "zustand";
import {
  safeInvoke as invoke,
  formatErrorMessage,
  isImageFilePath,
  isMarkdownFilePath,
  type ReadBinaryFileResponse,
} from "../utils/tauriBridge";
import { clearEditorCache } from "../utils/editorCache";

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
  targetPosition?: { line: number; ch?: number };
  fileType?: "text" | "image" | "markdown";
  imageDataUrl?: string;
  mimeType?: string;
  fileSize?: number;
  svgSource?: string;
  viewMode?: "preview" | "source" | "split";
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

  openFile: (serverId: string, path: string, isPreview?: boolean, targetPosition?: { line: number; ch?: number }) => Promise<void>;
  closeTab: (path: string) => void;
  closeOtherTabs: (path: string) => void;
  closeAllTabs: () => void;
  setActiveTab: (path: string) => void;
  pinTab: (path: string) => void;
  updateContent: (path: string, content: string) => void;
  toggleSvgViewMode: (path: string) => void;
  setMarkdownViewMode: (path: string, mode: "preview" | "source" | "split") => void;
  toggleMarkdownViewMode: (path: string) => void;
  saveActiveFile: () => Promise<boolean>;
  saveFile: (path: string, forceOverwrite?: boolean) => Promise<boolean>;
  resolveConflict: (action: "overwrite" | "reload" | "cancel") => Promise<void>;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  tabs: [],
  activeTabPath: null,
  loading: false,
  conflictInfo: null,

  openFile: async (serverId: string, path: string, isPreview = false, targetPosition?: { line: number; ch?: number }) => {
    const { tabs } = get();
    const existingIndex = tabs.findIndex((t) => t.path === path);

    // If file is already opened in a tab
    if (existingIndex >= 0) {
      const updatedTabs = [...tabs];
      const existingTab = { ...updatedTabs[existingIndex] };
      if (!isPreview && existingTab.isPreview) {
        // Promote preview tab to permanent tab
        existingTab.isPreview = false;
      }
      if (targetPosition) {
        existingTab.targetPosition = targetPosition;
        if (existingTab.fileType === "markdown") {
          existingTab.viewMode = "source";
        }
      }
      updatedTabs[existingIndex] = existingTab;
      set({ tabs: updatedTabs, activeTabPath: path });
      return;
    }

    set({ loading: true });
    try {
      const isImg = isImageFilePath(path);
      const isMd = isMarkdownFilePath(path);
      const fileName = path.split("/").filter(Boolean).pop() || path;
      let newTab: EditorTab;

      if (isImg) {
        const res = await invoke<ReadBinaryFileResponse>("sftp_read_binary_file", {
          serverId,
          path,
        });
        const dataUrl = `data:${res.mime_type};base64,${res.data_base64}`;
        let svgSource: string | undefined;
        if (res.mime_type.includes("svg") || path.toLowerCase().endsWith(".svg")) {
          try {
            const binString = atob(res.data_base64);
            const bytes = Uint8Array.from(binString, (m) => m.charCodeAt(0));
            svgSource = new TextDecoder().decode(bytes);
          } catch {
            svgSource = undefined;
          }
        }

        newTab = {
          serverId,
          path,
          name: fileName,
          content: svgSource || "",
          savedContent: svgSource || "",
          mtime: res.mtime,
          isDirty: false,
          isPreview,
          targetPosition,
          fileType: "image",
          imageDataUrl: dataUrl,
          mimeType: res.mime_type,
          fileSize: res.size,
          svgSource,
          viewMode: "preview",
        };
      } else if (isMd) {
        const res = await invoke<ReadFileResponse>("sftp_read_file", {
          serverId,
          path,
        });

        newTab = {
          serverId,
          path,
          name: fileName,
          content: res.content,
          savedContent: res.content,
          mtime: res.mtime,
          isDirty: false,
          isPreview,
          targetPosition,
          fileType: "markdown",
          viewMode: targetPosition ? "source" : "preview",
        };
      } else {
        const res = await invoke<ReadFileResponse>("sftp_read_file", {
          serverId,
          path,
        });

        newTab = {
          serverId,
          path,
          name: fileName,
          content: res.content,
          savedContent: res.content,
          mtime: res.mtime,
          isDirty: false,
          isPreview,
          targetPosition,
          fileType: "text",
        };
      }

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

  toggleSvgViewMode: (path: string) => {
    const { tabs } = get();
    const idx = tabs.findIndex((t) => t.path === path);
    if (idx === -1) return;
    const tab = tabs[idx];
    const newMode = tab.viewMode === "source" ? "preview" : "source";
    const updatedTabs = [...tabs];
    updatedTabs[idx] = { ...tab, viewMode: newMode };
    set({ tabs: updatedTabs });
  },

  setMarkdownViewMode: (path: string, mode: "preview" | "source" | "split") => {
    const { tabs } = get();
    const idx = tabs.findIndex((t) => t.path === path);
    if (idx === -1) return;
    const tab = tabs[idx];
    const updatedTabs = [...tabs];
    updatedTabs[idx] = { ...tab, viewMode: mode };
    set({ tabs: updatedTabs });
  },

  toggleMarkdownViewMode: (path: string) => {
    const { tabs } = get();
    const idx = tabs.findIndex((t) => t.path === path);
    if (idx === -1) return;
    const tab = tabs[idx];
    const newMode = tab.viewMode === "preview" ? "source" : "preview";
    const updatedTabs = [...tabs];
    updatedTabs[idx] = { ...tab, viewMode: newMode };
    set({ tabs: updatedTabs });
  },

  closeTab: (path: string) => {
    const { tabs, activeTabPath } = get();
    const tabIndex = tabs.findIndex((t) => t.path === path);
    if (tabIndex === -1) return;

    clearEditorCache(path);

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
    tabs.forEach((t) => {
      if (t.path !== path) {
        clearEditorCache(t.path);
      }
    });
    const remaining = tabs.filter((t) => t.path === path);
    set({ tabs: remaining, activeTabPath: path });
  },

  closeAllTabs: () => {
    clearEditorCache();
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
          tabs: state.tabs.map((t) => {
            if (t.path !== path) return t;
            let updatedImageDataUrl = t.imageDataUrl;
            if (t.fileType === "image" && t.mimeType?.includes("svg")) {
              try {
                const bytes = new TextEncoder().encode(t.content);
                let binStr = "";
                for (let i = 0; i < bytes.length; i++) {
                  binStr += String.fromCharCode(bytes[i]);
                }
                updatedImageDataUrl = `data:image/svg+xml;base64,${btoa(binStr)}`;
              } catch {}
            }
            return {
              ...t,
              savedContent: t.content,
              imageDataUrl: updatedImageDataUrl,
              svgSource: t.content,
              mtime: res.new_mtime,
              isDirty: false,
            };
          }),
          conflictInfo: null,
        }));
        return true;
      }
      return false;
    } catch (err: unknown) {
      const errorMessage = formatErrorMessage(err);
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
