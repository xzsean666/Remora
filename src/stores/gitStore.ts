import { create } from "zustand";
import {
  safeInvoke,
  formatErrorMessage,
  GhAuthStatus,
  getGhAuthStatus,
  switchGhAccount as apiSwitchGhAccount,
  gitCommit,
  gitPush,
  gitPull,
  gitSync,
  gitFetch,
  gitShowCommit,
  gitGetSummaryDiff,
} from "../utils/tauriBridge";
import { useFileTreeStore } from "./fileTreeStore";
import { useConnectionStore } from "./connectionStore";
import {
  generateCommitMessage,
  getSavedCommitLang,
  saveCommitLang,
} from "../services/aiCommitService";

export interface GitFileChange {
  path: string;
  status: "M" | "A" | "D" | "U" | "R" | string;
  staged: boolean;
  raw_status: string;
}

export interface GitCommitInfo {
  hash: string;
  short_hash: string;
  subject: string;
  author: string;
  date_relative: string;
}

export interface GitStatusResult {
  is_repo: boolean;
  current_branch: string | null;
  branches: string[];
  changes: GitFileChange[];
  ignored: string[];
  upstream: string | null;
  ahead: number;
  behind: number;
  outgoing_commits: GitCommitInfo[];
  incoming_commits: GitCommitInfo[];
  recent_commits: GitCommitInfo[];
  error?: string | null;
}

export type GitOperationType = "commit" | "push" | "pull" | "sync" | "fetch" | "ai" | null;

interface GitState {
  isRepo: boolean;
  currentBranch: string | null;
  branches: string[];
  changes: GitFileChange[];
  ignored: string[];
  upstream: string | null;
  ahead: number;
  behind: number;
  outgoingCommits: GitCommitInfo[];
  incomingCommits: GitCommitInfo[];
  recentCommits: GitCommitInfo[];
  isFetching: boolean;
  loading: boolean;
  error: string | null;
  selectedDiffFile: string | null;
  diffContent: string | null;
  diffLoading: boolean;

  // Selected Commit inspection
  selectedCommit: GitCommitInfo | null;
  commitDetail: string | null;
  commitDetailLoading: boolean;

  // GitHub Auth status & accounts
  ghAuth: GhAuthStatus | null;
  ghLoading: boolean;

  // Commit & AI generation
  commitMessage: string;
  commitLang: "en" | "zh";
  isOperating: boolean;
  operatingAction: GitOperationType;
  aiGenerating: boolean;

  setCommitMessage: (msg: string) => void;
  setCommitLang: (lang: "en" | "zh") => void;

  fetchStatus: (serverId?: string, repoPath?: string) => Promise<void>;
  fetchRemote: (serverId?: string, repoPath?: string) => Promise<void>;
  fetchGhAuth: (serverId?: string) => Promise<void>;
  switchGhAccount: (serverId: string, username: string) => Promise<void>;
  isPathIgnored: (filePath: string, rootPath?: string) => boolean;
  switchBranch: (serverId: string, repoPath: string, branch: string, createNew?: boolean) => Promise<void>;
  fetchDiff: (serverId: string, repoPath: string, filePath: string) => Promise<void>;
  clearDiff: () => void;
  fetchCommitDetail: (serverId: string, repoPath: string, commit: GitCommitInfo) => Promise<void>;
  clearCommitDetail: () => void;

  // Git operations
  commitChanges: (serverId: string, repoPath: string, stageAll?: boolean) => Promise<void>;
  pushChanges: (serverId: string, repoPath: string) => Promise<void>;
  pullChanges: (serverId: string, repoPath: string) => Promise<void>;
  syncChanges: (serverId: string, repoPath: string) => Promise<void>;
  generateAiCommit: (serverId: string, repoPath: string) => Promise<void>;
}

