import { invoke as tauriInvoke, isTauri as checkIsTauri } from "@tauri-apps/api/core";
import type { ServerConfig } from "../components/Sidebar/ServerManager/ServerManager";

export interface QuickSnippet {
  id: string;
  title: string;
  command: string;
  group_name: string;
  auto_execute: boolean;
  description?: string | null;
  sort_order: number;
  created_at: number;
  updated_at: number;
}

/**
 * Checks if the current frontend is running inside the Tauri native desktop window.
 */
export const isRunningInTauri = (): boolean => {
  try {
    return checkIsTauri();
  } catch {
    return false;
  }
};

// Polyfill minimal Tauri internals in standard browser / preview / test mode
// so that Tauri 2 Channel and other core APIs can function without error
if (typeof window !== "undefined" && !(window as any).__TAURI_INTERNALS__) {
  let callbackId = 1;
  const callbackMap = new Map<number, (res: any) => void>();
  (window as any).__TAURI_INTERNALS__ = {
    callbacks: callbackMap,
    transformCallback: (callback?: (res: any) => void, once?: boolean) => {
      const id = callbackId++;
      if (callback) {
        callbackMap.set(id, (res) => {
          if (once) callbackMap.delete(id);
          callback(res);
        });
      }
      return id;
    },
    unregisterCallback: (id: number) => {
      callbackMap.delete(id);
    },
    invoke: (cmd: string, args?: any) => safeInvoke(cmd, args),
  };
}

const STORAGE_KEY_SERVERS = "remora_mock_servers";
const STORAGE_KEY_SNIPPETS = "remora_mock_quick_snippets";

const DEFAULT_MOCK_SNIPPETS: QuickSnippet[] = [
  { id: "default-sys-1", title: "System Info", command: "uname -a", group_name: "System", auto_execute: true, description: "Print detailed kernel and OS information", sort_order: 1, created_at: Date.now(), updated_at: Date.now() },
  { id: "default-sys-2", title: "Disk Usage", command: "df -h", group_name: "System", auto_execute: true, description: "Show disk space usage in human-readable units", sort_order: 2, created_at: Date.now(), updated_at: Date.now() },
  { id: "default-sys-3", title: "Memory Usage", command: "free -h", group_name: "System", auto_execute: true, description: "Display free and used RAM/Swap", sort_order: 3, created_at: Date.now(), updated_at: Date.now() },
  { id: "default-sys-4", title: "Top Processes", command: "top", group_name: "System", auto_execute: true, description: "Monitor active processes and resource load", sort_order: 4, created_at: Date.now(), updated_at: Date.now() },
  { id: "default-dock-1", title: "Docker PS", command: "docker ps -a", group_name: "Docker", auto_execute: true, description: "List all running and exited containers", sort_order: 1, created_at: Date.now(), updated_at: Date.now() },
  { id: "default-dock-2", title: "Docker Images", command: "docker images", group_name: "Docker", auto_execute: true, description: "List all local container images", sort_order: 2, created_at: Date.now(), updated_at: Date.now() },
  { id: "default-dock-3", title: "Docker Stats", command: "docker stats --no-stream", group_name: "Docker", auto_execute: true, description: "Snapshot of container resource consumption", sort_order: 3, created_at: Date.now(), updated_at: Date.now() },
  { id: "default-dock-4", title: "Compose Status", command: "docker compose ps", group_name: "Docker", auto_execute: true, description: "List containers in current compose stack", sort_order: 4, created_at: Date.now(), updated_at: Date.now() },
  { id: "default-net-1", title: "Listening Ports", command: "ss -tulnp", group_name: "Network", auto_execute: true, description: "Show listening TCP/UDP ports", sort_order: 1, created_at: Date.now(), updated_at: Date.now() },
  { id: "default-net-2", title: "Public IP", command: "curl -s ifconfig.me && echo", group_name: "Network", auto_execute: true, description: "Query public IP address", sort_order: 2, created_at: Date.now(), updated_at: Date.now() },
  { id: "default-git-1", title: "Git Status", command: "git status", group_name: "Git", auto_execute: true, description: "Check workspace dirty state", sort_order: 1, created_at: Date.now(), updated_at: Date.now() },
  { id: "default-git-2", title: "Recent Commits", command: "git log --oneline -n 10", group_name: "Git", auto_execute: true, description: "Display recent 10 commits concisely", sort_order: 2, created_at: Date.now(), updated_at: Date.now() },
];

function getMockSnippets(): QuickSnippet[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SNIPPETS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn("Failed to read mock snippets from localStorage:", e);
  }
  return DEFAULT_MOCK_SNIPPETS;
}

