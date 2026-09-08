import { create } from "zustand";
import { getSshKeys, saveSshKey, deleteSshKey, type SshKey } from "../utils/tauriBridge";

interface SshKeyState {
  keys: SshKey[];
  isLoading: boolean;
  loadKeys: () => Promise<void>;
  saveKey: (key: SshKey) => Promise<void>;
  deleteKey: (id: string) => Promise<void>;
}

export const useSshKeyStore = create<SshKeyState>((set, get) => ({
  keys: [],
  isLoading: false,

  loadKeys: async () => {
    set({ isLoading: true });
    try {
      const keys = await getSshKeys();
      set({ keys, isLoading: false });
    } catch (err) {
      console.error("Failed to load SSH keys:", err);
      set({ isLoading: false });
    }
  },

  saveKey: async (key: SshKey) => {
    await saveSshKey(key);
    await get().loadKeys();
  },

  deleteKey: async (id: string) => {
    await deleteSshKey(id);
    await get().loadKeys();
  },
}));
