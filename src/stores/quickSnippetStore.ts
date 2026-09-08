import { create } from "zustand";
import {
  QuickSnippet,
  getQuickSnippets,
  saveQuickSnippet,
  deleteQuickSnippet,
  deleteQuickSnippetGroup,
  renameQuickSnippetGroup,
  importQuickSnippets,
  safeInvoke,
} from "../utils/tauriBridge";
import { useTerminalStore } from "./terminalStore";

interface NotificationInfo {
  message: string;
  type: "success" | "info" | "warning" | "error";
}

interface QuickSnippetState {
  snippets: QuickSnippet[];
  loading: boolean;
  activeGroup: string; // "ALL" or specific group name
  searchQuery: string;
  notification: NotificationInfo | null;

  loadSnippets: () => Promise<void>;
  saveSnippet: (snippet: QuickSnippet) => Promise<void>;
  deleteSnippet: (id: string) => Promise<void>;
  renameGroup: (oldName: string, newName: string) => Promise<void>;
  deleteGroup: (groupName: string) => Promise<void>;
  exportSnippets: (groupName?: string) => void;
  importSnippets: (snippets: QuickSnippet[], overwrite?: boolean) => Promise<number>;
  setActiveGroup: (group: string) => void;
  setSearchQuery: (query: string) => void;
  setNotification: (notif: NotificationInfo | null) => void;
  sendToTerminal: (
    command: string,
    autoExecute: boolean
  ) => Promise<{ success: boolean; message: string }>;
}

let notifTimeout: ReturnType<typeof setTimeout> | null = null;

export const useQuickSnippetStore = create<QuickSnippetState>((set, get) => ({
  snippets: [],
  loading: false,
  activeGroup: "ALL",
  searchQuery: "",
  notification: null,

  setNotification: (notif) => {
    if (notifTimeout) {
      clearTimeout(notifTimeout);
      notifTimeout = null;
    }
    set({ notification: notif });
    if (notif) {
      notifTimeout = setTimeout(() => {
        set({ notification: null });
        notifTimeout = null;
      }, 2500);
    }
  },

  setActiveGroup: (group) => set({ activeGroup: group }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  loadSnippets: async () => {
    set({ loading: true });
    try {
      const data = await getQuickSnippets();
      set({ snippets: data, loading: false });
    } catch (e: any) {
      console.error("Failed to load quick snippets:", e);
      set({ loading: false });
    }
  },

  saveSnippet: async (snippet) => {
    try {
      await saveQuickSnippet(snippet);
      await get().loadSnippets();
      get().setNotification({
        message: `快捷输入「${snippet.title}」已保存`,
        type: "success",
      });
    } catch (e: any) {
      console.error("Failed to save quick snippet:", e);
      get().setNotification({
        message: `保存失败: ${e?.message || e}`,
        type: "error",
      });
      throw e;
    }
  },

  deleteSnippet: async (id) => {
    try {
      const item = get().snippets.find((s) => s.id === id);
      await deleteQuickSnippet(id);
      await get().loadSnippets();
      get().setNotification({
        message: `快捷输入「${item?.title || id}」已删除`,
        type: "info",
      });
    } catch (e: any) {
      console.error("Failed to delete snippet:", e);
      get().setNotification({
        message: `删除失败: ${e?.message || e}`,
        type: "error",
      });
      throw e;
    }
  },

  renameGroup: async (oldName, newName) => {
    if (!newName.trim() || oldName === newName) return;
    try {
      await renameQuickSnippetGroup(oldName, newName.trim());
      await get().loadSnippets();
      if (get().activeGroup === oldName) {
        set({ activeGroup: newName.trim() });
      }
      get().setNotification({
        message: `分组「${oldName}」已重命名为「${newName.trim()}」`,
        type: "success",
      });
    } catch (e: any) {
      console.error("Failed to rename snippet group:", e);
      get().setNotification({
        message: `重命名分组失败: ${e?.message || e}`,
        type: "error",
      });
      throw e;
    }
  },

  deleteGroup: async (groupName) => {
    try {
      await deleteQuickSnippetGroup(groupName);
      await get().loadSnippets();
      if (get().activeGroup === groupName) {
        set({ activeGroup: "ALL" });
      }
      get().setNotification({
        message: `分组「${groupName}」及其快捷输入已删除`,
        type: "info",
      });
    } catch (e: any) {
      console.error("Failed to delete snippet group:", e);
      get().setNotification({
        message: `删除分组失败: ${e?.message || e}`,
        type: "error",
      });
      throw e;
    }
  },

  exportSnippets: (groupName) => {
    try {
      const allSnippets = get().snippets;
      const exportList =
        groupName && groupName !== "ALL"
          ? allSnippets.filter((s) => s.group_name === groupName)
          : allSnippets;

      if (exportList.length === 0) {
        get().setNotification({
          message: "当前没有可导出的快捷输入",
          type: "warning",
        });
        return;
      }

      const payload = {
        version: 1,
        app: "remora",
        exported_at: new Date().toISOString(),
        count: exportList.length,
        snippets: exportList,
      };

      const jsonStr = JSON.stringify(payload, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dateStr = new Date().toISOString().slice(0, 10);
      const grpSuffix = groupName && groupName !== "ALL" ? `-${groupName.replace(/\s+/g, "_")}` : "";
      a.href = url;
      a.download = `remora-snippets${grpSuffix}-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      get().setNotification({
        message: `成功导出 ${exportList.length} 条快捷输入`,
        type: "success",
      });
    } catch (e: any) {
      console.error("Failed to export snippets:", e);
      get().setNotification({
        message: `导出失败: ${e?.message || e}`,
        type: "error",
      });
    }
  },

  importSnippets: async (snippetsToImport, overwrite = false) => {
    try {
      set({ loading: true });
      const count = await importQuickSnippets(snippetsToImport, overwrite);
      await get().loadSnippets();
      set({ loading: false });

      get().setNotification({
        message: overwrite
          ? `已清空并成功导入 ${count} 条快捷输入`
          : `已成功合并导入 ${count} 条快捷输入`,
        type: "success",
      });
      return count;
    } catch (e: any) {
      set({ loading: false });
      console.error("Failed to import snippets:", e);
      get().setNotification({
        message: `导入失败: ${e?.message || e}`,
        type: "error",
      });
      throw e;
    }
  },

  sendToTerminal: async (command, autoExecute) => {
    const { sessions, activeSessionId } = useTerminalStore.getState();
    const activeSession = sessions.find((s) => s.id === activeSessionId);

    if (!activeSession || activeSession.status !== "connected" || !activeSession.backendSessionId) {
      const msg = "没有活动的在线终端会话。请在下方或侧边栏打开并连接终端。";
      get().setNotification({
        message: msg,
        type: "warning",
      });
      return { success: false, message: msg };
    }

    try {
      const textToSend = autoExecute
        ? command.endsWith("\n") || command.endsWith("\r")
          ? command
          : command + "\n"
        : command;

      const bytes = Array.from(new TextEncoder().encode(textToSend));
      await safeInvoke("terminal_write", {
        sessionId: activeSession.backendSessionId,
        data: bytes,
      });

      const succMsg = autoExecute ? "已发送至终端并执行" : "已填充至终端命令行";
      get().setNotification({
        message: succMsg,
        type: "success",
      });
      return { success: true, message: succMsg };
    } catch (e: any) {
      const errMsg = `发送至终端失败: ${e?.message || e}`;
      get().setNotification({
        message: errMsg,
        type: "error",
      });
      return { success: false, message: errMsg };
    }
  },
}));
