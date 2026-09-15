import { create } from "zustand";
import { getServerOverview, type ServerOverview, formatErrorMessage } from "../utils/tauriBridge";

interface ServerOverviewState {
  overview: ServerOverview | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
  currentServerId: string | null;

  // Modal & Mobile bar state
  isModalOpen: boolean;
  isMobileMicroBarVisible: boolean;

  setIsModalOpen: (open: boolean) => void;
  toggleModal: () => void;
  setMobileMicroBarVisible: (visible: boolean) => void;

  fetchOverview: (serverId: string, silent?: boolean) => Promise<void>;
  startPolling: (serverId: string) => void;
  stopPolling: () => void;
  reset: () => void;
}

let pollTimer: ReturnType<typeof setInterval> | null = null;
let activePollingServerId: string | null = null;
let visibilityHandlerAttached = false;

export const useServerOverviewStore = create<ServerOverviewState>((set, get) => {
  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible" && activePollingServerId) {
      // Immediately refresh when user resumes tab / foreground
      get().fetchOverview(activePollingServerId, true);
    }
  };

  if (typeof document !== "undefined" && !visibilityHandlerAttached) {
    document.addEventListener("visibilitychange", handleVisibilityChange);
    visibilityHandlerAttached = true;
  }

  return {
    overview: null,
    isLoading: false,
    error: null,
    lastUpdated: null,
    currentServerId: null,

    isModalOpen: false,
    isMobileMicroBarVisible: true,

    setIsModalOpen: (open: boolean) => set({ isModalOpen: open }),
    toggleModal: () => set((state) => ({ isModalOpen: !state.isModalOpen })),
    setMobileMicroBarVisible: (visible: boolean) => set({ isMobileMicroBarVisible: visible }),

    fetchOverview: async (serverId: string, silent = false) => {
      if (!serverId) return;
      if (!silent) {
        set({ isLoading: true, error: null });
      }

      try {
        const data = await getServerOverview(serverId);
        set({
          overview: data,
          isLoading: false,
          error: null,
          lastUpdated: Date.now(),
          currentServerId: serverId,
        });
      } catch (err) {
        const msg = formatErrorMessage(err);
        console.warn(`[ServerOverview] Failed to fetch overview for ${serverId}:`, msg);
        set({
          isLoading: false,
          error: msg,
        });
      }
    },

    startPolling: (serverId: string) => {
      if (!serverId) {
        get().stopPolling();
        return;
      }

      if (activePollingServerId === serverId && pollTimer) {
        // Already polling this server
        return;
      }

      get().stopPolling();
      activePollingServerId = serverId;
      set({ currentServerId: serverId });

      // Immediate initial fetch
      get().fetchOverview(serverId, false);

      // Setup 5s polling interval
      pollTimer = setInterval(() => {
        // Skip background tick if document is hidden to conserve mobile battery and SSH bandwidth
        if (typeof document !== "undefined" && document.visibilityState === "hidden") {
          return;
        }
        if (activePollingServerId) {
          get().fetchOverview(activePollingServerId, true);
        }
      }, 5000);
    },

    stopPolling: () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      activePollingServerId = null;
    },

    reset: () => {
      get().stopPolling();
      set({
        overview: null,
        isLoading: false,
        error: null,
        lastUpdated: null,
        currentServerId: null,
        isModalOpen: false,
      });
    },
  };
});
