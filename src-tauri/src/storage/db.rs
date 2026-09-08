use rusqlite::{params, Connection, OptionalExtension};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use crate::core::{AppError, AuthType, LayoutPreferences, RecentProject, Result, ServerConfig};

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
            "#,
        )?;

        // Graceful migration for existing databases without proxy columns
        let _ = conn.execute("ALTER TABLE servers ADD COLUMN remote_proxy TEXT", []);
        let _ = conn.execute("ALTER TABLE servers ADD COLUMN remote_no_proxy TEXT", []);

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
}