function saveMockSnippets(snippets: QuickSnippet[]) {
  try {
    localStorage.setItem(STORAGE_KEY_SNIPPETS, JSON.stringify(snippets));
  } catch (e) {
    console.warn("Failed to save mock snippets to localStorage:", e);
  }
}

function getMockServers(): ServerConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SERVERS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn("Failed to read mock servers from localStorage:", e);
  }
  return [];
}

function saveMockServers(servers: ServerConfig[]) {
  try {
    localStorage.setItem(STORAGE_KEY_SERVERS, JSON.stringify(servers));
  } catch (e) {
    console.warn("Failed to save mock servers to localStorage:", e);
  }
}

/**
 * Safe invoke wrapper that transparently falls back to localStorage/mock
 * when running in standard browser preview mode (http://localhost:1420/).
 */
export async function safeInvoke<T = any>(cmd: string, args?: Record<string, any>): Promise<T> {
  if (isRunningInTauri()) {
    return await tauriInvoke<T>(cmd, args);
  }

  // Running in standard web browser (e.g. Chrome at http://localhost:1420/)
  console.info(`[Web Preview Mode] Handled mock invoke("${cmd}", ${JSON.stringify(args || {})})`);

  switch (cmd) {
    case "get_servers": {
      return getMockServers() as unknown as T;
    }
    case "save_server": {
      const newServer = args?.server as ServerConfig;
      if (newServer) {
        const servers = getMockServers();
        const existingIdx = servers.findIndex((s) => s.id === newServer.id);
        if (existingIdx !== -1) {
          servers[existingIdx] = newServer;
        } else {
          servers.push(newServer);
        }
        saveMockServers(servers);
      }
      return undefined as unknown as T;
    }
    case "delete_server": {
      const id = args?.id as string;
      if (id) {
        const servers = getMockServers().filter((s) => s.id !== id);
        saveMockServers(servers);
      }
      return undefined as unknown as T;
    }
    case "connect_server": {
      const serverId = args?.serverId as string;
      if (serverId) {
        try {
          const connected: string[] = JSON.parse(localStorage.getItem("remora_mock_connected") || "[]");
          if (!connected.includes(serverId)) {
            connected.push(serverId);
            localStorage.setItem("remora_mock_connected", JSON.stringify(connected));
          }
        } catch {}
      }
      return undefined as unknown as T;
    }
    case "disconnect_server": {
      const serverId = args?.serverId as string;
      if (serverId) {
        try {
          const connected: string[] = JSON.parse(localStorage.getItem("remora_mock_connected") || "[]");
          const next = connected.filter((id: string) => id !== serverId);
          localStorage.setItem("remora_mock_connected", JSON.stringify(next));
        } catch {}
      }
      return undefined as unknown as T;
    }
    case "get_all_connection_states": {
      try {
        const connected: string[] = JSON.parse(localStorage.getItem("remora_mock_connected") || "[]");
        const map: Record<string, any> = {};
        for (const id of connected) {
          map[id] = { status: "connected" };
        }
        return map as unknown as T;
      } catch {
        return {} as unknown as T;
      }
    }
    case "get_recent_projects": {
      try {
        const raw = localStorage.getItem("remora_recent_projects");
        return (raw ? JSON.parse(raw) : []) as unknown as T;
      } catch {
        return [] as unknown as T;
      }
    }
    case "add_recent_project": {
      try {
        const p = args?.project;
        if (p) {
          const raw = localStorage.getItem("remora_recent_projects");
          const list = raw ? JSON.parse(raw) : [];
          const filtered = list.filter((item: any) => item.id !== p.id);
          filtered.unshift(p);
          localStorage.setItem("remora_recent_projects", JSON.stringify(filtered.slice(0, 20)));
        }
      } catch {}
      return undefined as unknown as T;
    }
    case "remove_recent_project": {
      try {
        const id = args?.id;
        const raw = localStorage.getItem("remora_recent_projects");
        if (raw) {
          const list = JSON.parse(raw);
          const filtered = list.filter((item: any) => item.id !== id);
          localStorage.setItem("remora_recent_projects", JSON.stringify(filtered));
        }
      } catch {}
      return undefined as unknown as T;
    }
    case "sftp_read_dir": {
      const p = (args?.path as string) || "/";
      const clean = p === "/" ? "" : p.replace(/\/+$/, "");

      if (clean === "") {
        // System Root /
        return [
          { name: "home", path: "/home", is_dir: true, is_symlink: false, size: 4096, mtime: Date.now() },
          { name: "root", path: "/root", is_dir: true, is_symlink: false, size: 4096, mtime: Date.now() },
          { name: "var", path: "/var", is_dir: true, is_symlink: false, size: 4096, mtime: Date.now() },
          { name: "etc", path: "/etc", is_dir: true, is_symlink: false, size: 4096, mtime: Date.now() },
          { name: "usr", path: "/usr", is_dir: true, is_symlink: false, size: 4096, mtime: Date.now() },
          { name: "opt", path: "/opt", is_dir: true, is_symlink: false, size: 4096, mtime: Date.now() },
        ] as unknown as T;
      }

      if (clean === "/home") {
        return [
          { name: "ubuntu", path: "/home/ubuntu", is_dir: true, is_symlink: false, size: 4096, mtime: Date.now() },
          { name: "sean", path: "/home/sean", is_dir: true, is_symlink: false, size: 4096, mtime: Date.now() },
        ] as unknown as T;
      }

      if (clean === "/home/ubuntu") {
        return [
          { name: "projects", path: "/home/ubuntu/projects", is_dir: true, is_symlink: false, size: 4096, mtime: Date.now() },
          { name: "app", path: "/home/ubuntu/app", is_dir: true, is_symlink: false, size: 4096, mtime: Date.now() },
          { name: "downloads", path: "/home/ubuntu/downloads", is_dir: true, is_symlink: false, size: 4096, mtime: Date.now() },
        ] as unknown as T;
      }

      if (clean === "/root") {
        return [
          { name: "my-project", path: "/root/my-project", is_dir: true, is_symlink: false, size: 4096, mtime: Date.now() },
          { name: "remora-workspace", path: "/root/remora-workspace", is_dir: true, is_symlink: false, size: 4096, mtime: Date.now() },
          { name: "src", path: "/root/src", is_dir: true, is_symlink: false, size: 4096, mtime: Date.now() },
          { name: "docs", path: "/root/docs", is_dir: true, is_symlink: false, size: 4096, mtime: Date.now() },
          { name: "package.json", path: "/root/package.json", is_dir: false, is_symlink: false, size: 1024, mtime: Date.now() },
          { name: "README.md", path: "/root/README.md", is_dir: false, is_symlink: false, size: 512, mtime: Date.now() },
        ] as unknown as T;
      }

      if (clean === "/root/my-project") {
        return [
          { name: "src", path: "/root/my-project/src", is_dir: true, is_symlink: false, size: 4096, mtime: Date.now() },
          { name: "public", path: "/root/my-project/public", is_dir: true, is_symlink: false, size: 4096, mtime: Date.now() },
          { name: "config", path: "/root/my-project/config", is_dir: true, is_symlink: false, size: 4096, mtime: Date.now() },
          { name: "package.json", path: "/root/my-project/package.json", is_dir: false, is_symlink: false, size: 1024, mtime: Date.now() },
          { name: "README.md", path: "/root/my-project/README.md", is_dir: false, is_symlink: false, size: 512, mtime: Date.now() },
        ] as unknown as T;
      }

      if (clean === "/var") {
        return [
          { name: "www", path: "/var/www", is_dir: true, is_symlink: false, size: 4096, mtime: Date.now() },
          { name: "log", path: "/var/log", is_dir: true, is_symlink: false, size: 4096, mtime: Date.now() },
        ] as unknown as T;
      }

      return [
        { name: "src", path: `${clean}/src`, is_dir: true, is_symlink: false, size: 4096, mtime: Date.now() },
        { name: "docs", path: `${clean}/docs`, is_dir: true, is_symlink: false, size: 4096, mtime: Date.now() },
        { name: "package.json", path: `${clean}/package.json`, is_dir: false, is_symlink: false, size: 1024, mtime: Date.now() },
        { name: "README.md", path: `${clean}/README.md`, is_dir: false, is_symlink: false, size: 512, mtime: Date.now() },
      ] as unknown as T;
    }
    case "sftp_read_file": {
      const p = (args?.path as string) || "";
      return {
        content: `// Remote file: ${p}\nconsole.log("Remora Web Preview");\n`,
        size: 100,
        mtime: Date.now(),
      } as unknown as T;
    }
    case "terminal_open": {
      const mockSessionId = `mock-term-${Date.now()}`;
      const onData = args?.onData;
      if (onData && typeof onData.send === "function") {
        (window as any).__lastTerminalChannel = onData;
        setTimeout(() => {
          const banner =
            "\r\n\x1b[36m[Remora Web Preview]\x1b[0m Terminal session active.\r\n" +
            "\x1b[32mroot@remote-server\x1b[0m:\x1b[34m/workspace\x1b[0m# ";
          try {
            onData.send(new TextEncoder().encode(banner));
          } catch {}
        }, 80);
      }
      return mockSessionId as unknown as T;
    }
    case "terminal_write": {
      // In web preview mode, echo typed data back if it's printable
      const data = args?.data as number[] | undefined;
      const onData = (window as any).__lastTerminalChannel;
      if (data && onData && typeof onData.send === "function") {
        try {
          onData.send(new Uint8Array(data));
        } catch {}
      }
      return undefined as unknown as T;
    }
    case "terminal_resize": {
      return undefined as unknown as T;
    }
    case "terminal_close": {
      return undefined as unknown as T;
    }
    case "create_new_window": {
      window.open(window.location.href, "_blank");
      return undefined as unknown as T;
    }
    case "check_update": {
      return {
        available: false,
        current_version: "0.1.0",
      } as unknown as T;
    }
    case "sftp_stat": {
      const p = (args?.path as string) || "";
      return {
        name: p.split("/").pop() || "file",
        path: p,
        is_dir: false,
        is_symlink: false,
        size: 1024,
        mtime: Date.now(),
      } as unknown as T;
    }
    case "sftp_rename":
    case "sftp_remove":
    case "sftp_trash":
    case "sftp_create_file":
    case "sftp_create_dir": {
      return undefined as unknown as T;
    }
    case "transfer_upload": {
      return `mock-upload-${Date.now()}` as unknown as T;
    }
    case "transfer_download": {
      return `mock-download-${Date.now()}` as unknown as T;
    }
    case "transfer_list": {
      return [] as unknown as T;
    }
    case "transfer_cancel": {
      return undefined as unknown as T;
    }
    case "install_update": {
      return undefined as unknown as T;
    }
    case "get_quick_snippets": {
      return getMockSnippets() as unknown as T;
    }
    case "save_quick_snippet": {
      const snippet = args?.snippet as QuickSnippet;
      if (snippet) {
        const snippets = getMockSnippets();
        const existingIdx = snippets.findIndex((s) => s.id === snippet.id);
        if (existingIdx !== -1) {
          snippets[existingIdx] = snippet;
        } else {
          snippets.push(snippet);
        }
        saveMockSnippets(snippets);
      }
      return undefined as unknown as T;
    }
    case "delete_quick_snippet": {
      const id = args?.id as string;
      if (id) {
        const snippets = getMockSnippets().filter((s) => s.id !== id);
        saveMockSnippets(snippets);
      }
      return undefined as unknown as T;
    }
    case "delete_quick_snippet_group": {
      const groupName = args?.groupName as string;
      if (groupName) {
        const snippets = getMockSnippets().filter((s) => s.group_name !== groupName);
        saveMockSnippets(snippets);
      }
      return undefined as unknown as T;
    }
    case "rename_quick_snippet_group": {
      const oldName = args?.oldName as string;
      const newName = args?.newName as string;
      if (oldName && newName) {
        const snippets = getMockSnippets().map((s) =>
          s.group_name === oldName ? { ...s, group_name: newName, updated_at: Date.now() } : s
        );
        saveMockSnippets(snippets);
      }
      return undefined as unknown as T;
    }
    case "import_quick_snippets": {
      const snippets = (args?.snippets as QuickSnippet[]) || [];
      const overwrite = !!args?.overwrite;
      const existing = overwrite ? [] : getMockSnippets();
      for (const s of snippets) {
        const idx = existing.findIndex((e) => e.id === s.id);
        if (idx !== -1) {
          existing[idx] = s;
        } else {
          existing.push(s);
        }
      }
      saveMockSnippets(existing);
      return snippets.length as unknown as T;
    }
    default: {
      throw new Error(
        `Command "${cmd}" requires Tauri desktop runtime. Please run Remora with "pnpm tauri dev".`
      );
    }
  }
}