export const useGitStore = create<GitState>((set, get) => ({
  isRepo: false,
  currentBranch: null,
  branches: [],
  changes: [],
  ignored: [],
  upstream: null,
  ahead: 0,
  behind: 0,
  outgoingCommits: [],
  incomingCommits: [],
  recentCommits: [],
  isFetching: false,
  loading: false,
  error: null,
  selectedDiffFile: null,
  diffContent: null,
  diffLoading: false,

  selectedCommit: null,
  commitDetail: null,
  commitDetailLoading: false,

  ghAuth: null,
  ghLoading: false,

  commitMessage: "",
  commitLang: getSavedCommitLang(),
  isOperating: false,
  operatingAction: null,
  aiGenerating: false,

  setCommitMessage: (msg: string) => set({ commitMessage: msg }),

  setCommitLang: (lang: "en" | "zh") => {
    saveCommitLang(lang);
    set({ commitLang: lang });
  },

  isPathIgnored: (filePath: string, rootPath?: string) => {
    const state = get();
    if (!state.isRepo) return false;
    const base = rootPath || useFileTreeStore.getState().rootPath || "";
    let rel = filePath;
    if (base && filePath.startsWith(base)) {
      rel = filePath.slice(base.length).replace(/^\/+/, "");
    }
    rel = rel.replace(/^\/+/, "").replace(/\/+$/, "");
    if (!rel) return false;
    if (rel === ".git" || rel.startsWith(".git/")) return true;
    return state.ignored.some((ign) => {
      const cleanIgn = ign.replace(/^\/+/, "").replace(/\/+$/, "");
      return rel === cleanIgn || rel.startsWith(cleanIgn + "/");
    });
  },

  fetchStatus: async (overrideServerId?: string, overridePath?: string) => {
    const serverId =
      overrideServerId ||
      useConnectionStore.getState().activeServerId ||
      useFileTreeStore.getState().currentServerId;
    const repoPath = overridePath || useFileTreeStore.getState().rootPath;

    if (!serverId || !repoPath) {
      set({
        isRepo: false,
        currentBranch: null,
        branches: [],
        changes: [],
        ignored: [],
        upstream: null,
        ahead: 0,
        behind: 0,
        outgoingCommits: [],
        incomingCommits: [],
        recentCommits: [],
        error: null,
      });
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
        ignored: res.ignored || [],
        upstream: res.upstream || null,
        ahead: res.ahead || 0,
        behind: res.behind || 0,
        outgoingCommits: res.outgoing_commits || [],
        incomingCommits: res.incoming_commits || [],
        recentCommits: res.recent_commits || [],
        error: res.error || null,
        loading: false,
      });

      // Also trigger background fetch for gh auth status
      get().fetchGhAuth(serverId);
    } catch (err: any) {
      set({
        isRepo: false,
        ignored: [],
        error: formatErrorMessage(err),
        loading: false,
      });
    }
  },

  fetchRemote: async (overrideServerId?: string, overridePath?: string) => {
    const serverId =
      overrideServerId ||
      useConnectionStore.getState().activeServerId ||
      useFileTreeStore.getState().currentServerId;
    const repoPath = overridePath || useFileTreeStore.getState().rootPath;

    if (!serverId || !repoPath) return;

    set({ isFetching: true });
    try {
      await gitFetch(serverId, repoPath);
    } catch (err: any) {
      console.warn("git fetch warning/error:", err);
    } finally {
      set({ isFetching: false });
      await get().fetchStatus(serverId, repoPath);
    }
  },

  fetchGhAuth: async (overrideServerId?: string) => {
    const serverId =
      overrideServerId ||
      useConnectionStore.getState().activeServerId ||
      useFileTreeStore.getState().currentServerId;

    if (!serverId) return;

    set({ ghLoading: true });
    try {
      const status = await getGhAuthStatus(serverId);
      set({ ghAuth: status, ghLoading: false });
    } catch (err: any) {
      set({
        ghAuth: {
          is_installed: false,
          active_account: null,
          accounts: [],
          error: formatErrorMessage(err),
        },
        ghLoading: false,
      });
    }
  },

  switchGhAccount: async (serverId: string, username: string) => {
    set({ ghLoading: true, error: null });
    try {
      const status = await apiSwitchGhAccount(serverId, username);
      set({ ghAuth: status, ghLoading: false });
    } catch (err: any) {
      set({
        error: `切换 GitHub 账号失败: ${formatErrorMessage(err)}`,
        ghLoading: false,
      });
      throw err;
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

  fetchCommitDetail: async (serverId: string, repoPath: string, commit: GitCommitInfo) => {
    set({ selectedCommit: commit, commitDetailLoading: true, commitDetail: null });
    try {
      const detail = await gitShowCommit(serverId, repoPath, commit.hash);
      set({ commitDetail: detail, commitDetailLoading: false });
    } catch (err: any) {
      set({
        commitDetail: `获取提交详情失败: ${formatErrorMessage(err)}`,
        commitDetailLoading: false,
      });
    }
  },

  clearCommitDetail: () => {
    set({ selectedCommit: null, commitDetail: null, commitDetailLoading: false });
  },

  commitChanges: async (serverId: string, repoPath: string, stageAll: boolean = true) => {
    const msg = get().commitMessage.trim();
    if (!msg) {
      set({ error: "请输入 Commit 提交描述信息" });
      return;
    }

    set({ isOperating: true, operatingAction: "commit", error: null });
    try {
      await gitCommit(serverId, repoPath, msg, stageAll);
      set({ commitMessage: "", isOperating: false, operatingAction: null });
      await get().fetchStatus(serverId, repoPath);
    } catch (err: any) {
      set({
        error: `Commit 提交失败: ${formatErrorMessage(err)}`,
        isOperating: false,
        operatingAction: null,
      });
      throw err;
    }
  },

  pushChanges: async (serverId: string, repoPath: string) => {
    set({ isOperating: true, operatingAction: "push", error: null });
    try {
      await gitPush(serverId, repoPath);
      set({ isOperating: false, operatingAction: null });
      await get().fetchStatus(serverId, repoPath);
    } catch (err: any) {
      set({
        error: `Push 推送失败: ${formatErrorMessage(err)}`,
        isOperating: false,
        operatingAction: null,
      });
      throw err;
    }
  },

  pullChanges: async (serverId: string, repoPath: string) => {
    set({ isOperating: true, operatingAction: "pull", error: null });
    try {
      await gitPull(serverId, repoPath);
      set({ isOperating: false, operatingAction: null });
      await get().fetchStatus(serverId, repoPath);
    } catch (err: any) {
      set({
        error: `Pull 拉取失败: ${formatErrorMessage(err)}`,
        isOperating: false,
        operatingAction: null,
      });
      throw err;
    }
  },

  syncChanges: async (serverId: string, repoPath: string) => {
    set({ isOperating: true, operatingAction: "sync", error: null });
    try {
      await gitSync(serverId, repoPath);
      set({ isOperating: false, operatingAction: null });
      await get().fetchStatus(serverId, repoPath);
    } catch (err: any) {
      set({
        error: `Sync 同步失败: ${formatErrorMessage(err)}`,
        isOperating: false,
        operatingAction: null,
      });
      throw err;
    }
  },

  generateAiCommit: async (serverId: string, repoPath: string) => {
    const { commitLang } = get();
    set({ aiGenerating: true, error: null });
    try {
      const summaryDiff = await gitGetSummaryDiff(serverId, repoPath);
      const generated = await generateCommitMessage(summaryDiff, {
        language: commitLang,
      });
      set({ commitMessage: generated, aiGenerating: false });
    } catch (err: any) {
      set({
        error: `AI Commit 生成失败: ${formatErrorMessage(err)}`,
        aiGenerating: false,
      });
    }
  },
}));
