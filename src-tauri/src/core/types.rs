use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AuthType {
    Password,
    PrivateKey,
    Agent,
}

impl AuthType {
    pub fn as_str(&self) -> &'static str {
        match self {
            AuthType::Password => "password",
            AuthType::PrivateKey => "private_key",
            AuthType::Agent => "agent",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "password" => AuthType::Password,
            "private_key" => AuthType::PrivateKey,
            "agent" => AuthType::Agent,
            _ => AuthType::Password,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_type: AuthType,
    pub key_path: Option<String>,
    pub default_workspace: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub server_id: String,
    pub name: String,
    pub remote_path: String,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentProject {
    pub id: String,
    pub server_id: String,
    pub server_name: String,
    pub project_name: String,
    pub remote_path: String,
    pub last_opened_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LayoutPreferences {
    pub sidebar_width: Option<u32>,
    pub terminal_height: Option<u32>,
    pub sidebar_visible: Option<bool>,
    pub terminal_visible: Option<bool>,
    pub active_sidebar_tab: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_symlink: bool,
    pub size: u64,
    pub mtime: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReadFileResult {
    pub content: String,
    pub mtime: u64,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WriteFileResult {
    pub success: bool,
    pub new_mtime: u64,
}
