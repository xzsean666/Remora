import { invoke as tauriInvoke, isTauri as checkIsTauri } from "@tauri-apps/api/core";
import type { ServerConfig } from "../components/Sidebar/ServerManager/ServerManager";

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
    case "install_update": {
      return undefined as unknown as T;
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
