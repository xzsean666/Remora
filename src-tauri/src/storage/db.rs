use rusqlite::{params, Connection, OptionalExtension};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use crate::core::{
    AppError, AuthType, LayoutPreferences, QuickSnippet, RecentProject, Result, ServerConfig,
    SshKey,
};

pub struct StorageService {
    conn: Mutex<Connection>,
}

impl StorageService {
    pub fn new<P: AsRef<Path>>(db_path: P) -> Result<Self> {
        if let Some(parent) = db_path.as_ref().parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| AppError::Storage(format!("Failed to create db dir: {}", e)))?;
        }

        let conn = Connection::open(db_path)?;
        let service = Self {
            conn: Mutex::new(conn),
        };
        service.init_tables()?;
        Ok(service)
    }

    pub fn new_in_memory() -> Result<Self> {
        let conn = Connection::open_in_memory()?;
        let service = Self {
            conn: Mutex::new(conn),
        };
        service.init_tables()?;
        Ok(service)
    }

    pub fn default_db_path() -> PathBuf {
        let base_dir = dirs::data_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("remora");
        base_dir.join("remora.db")
    }

    fn init_tables(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch(
            r#"
            PRAGMA journal_mode=WAL;
            PRAGMA busy_timeout=5000;

            CREATE TABLE IF NOT EXISTS servers (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                host TEXT NOT NULL,
                port INTEGER NOT NULL,
                username TEXT NOT NULL,
                auth_type TEXT NOT NULL,
                key_path TEXT,
                default_workspace TEXT,
                remote_proxy TEXT,
                remote_no_proxy TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS recent_projects (
                id TEXT PRIMARY KEY,
                server_id TEXT NOT NULL,
                server_name TEXT NOT NULL,
                project_name TEXT NOT NULL,
                remote_path TEXT NOT NULL,
                last_opened_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS preferences (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS quick_snippets (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                command TEXT NOT NULL,
                group_name TEXT NOT NULL,
                auto_execute INTEGER NOT NULL DEFAULT 1,
                description TEXT,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS ssh_keys (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                private_key TEXT NOT NULL,
                passphrase TEXT,
                public_key TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );
            "#,
        )?;

        // Graceful migration for existing databases without proxy columns
        let _ = conn.execute("ALTER TABLE servers ADD COLUMN remote_proxy TEXT", []);
        let _ = conn.execute("ALTER TABLE servers ADD COLUMN remote_no_proxy TEXT", []);

        // Seed default quick snippets if the table is empty
        let snippet_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM quick_snippets", [], |row| row.get(0))
            .unwrap_or(0);
        if snippet_count == 0 {
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as i64;
            let defaults: [(&str, &str, &str, &str, i32, &str, i32); 12] = [
                // Group: System
                ("default-sys-1", "System Info", "uname -a", "System", 1, "Print detailed kernel and OS information", 1),
                ("default-sys-2", "Disk Usage", "df -h", "System", 1, "Show disk space usage in human-readable units", 2),
                ("default-sys-3", "Memory Usage", "free -h", "System", 1, "Display free and used RAM/Swap", 3),
                ("default-sys-4", "Top Processes", "top", "System", 1, "Monitor active processes and resource load", 4),
                // Group: Docker
                ("default-dock-1", "Docker PS", "docker ps -a", "Docker", 1, "List all running and exited containers", 1),
                ("default-dock-2", "Docker Images", "docker images", "Docker", 1, "List all local container images", 2),
                ("default-dock-3", "Docker Stats", "docker stats --no-stream", "Docker", 1, "One-shot snapshot of container memory/CPU consumption", 3),
                ("default-dock-4", "Compose Status", "docker compose ps", "Docker", 1, "List containers in current docker compose stack", 4),
                // Group: Network
                ("default-net-1", "Listening Ports", "ss -tulnp", "Network", 1, "Show listening TCP/UDP ports with corresponding processes", 1),
                ("default-net-2", "Public IP", "curl -s ifconfig.me && echo", "Network", 1, "Query public IP address", 2),
                // Group: Git
                ("default-git-1", "Git Status", "git status", "Git", 1, "Check workspace dirty state and staged files", 1),
                ("default-git-2", "Recent Commits", "git log --oneline -n 10", "Git", 1, "Display recent 10 commits concisely", 2),
            ];
            for (id, title, cmd, grp, auto_exec, desc, sort) in defaults {
                let _ = conn.execute(
                    r#"INSERT OR IGNORE INTO quick_snippets (id, title, command, group_name, auto_execute, description, sort_order, created_at, updated_at)
                       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)"#,
                    params![id, title, cmd, grp, auto_exec, desc, sort, now, now],
                );
            }
        }

        Ok(())
    }

    // --- ServerConfig CRUD ---

    pub fn get_servers(&self) -> Result<Vec<ServerConfig>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, host, port, username, auth_type, key_path, default_workspace, remote_proxy, remote_no_proxy, created_at, updated_at
             FROM servers ORDER BY updated_at DESC",
        )?;

        let rows = stmt.query_map([], |row| {
            let auth_type_str: String = row.get(5)?;
            Ok(ServerConfig {
                id: row.get(0)?,
                name: row.get(1)?,
                host: row.get(2)?,
                port: row.get(3)?,
                username: row.get(4)?,
                auth_type: AuthType::from_str(&auth_type_str),
                key_path: row.get(6)?,
                default_workspace: row.get(7)?,
                remote_proxy: row.get(8)?,
                remote_no_proxy: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        })?;

        let mut servers = Vec::new();
        for row in rows {
            servers.push(row?);
        }
        Ok(servers)
    }

    pub fn get_server(&self, id: &str) -> Result<Option<ServerConfig>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, host, port, username, auth_type, key_path, default_workspace, remote_proxy, remote_no_proxy, created_at, updated_at
             FROM servers WHERE id = ?1",
        )?;

        let result = stmt
            .query_row(params![id], |row| {
                let auth_type_str: String = row.get(5)?;
                Ok(ServerConfig {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    host: row.get(2)?,
                    port: row.get(3)?,
                    username: row.get(4)?,
                    auth_type: AuthType::from_str(&auth_type_str),
                    key_path: row.get(6)?,
                    default_workspace: row.get(7)?,
                    remote_proxy: row.get(8)?,
                    remote_no_proxy: row.get(9)?,
                    created_at: row.get(10)?,
                    updated_at: row.get(11)?,
                })
            })
            .optional()?;

        Ok(result)
    }

    pub fn save_server(&self, server: &ServerConfig) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            r#"
            INSERT INTO servers (id, name, host, port, username, auth_type, key_path, default_workspace, remote_proxy, remote_no_proxy, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                host = excluded.host,
                port = excluded.port,
                username = excluded.username,
                auth_type = excluded.auth_type,
                key_path = excluded.key_path,
                default_workspace = excluded.default_workspace,
                remote_proxy = excluded.remote_proxy,
                remote_no_proxy = excluded.remote_no_proxy,
                updated_at = excluded.updated_at
            "#,
            params![
                server.id,
                server.name,
                server.host,
                server.port,
                server.username,
                server.auth_type.as_str(),
                server.key_path,
                server.default_workspace,
                server.remote_proxy,
                server.remote_no_proxy,
                server.created_at,
                server.updated_at,
            ],
        )?;
        Ok(())
    }

    pub fn delete_server(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM servers WHERE id = ?1", params![id])?;
        conn.execute("DELETE FROM recent_projects WHERE server_id = ?1", params![id])?;
        Ok(())
    }

    // --- Recent Projects CRUD ---

    pub fn get_recent_projects(&self, limit: usize) -> Result<Vec<RecentProject>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, server_id, server_name, project_name, remote_path, last_opened_at
             FROM recent_projects ORDER BY last_opened_at DESC LIMIT ?1",
        )?;

        let rows = stmt.query_map(params![limit as i64], |row| {
            Ok(RecentProject {
                id: row.get(0)?,
                server_id: row.get(1)?,
                server_name: row.get(2)?,
                project_name: row.get(3)?,
                remote_path: row.get(4)?,
                last_opened_at: row.get(5)?,
            })
        })?;

        let mut projects = Vec::new();
        for row in rows {
            projects.push(row?);
        }
        Ok(projects)
    }

    pub fn add_recent_project(&self, project: &RecentProject) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            r#"
            INSERT INTO recent_projects (id, server_id, server_name, project_name, remote_path, last_opened_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6)
            ON CONFLICT(id) DO UPDATE SET
                server_name = excluded.server_name,
                project_name = excluded.project_name,
                remote_path = excluded.remote_path,
                last_opened_at = excluded.last_opened_at
            "#,
            params![
                project.id,
                project.server_id,
                project.server_name,
                project.project_name,
                project.remote_path,
                project.last_opened_at,
            ],
        )?;
        Ok(())
    }

    pub fn remove_recent_project(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM recent_projects WHERE id = ?1", params![id])?;
        Ok(())
    }

    // --- Preferences CRUD ---

    pub fn get_preference(&self, key: &str) -> Result<Option<String>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT value FROM preferences WHERE key = ?1")?;
        let res = stmt.query_row(params![key], |row| row.get(0)).optional()?;
        Ok(res)
    }

    pub fn set_preference(&self, key: &str, value: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            r#"
            INSERT INTO preferences (key, value) VALUES (?1, ?2)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
            "#,
            params![key, value],
        )?;
        Ok(())
    }

    pub fn get_layout_preferences(&self) -> Result<LayoutPreferences> {
        if let Some(val) = self.get_preference("layout_preferences")? {
            serde_json::from_str(&val).map_err(|e| AppError::Storage(e.to_string()))
        } else {
            Ok(LayoutPreferences::default())
        }
    }

    pub fn set_layout_preferences(&self, prefs: &LayoutPreferences) -> Result<()> {
        let json_str = serde_json::to_string(prefs).map_err(|e| AppError::Storage(e.to_string()))?;
        self.set_preference("layout_preferences", &json_str)
    }

    // --- Quick Snippets CRUD ---

    pub fn get_quick_snippets(&self) -> Result<Vec<QuickSnippet>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, title, command, group_name, auto_execute, description, sort_order, created_at, updated_at
             FROM quick_snippets ORDER BY group_name ASC, sort_order ASC, created_at ASC",
        )?;

        let rows = stmt.query_map([], |row| {
            let auto_execute_int: i32 = row.get(4)?;
            Ok(QuickSnippet {
                id: row.get(0)?,
                title: row.get(1)?,
                command: row.get(2)?,
                group_name: row.get(3)?,
                auto_execute: auto_execute_int != 0,
                description: row.get(5)?,
                sort_order: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })?;

        let mut snippets = Vec::new();
        for row in rows {
            snippets.push(row?);
        }
        Ok(snippets)
    }

    pub fn save_quick_snippet(&self, snippet: &QuickSnippet) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            r#"
            INSERT INTO quick_snippets (id, title, command, group_name, auto_execute, description, sort_order, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
            ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                command = excluded.command,
                group_name = excluded.group_name,
                auto_execute = excluded.auto_execute,
                description = excluded.description,
                sort_order = excluded.sort_order,
                updated_at = excluded.updated_at
            "#,
            params![
                snippet.id,
                snippet.title,
                snippet.command,
                snippet.group_name,
                if snippet.auto_execute { 1 } else { 0 },
                snippet.description,
                snippet.sort_order,
                snippet.created_at,
                snippet.updated_at,
            ],
        )?;
        Ok(())
    }

    pub fn delete_quick_snippet(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM quick_snippets WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn delete_quick_snippet_group(&self, group_name: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "DELETE FROM quick_snippets WHERE group_name = ?1",
            params![group_name],
        )?;
        Ok(())
    }

    pub fn rename_quick_snippet_group(&self, old_name: &str, new_name: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as i64;
        conn.execute(
            "UPDATE quick_snippets SET group_name = ?1, updated_at = ?2 WHERE group_name = ?3",
            params![new_name, now, old_name],
        )?;
        Ok(())
    }

    pub fn import_quick_snippets(&self, snippets: &[QuickSnippet], overwrite: bool) -> Result<usize> {
        let mut conn = self.conn.lock().unwrap();
        let tx = conn.transaction()?;
        if overwrite {
            tx.execute("DELETE FROM quick_snippets", [])?;
        }
        let mut count = 0;
        for snippet in snippets {
            tx.execute(
                r#"
                INSERT INTO quick_snippets (id, title, command, group_name, auto_execute, description, sort_order, created_at, updated_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
                ON CONFLICT(id) DO UPDATE SET
                    title = excluded.title,
                    command = excluded.command,
                    group_name = excluded.group_name,
                    auto_execute = excluded.auto_execute,
                    description = excluded.description,
                    sort_order = excluded.sort_order,
                    updated_at = excluded.updated_at
                "#,
                params![
                    snippet.id,
                    snippet.title,
                    snippet.command,
                    snippet.group_name,
                    if snippet.auto_execute { 1 } else { 0 },
                    snippet.description,
                    snippet.sort_order,
                    snippet.created_at,
                    snippet.updated_at,
                ],
            )?;
            count += 1;
        }
        tx.commit()?;
        Ok(count)
    }

    pub fn get_ssh_keys(&self) -> Result<Vec<SshKey>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, private_key, passphrase, public_key, created_at, updated_at
             FROM ssh_keys ORDER BY updated_at DESC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(SshKey {
                id: row.get(0)?,
                name: row.get(1)?,
                private_key: row.get(2)?,
                passphrase: row.get(3)?,
                public_key: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })?;

        let mut keys = Vec::new();
        for k in rows {
            keys.push(k?);
        }
        Ok(keys)
    }

    pub fn get_ssh_key(&self, id: &str) -> Result<Option<SshKey>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, private_key, passphrase, public_key, created_at, updated_at
             FROM ssh_keys WHERE id = ?1",
        )?;
        let key = stmt
            .query_row(params![id], |row| {
                Ok(SshKey {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    private_key: row.get(2)?,
                    passphrase: row.get(3)?,
                    public_key: row.get(4)?,
                    created_at: row.get(5)?,
                    updated_at: row.get(6)?,
                })
            })
            .optional()?;
        Ok(key)
    }

    pub fn save_ssh_key(&self, key: &SshKey) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            r#"
            INSERT INTO ssh_keys (id, name, private_key, passphrase, public_key, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                private_key = excluded.private_key,
                passphrase = excluded.passphrase,
                public_key = excluded.public_key,
                updated_at = excluded.updated_at
            "#,
            params![
                key.id,
                key.name,
                key.private_key,
                key.passphrase,
                key.public_key,
                key.created_at,
                key.updated_at,
            ],
        )?;
        Ok(())
    }

    pub fn delete_ssh_key(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM ssh_keys WHERE id = ?1", params![id])?;
        Ok(())
    }
}


