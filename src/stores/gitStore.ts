import { create } from "zustand";
import { safeInvoke, formatErrorMessage } from "../utils/tauriBridge";
import { useFileTreeStore } from "./fileTreeStore";
import { useConnectionStore } from "./connectionStore";

export interface GitFileChange {
  path: string;
  status: "M" | "A" | "D" | "U" | "R" | string;
  staged: boolean;
  raw_status: string;
}

export interface GitStatusResult {
  is_repo: boolean;
  current_branch: string | null;
  branches: string[];
  changes: GitFileChange[];
  error?: string | null;
}

interface GitState {
  isRepo: boolean;
  currentBranch: string | null;
  branches: string[];
  changes: GitFileChange[];
  loading: boolean;
  error: string | null;
  selectedDiffFile: string | null;
  diffContent: string | null;
  diffLoading: boolean;

  fetchStatus: (serverId?: string, repoPath?: string) => Promise<void>;
  switchBranch: (serverId: string, repoPath: string, branch: string, createNew?: boolean) => Promise<void>;
  fetchDiff: (serverId: string, repoPath: string, filePath: string) => Promise<void>;
  clearDiff: () => void;
}

export const useGitStore = create<GitState>((set, get) => ({
  isRepo: false,
  currentBranch: null,
  branches: [],
  changes: [],
  loading: false,
  error: null,
  selectedDiffFile: null,
  diffContent: null,
  diffLoading: false,

  fetchStatus: async (overrideServerId?: string, overridePath?: string) => {
    const serverId =
      overrideServerId ||
      useConnectionStore.getState().activeServerId ||
      useFileTreeStore.getState().currentServerId;
    const repoPath = overridePath || useFileTreeStore.getState().rootPath;

    if (!serverId || !repoPath) {
      set({ isRepo: false, currentBranch: null, branches: [], changes: [], error: null });
      return;
    }

    set({ loading: true, error: null });
    try {
      const res = await safeInvoke<GitStatusResult>("git_get_status", {
        serverId,
        repoPath,
      });

      set({
        isRepo: res.is_repo,
        currentBranch: res.current_branch,
        branches: res.branches,
        changes: res.changes,
        error: res.error || null,
        loading: false,
      });
    } catch (err: any) {
      set({
        isRepo: false,
        error: formatErrorMessage(err),
        loading: false,
      });
    }
  },

  switchBranch: async (serverId: string, repoPath: string, branch: string, createNew: boolean = false) => {
    set({ loading: true, error: null });
    try {
      await safeInvoke("git_checkout", {
        serverId,
        repoPath,
        branch,
        createNew,
      });
      // Refresh status after branch switch
      await get().fetchStatus(serverId, repoPath);
    } catch (err: any) {
      set({
        error: formatErrorMessage(err) || "切换分支失败",
        loading: false,
      });
      throw err;
    }
  },

  fetchDiff: async (serverId: string, repoPath: string, filePath: string) => {
    set({ selectedDiffFile: filePath, diffLoading: true });
    try {
      const diff = await safeInvoke<string>("git_get_diff", {
        serverId,
        repoPath,
        filePath,
      });
      set({ diffContent: diff, diffLoading: false });
    } catch (err: any) {
      set({
        diffContent: `获取 Diff 失败: ${formatErrorMessage(err)}`,
        diffLoading: false,
      });
    }
  },

  clearDiff: () => {
    set({ selectedDiffFile: null, diffContent: null, diffLoading: false });
  },
}));
