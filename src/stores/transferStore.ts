import { create } from "zustand";
import { safeInvoke as invoke } from "../utils/tauriBridge";
import { listen } from "@tauri-apps/api/event";

export type TransferDirection = "upload" | "download";
export type TransferStatus = "pending" | "transferring" | "completed" | "failed" | "cancelled";

export interface TransferItem {
  id: string;
  server_id: string;
  direction: TransferDirection;
  local_path: string;
  remote_path: string;
  filename: string;
  total_bytes: number;
  transferred_bytes: number;
  status: TransferStatus;
  error_message?: string | null;
  speed_bps: number;
  started_at: number;
  updated_at: number;
}

interface TransferState {
  transfers: TransferItem[];
  fetchTransfers: () => Promise<void>;
  listenProgress: () => Promise<() => void>;
  uploadFile: (serverId: string, localPath: string, remotePath: string) => Promise<string>;
  downloadFile: (serverId: string, remotePath: string, localPath?: string) => Promise<string>;
  cancelTransfer: (taskId: string) => Promise<void>;
  clearCompleted: () => void;
  openDownloadDir: () => Promise<string>;
  showItemInFolder: (path: string) => Promise<void>;
  getDefaultDownloadDir: () => Promise<string>;
}

export const useTransferStore = create<TransferState>((set, get) => ({
  transfers: [],

  fetchTransfers: async () => {
    try {
      const list = await invoke<TransferItem[]>("transfer_list");
      set({ transfers: list });
    } catch (err) {
      console.error("Failed to fetch transfer list:", err);
    }
  },

  listenProgress: async () => {
    const unlisten = await listen<TransferItem>("transfer-progress", (event) => {
      const updatedItem = event.payload;
      set((state) => {
        const index = state.transfers.findIndex((t) => t.id === updatedItem.id);
        if (index >= 0) {
          const newTransfers = [...state.transfers];
          newTransfers[index] = updatedItem;
          return { transfers: newTransfers };
        } else {
          return { transfers: [updatedItem, ...state.transfers] };
        }
      });
    });

    return unlisten;
  },

  uploadFile: async (serverId: string, localPath: string, remotePath: string) => {
    const taskId = await invoke<string>("transfer_upload", {
      serverId,
      localPath,
      remotePath,
    });
    get().fetchTransfers();
    return taskId;
  },

  downloadFile: async (serverId: string, remotePath: string, localPath?: string) => {
    const taskId = await invoke<string>("transfer_download", {
      serverId,
      remotePath,
      localPath: localPath || null,
    });
    get().fetchTransfers();
    return taskId;
  },

  openDownloadDir: async () => {
    try {
      const dir = await invoke<string>("open_download_dir");
      return dir;
    } catch (err) {
      console.error("Failed to open download dir:", err);
      throw err;
    }
  },

  showItemInFolder: async (path: string) => {
    try {
      await invoke("show_item_in_folder", { path });
    } catch (err) {
      console.error("Failed to show item in folder:", err);
      throw err;
    }
  },

  getDefaultDownloadDir: async () => {
    try {
      return await invoke<string>("get_default_download_dir");
    } catch (err) {
      console.error("Failed to get default download dir:", err);
      return "~/Downloads/Remora";
    }
  },

  cancelTransfer: async (taskId: string) => {
    try {
      await invoke("transfer_cancel", { taskId });
      set((state) => ({
        transfers: state.transfers.map((t) =>
          t.id === taskId ? { ...t, status: "cancelled" } : t
        ),
      }));
    } catch (err) {
      console.error("Failed to cancel transfer:", err);
    }
  },

  clearCompleted: () => {
    set((state) => ({
      transfers: state.transfers.filter(
        (t) => t.status === "transferring" || t.status === "pending"
      ),
    }));
  },
}));
