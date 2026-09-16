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

export interface SshKey {
  id: string;
  name: string;
  private_key: string;
  passphrase?: string | null;
  public_key?: string | null;
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
const STORAGE_KEY_SSH_KEYS = "remora_mock_ssh_keys";

function getMockSshKeys(): SshKey[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SSH_KEYS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn("Failed to read mock ssh keys from localStorage:", e);
  }
  return [];
}

function saveMockSshKeys(keys: SshKey[]) {
  try {
    localStorage.setItem(STORAGE_KEY_SSH_KEYS, JSON.stringify(keys));
  } catch (e) {
    console.warn("Failed to write mock ssh keys to localStorage:", e);
  }
}

const DEFAULT_MOCK_SNIPPETS: QuickSnippet[] = [
  { id: "default-ses-1", title: "Tmux 保活/挂载", command: "tmux new -A -s remora", group_name: "Session", auto_execute: true, description: "创建或挂载 remora 会话，断网断线命令后台持续运行", sort_order: 1, created_at: Date.now(), updated_at: Date.now() },
  { id: "default-ses-2", title: "Tmux 脱离 (Detach)", command: "tmux detach", group_name: "Session", auto_execute: true, description: "安全脱离当前会话返回普通终端，后台任务继续", sort_order: 2, created_at: Date.now(), updated_at: Date.now() },
  { id: "default-ses-3", title: "Tmux 会话列表", command: "tmux ls", group_name: "Session", auto_execute: true, description: "查看当前服务器上所有持久运行的会话", sort_order: 3, created_at: Date.now(), updated_at: Date.now() },
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
 * Formats any error value (Rust AppError, Error instance, string, or arbitrary object)
 * into a clear, human-readable string without ever displaying "[object Object]".
 */
export function formatErrorMessage(err: unknown): string {
  if (err === null || err === undefined) {
    return "Unknown error";
  }
  if (typeof err === "string") {
    return err.trim();
  }
  if (err instanceof Error) {
    return (err.message || err.toString() || "Unknown error").trim();
  }
  if (typeof err === "object") {
    const obj = err as Record<string, any>;
    // Check common error object properties
    if (typeof obj.message === "string" && obj.message.trim()) {
      return obj.message.trim();
    }
    if (typeof obj.error === "string" && obj.error.trim()) {
      return obj.error.trim();
    }
    if (typeof obj.details === "string" && obj.details.trim()) {
      return obj.details.trim();
    }

    // Check if it's a Rust Serde enum variant: e.g. { Connection: "connection refused" }
    const keys = Object.keys(obj);
    if (keys.length === 1) {
      const key = keys[0];
      const val = obj[key];
      if (typeof val === "string") {
        return `${key} error: ${val}`.trim();
      }
      if (val && typeof val === "object") {
        return `${key}: ${formatErrorMessage(val)}`.trim();
      }
    }

    // Attempt JSON serialization if non-empty
    try {
      const json = JSON.stringify(err);
      if (json && json !== "{}") {
        return json;
      }
    } catch {}
  }

  try {
    const str = String(err);
    return str === "[object Object]" ? "An unknown error occurred" : str;
  } catch {
    return "An unknown error occurred";
  }
}

/**
 * Safe invoke wrapper that transparently falls back to localStorage/mock
 * when running in standard browser preview mode (http://localhost:1420/).
 * Also wraps rejections with clean human-readable error messages.
 */
export async function safeInvoke<T = any>(cmd: string, args?: Record<string, any>): Promise<T> {
  if (isRunningInTauri()) {
    try {
      return await tauriInvoke<T>(cmd, args);
    } catch (err: any) {
      const msg = formatErrorMessage(err);
      const customErr = new Error(msg);
      (customErr as any).raw = err;
      customErr.toString = () => msg;
      throw customErr;
    }
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
    case "get_default_download_dir": {
      return "~/Downloads/Remora" as unknown as T;
    }
    case "open_download_dir": {
      console.log("[Mock] Opening download dir: ~/Downloads/Remora");
      return "~/Downloads/Remora" as unknown as T;
    }
    case "show_item_in_folder": {
      console.log("[Mock] Showing item in folder:", args?.path);
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
    case "get_ssh_keys": {
      return getMockSshKeys() as unknown as T;
    }
    case "get_ssh_key": {
      const id = args?.id as string;
      const key = getMockSshKeys().find((k) => k.id === id) || null;
      return key as unknown as T;
    }
    case "save_ssh_key": {
      const key = args?.key as SshKey;
      if (key) {
        const keys = getMockSshKeys();
        const idx = keys.findIndex((k) => k.id === key.id);
        if (idx !== -1) {
          keys[idx] = key;
        } else {
          keys.push(key);
        }
        saveMockSshKeys(keys);
      }
      return undefined as unknown as T;
    }
    case "delete_ssh_key": {
      const id = args?.id as string;
      if (id) {
        const keys = getMockSshKeys().filter((k) => k.id !== id);
        saveMockSshKeys(keys);
      }
      return undefined as unknown as T;
    }
    case "get_server_overview": {
      const mockOverview: ServerOverview = {
        cpu_usage: 12.8,
        cpu_cores: 8,
        load_avg: [0.35, 0.42, 0.51],
        mem_total: 16 * 1024 * 1024 * 1024,
        mem_used: 6.8 * 1024 * 1024 * 1024,
        mem_usage: 42.5,
        disk_total: 120 * 1024 * 1024 * 1024,
        disk_used: 48 * 1024 * 1024 * 1024,
        disk_usage: 40.0,
        disk_mount: "/",
        net_rx_speed: 128 * 1024,
        net_tx_speed: 45 * 1024,
        uptime_seconds: 345600,
        timestamp: Date.now(),
      };
      return mockOverview as unknown as T;
    }
    case "gh_get_auth_status": {
      const mockGh: GhAuthStatus = {
        is_installed: true,
        active_account: "xzsean666",
        accounts: ["xzsean666", "0xcube-666"],
        error: null,
      };
      return mockGh as unknown as T;
    }
    case "gh_switch_account": {
      const mockGh: GhAuthStatus = {
        is_installed: true,
        active_account: (args?.username as string) || "xzsean666",
        accounts: ["xzsean666", "0xcube-666"],
        error: null,
      };
      return mockGh as unknown as T;
    }
    case "git_commit": {
      return `[main 7f8a9b] ${args?.message || "commit"}` as unknown as T;
    }
    case "git_push": {
      return "Everything up-to-date" as unknown as T;
    }
    case "git_pull": {
      return "Already up to date." as unknown as T;
    }
    case "git_sync": {
      return "Sync completed successfully." as unknown as T;
    }
    case "git_get_summary_diff": {
      return "===STATUS===\n M src/components/Sidebar/Git/GitPanel.tsx\n===DIFF===\n+ // git panel updated" as unknown as T;
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

export const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "ico",
  "bmp",
  "avif",
]);

export function isImageFilePath(path: string): boolean {
  if (!path) return false;
  const ext = path.split(".").pop()?.toLowerCase();
  return ext ? IMAGE_EXTENSIONS.has(ext) : false;
}

export interface ReadBinaryFileResponse {
  data_base64: string;
  mime_type: string;
  size: number;
  mtime: number;
}

export async function createNewWindow(): Promise<void> {
  await safeInvoke("create_new_window");
}

/**
 * Detects if the current frontend instance is running inside a secondary / new window.
 * Secondary windows should start with a clean empty workspace (no auto-restore), mimicking VS Code.
 */
export function isNewOrAuxiliaryWindow(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("new_window") === "1" || params.get("isNewWindow") === "true") {
      return true;
    }
    const label = (window as any).__TAURI_INTERNALS__?.metadata?.currentWindow?.label;
    if (label && label !== "main") {
      return true;
    }
  } catch {}
  return false;
}

/**
 * Asynchronous auxiliary window detector using the official WebviewWindow API.
 */
export async function isAuxiliaryWindowAsync(): Promise<boolean> {
  if (isNewOrAuxiliaryWindow()) return true;
  if (!isRunningInTauri()) return false;
  try {
    const { getCurrentWebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    const label = getCurrentWebviewWindow().label;
    return Boolean(label && label !== "main");
  } catch {
    return false;
  }
}

/**
 * Dynamically updates the native OS desktop window title, matching VS Code convention:
 * "[Project Name] - Remora" or "Remora".
 */
export async function setAppWindowTitle(title: string): Promise<void> {
  if (typeof document !== "undefined") {
    document.title = title;
  }
  if (!isRunningInTauri()) return;
  try {
    const { getCurrentWebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    await getCurrentWebviewWindow().setTitle(title);
  } catch (err) {
    console.debug("Failed to set native window title:", err);
  }
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

export async function getSshKeys(): Promise<SshKey[]> {
  return await safeInvoke<SshKey[]>("get_ssh_keys");
}

export async function getSshKey(id: string): Promise<SshKey | null> {
  return await safeInvoke<SshKey | null>("get_ssh_key", { id });
}

export async function saveSshKey(key: SshKey): Promise<void> {
  await safeInvoke("save_ssh_key", { key });
}

export async function deleteSshKey(id: string): Promise<void> {
  await safeInvoke("delete_ssh_key", { id });
}

export interface TmuxSessionInfo {
  name: string;
  windows: number;
  attached: boolean;
  created_at: number;
}

export interface TmuxListResult {
  installed: boolean;
  sessions: TmuxSessionInfo[];
  error?: string | null;
}

export async function listTmuxSessions(serverId: string): Promise<TmuxListResult> {
  return await safeInvoke<TmuxListResult>("tmux_list_sessions", { serverId });
}

export async function killTmuxSession(serverId: string, sessionName: string): Promise<void> {
  await safeInvoke("tmux_kill_session", { serverId, sessionName });
}

export async function createTmuxSession(
  serverId: string,
  sessionName: string,
  initialDir?: string
): Promise<void> {
  await safeInvoke("tmux_new_session", {
    serverId,
    sessionName,
    initialDir: initialDir || null,
  });
}

// --- Git Integration ---

export interface GitFileChange {
  path: string;
  status: string;
  staged: boolean;
  raw_status: string;
}

export interface GitStatusResult {
  is_repo: boolean;
  current_branch: string | null;
  branches: string[];
  changes: GitFileChange[];
  ignored: string[];
  error?: string | null;
}

export async function getGitStatus(
  serverId: string,
  repoPath: string
): Promise<GitStatusResult> {
  return await safeInvoke<GitStatusResult>("git_get_status", { serverId, repoPath });
}

export async function gitCheckout(
  serverId: string,
  repoPath: string,
  branch: string,
  createNew?: boolean
): Promise<string> {
  return await safeInvoke<string>("git_checkout", {
    serverId,
    repoPath,
    branch,
    createNew: createNew || false,
  });
}

export async function getGitDiff(
  serverId: string,
  repoPath: string,
  filePath: string
): Promise<string> {
  return await safeInvoke<string>("git_get_diff", { serverId, repoPath, filePath });
}

export interface GhAuthStatus {
  is_installed: boolean;
  active_account: string | null;
  accounts: string[];
  error?: string | null;
}

export async function getGhAuthStatus(serverId: string): Promise<GhAuthStatus> {
  return await safeInvoke<GhAuthStatus>("gh_get_auth_status", { serverId });
}

export async function switchGhAccount(serverId: string, username: string): Promise<GhAuthStatus> {
  return await safeInvoke<GhAuthStatus>("gh_switch_account", { serverId, username });
}

export async function gitCommit(
  serverId: string,
  repoPath: string,
  message: string,
  stageAll: boolean = true
): Promise<string> {
  return await safeInvoke<string>("git_commit", {
    serverId,
    repoPath,
    message,
    stageAll,
  });
}

export async function gitPush(serverId: string, repoPath: string): Promise<string> {
  return await safeInvoke<string>("git_push", { serverId, repoPath });
}

export async function gitPull(serverId: string, repoPath: string): Promise<string> {
  return await safeInvoke<string>("git_pull", { serverId, repoPath });
}

export async function gitSync(serverId: string, repoPath: string): Promise<string> {
  return await safeInvoke<string>("git_sync", { serverId, repoPath });
}

export async function gitGetSummaryDiff(serverId: string, repoPath: string): Promise<string> {
  return await safeInvoke<string>("git_get_summary_diff", { serverId, repoPath });
}

export interface ServerOverview {
  cpu_usage: number;
  cpu_cores: number;
  load_avg: [number, number, number];
  mem_total: number;
  mem_used: number;
  mem_usage: number;
  disk_total: number;
  disk_used: number;
  disk_usage: number;
  disk_mount: string;
  net_rx_speed: number;
  net_tx_speed: number;
  uptime_seconds: number;
  timestamp: number;
}

export async function getServerOverview(serverId: string): Promise<ServerOverview> {
  return await safeInvoke<ServerOverview>("get_server_overview", { serverId });
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes <= 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  if (i >= sizes.length) return (bytes / Math.pow(k, sizes.length - 1)).toFixed(dm) + " " + sizes[sizes.length - 1];
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

export function formatSpeed(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec <= 0) return "0 B/s";
  if (bytesPerSec < 1024) return `${bytesPerSec} B/s`;
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  if (bytesPerSec < 1024 * 1024 * 1024) return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
  return `${(bytesPerSec / (1024 * 1024 * 1024)).toFixed(1)} GB/s`;
}

export function formatSpeedCompact(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec <= 0) return "0B";
  if (bytesPerSec < 1024) return `${bytesPerSec}B`;
  if (bytesPerSec < 1024 * 1024) return `${Math.round(bytesPerSec / 1024)}K`;
  if (bytesPerSec < 1024 * 1024 * 1024) return `${(bytesPerSec / (1024 * 1024)).toFixed(1)}M`;
  return `${(bytesPerSec / (1024 * 1024 * 1024)).toFixed(1)}G`;
}

export function formatUptime(seconds: number): string {
  if (!seconds || seconds <= 0) return "刚刚启动";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}天 ${hours}小时`;
  }
  if (hours > 0) {
    return `${hours}小时 ${minutes}分`;
  }
  return `${minutes}分钟`;
}

export interface SearchLineMatch {
  line_number: number;
  column_number: number;
  line_content: string;
  match_start: number;
  match_end: number;
}

export interface SearchFileMatch {
  path: string;
  relative_path: string;
  matches: SearchLineMatch[];
}

export interface SearchResult {
  query: string;
  total_matches: number;
  total_files: number;
  files: SearchFileMatch[];
  truncated: boolean;
  duration_ms: number;
  engine_used: string;
}

export interface SearchParams {
  serverId: string;
  rootPath: string;
  query: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  isRegex: boolean;
  includePattern?: string;
  excludePattern?: string;
  maxResults?: number;
}

export async function searchInFiles(params: SearchParams): Promise<SearchResult> {
  return await safeInvoke<SearchResult>("search_in_files", {
    params: {
      server_id: params.serverId,
      root_path: params.rootPath,
      query: params.query,
      case_sensitive: params.caseSensitive,
      whole_word: params.wholeWord,
      is_regex: params.isRegex,
      include_pattern: params.includePattern || null,
      exclude_pattern: params.excludePattern || null,
      max_results: params.maxResults || 1000,
    },
  });
}

