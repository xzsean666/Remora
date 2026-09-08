import { create } from "zustand";
import { safeInvoke as invoke } from "../utils/tauriBridge";

export type SidebarTab = "explorer" | "servers" | "snippets" | "transfers" | "settings";

interface LayoutPreferences {
  sidebar_width?: number;
  terminal_height?: number;
  sidebar_visible?: boolean;
  terminal_visible?: boolean;
  active_sidebar_tab?: string;
}

interface LayoutState {
  sidebarWidth: number;
  terminalHeight: number;
  isSidebarOpen: boolean;
  isTerminalOpen: boolean;
  activeSidebarTab: SidebarTab;

  setSidebarWidth: (width: number) => void;
  setTerminalHeight: (height: number) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleTerminal: () => void;
  setTerminalOpen: (open: boolean) => void;
  setActiveSidebarTab: (tab: SidebarTab) => void;
  toggleSidebarTab: (tab: SidebarTab) => void;
  resetLayout: () => void;
  initFromPreferences: () => Promise<void>;
  persistPreferences: () => Promise<void>;
}

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

export const useLayoutStore = create<LayoutState>((set, get) => ({
  sidebarWidth: 260,
  terminalHeight: 240,
  isSidebarOpen: true,
  isTerminalOpen: true,
  activeSidebarTab: "explorer",

  setSidebarWidth: (width: number) => {
    const maxWidth = typeof window !== "undefined" ? Math.max(260, Math.min(600, window.innerWidth - 300)) : 600;
    const clamped = Math.max(160, Math.min(maxWidth, width));
    set({ sidebarWidth: clamped });
    get().persistPreferences();
  },

  setTerminalHeight: (height: number) => {
    const maxHeight = typeof window !== "undefined" ? Math.max(160, Math.min(600, window.innerHeight - 160)) : 600;
    const clamped = Math.max(100, Math.min(maxHeight, height));
    set({ terminalHeight: clamped });
    get().persistPreferences();
  },

  resetLayout: () => {
    set({
      sidebarWidth: 260,
      terminalHeight: 240,
      isSidebarOpen: true,
      isTerminalOpen: true,
    });
    get().persistPreferences();
  },

  toggleSidebar: () => {
    set((state) => ({ isSidebarOpen: !state.isSidebarOpen }));
    get().persistPreferences();
  },

  setSidebarOpen: (open: boolean) => {
    set({ isSidebarOpen: open });
    get().persistPreferences();
  },

  toggleTerminal: () => {
    set((state) => ({ isTerminalOpen: !state.isTerminalOpen }));
    get().persistPreferences();
  },

  setTerminalOpen: (open: boolean) => {
    set({ isTerminalOpen: open });
    get().persistPreferences();
  },

  setActiveSidebarTab: (tab: SidebarTab) => {
    // Programmatic tab navigation always ensures sidebar is open
    set({ activeSidebarTab: tab, isSidebarOpen: true });
    get().persistPreferences();
  },

  toggleSidebarTab: (tab: SidebarTab) => {
    // ActivityBar icon click toggles sidebar if clicking the already open active tab
    const { activeSidebarTab, isSidebarOpen } = get();
    if (activeSidebarTab === tab && isSidebarOpen) {
      set({ isSidebarOpen: false });
    } else {
      set({ activeSidebarTab: tab, isSidebarOpen: true });
    }
    get().persistPreferences();
  },

  initFromPreferences: async () => {
    try {
      const prefs = await invoke<LayoutPreferences>("get_layout_preferences");
      if (prefs) {
        set({
          sidebarWidth: prefs.sidebar_width ?? 260,
          terminalHeight: prefs.terminal_height ?? 240,
          isSidebarOpen: prefs.sidebar_visible ?? true,
          isTerminalOpen: prefs.terminal_visible ?? true,
          activeSidebarTab: (prefs.active_sidebar_tab as SidebarTab) ?? "explorer",
        });
      }
    } catch {
      // Running outside Tauri (browser preview or mock)
    }
  },

  persistPreferences: async () => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
      const state = get();
      const payload: LayoutPreferences = {
        sidebar_width: state.sidebarWidth,
        terminal_height: state.terminalHeight,
        sidebar_visible: state.isSidebarOpen,
        terminal_visible: state.isTerminalOpen,
        active_sidebar_tab: state.activeSidebarTab,
      };
      try {
        await invoke("set_layout_preferences", { prefs: payload });
      } catch {
        // Ignore error in non-tauri test environments
      }
    }, 300);
  },
}));