export interface UpdateInfo {
  available: boolean;
  current_version: string;
  latest_version?: string;
  body?: string;
  date?: string;
}

export async function createNewWindow(): Promise<void> {
  await safeInvoke("create_new_window");
}

export async function checkUpdate(): Promise<UpdateInfo> {
  return await safeInvoke<UpdateInfo>("check_update");
}

export async function installUpdate(): Promise<void> {
  await safeInvoke("install_update");
}

export async function getQuickSnippets(): Promise<QuickSnippet[]> {
  return await safeInvoke<QuickSnippet[]>("get_quick_snippets");
}

export async function saveQuickSnippet(snippet: QuickSnippet): Promise<void> {
  await safeInvoke("save_quick_snippet", { snippet });
}

export async function deleteQuickSnippet(id: string): Promise<void> {
  await safeInvoke("delete_quick_snippet", { id });
}

export async function deleteQuickSnippetGroup(groupName: string): Promise<void> {
  await safeInvoke("delete_quick_snippet_group", { groupName });
}

export async function renameQuickSnippetGroup(oldName: string, newName: string): Promise<void> {
  await safeInvoke("rename_quick_snippet_group", { oldName, newName });
}

export async function importQuickSnippets(snippets: QuickSnippet[], overwrite: boolean = false): Promise<number> {
  return await safeInvoke<number>("import_quick_snippets", { snippets, overwrite });
}


