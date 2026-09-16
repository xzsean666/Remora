pub mod connection;
pub mod core;
pub mod overview;
pub mod security;
pub mod search;
pub mod sftp;
pub mod storage;
pub mod terminal;
pub mod transfer;

use std::sync::Arc;
use tauri::{Emitter, Manager, State};
use crate::connection::{ConnectionManager, ConnectionState};
use crate::core::{
    AppError, AuthType, FileEntry, LayoutPreferences, QuickSnippet, ReadBinaryFileResult, ReadFileResult, RecentProject, Result,
    ServerConfig, ServerOverview, SshKey, WriteFileResult,
};
use crate::overview::OverviewService;
use crate::search::{SearchParams, SearchResult, SearchService};
use crate::security::KeyringService;
use crate::sftp::SftpService;
use crate::storage::StorageService;
use crate::terminal::TerminalManager;
use crate::transfer::{TransferItem, TransferManager};

pub struct AppState {
    pub storage: StorageService,
    pub keyring: KeyringService,
    pub connection: Arc<ConnectionManager>,
    pub sftp: Arc<SftpService>,
    pub terminal: TerminalManager,
    pub transfer: TransferManager,
    pub overview: Arc<OverviewService>,
}

#[tauri::command]
fn ping(message: String) -> String {
    format!("Backend connected: pong ({})", message)
}

// --- Storage Commands ---

#[tauri::command]
fn get_servers(state: State<'_, Arc<AppState>>) -> Result<Vec<ServerConfig>> {
    state.storage.get_servers()
}

#[tauri::command]
fn save_server(
    server: ServerConfig,
    secret: Option<String>,
    state: State<'_, Arc<AppState>>,
) -> Result<()> {
    state.storage.save_server(&server)?;
    if let Some(sec) = secret {
        state.keyring.set_secret(&server.id, &sec)?;
    }
    Ok(())
}

#[tauri::command]
fn delete_server(id: String, state: State<'_, Arc<AppState>>) -> Result<()> {
    state.storage.delete_server(&id)?;
    let _ = state.keyring.delete_secret(&id);
    Ok(())
}

#[tauri::command]
fn get_recent_projects(limit: usize, state: State<'_, Arc<AppState>>) -> Result<Vec<RecentProject>> {
    state.storage.get_recent_projects(limit)
}

#[tauri::command]
fn add_recent_project(project: RecentProject, state: State<'_, Arc<AppState>>) -> Result<()> {
    state.storage.add_recent_project(&project)
}

#[tauri::command]
fn remove_recent_project(id: String, state: State<'_, Arc<AppState>>) -> Result<()> {
    state.storage.remove_recent_project(&id)
}

#[tauri::command]
fn get_preference(key: String, state: State<'_, Arc<AppState>>) -> Result<Option<String>> {
    state.storage.get_preference(&key)
}

#[tauri::command]
fn set_preference(key: String, value: String, state: State<'_, Arc<AppState>>) -> Result<()> {
    state.storage.set_preference(&key, &value)
}

#[tauri::command]
fn get_layout_preferences(state: State<'_, Arc<AppState>>) -> Result<LayoutPreferences> {
    state.storage.get_layout_preferences()
}

#[tauri::command]
fn set_layout_preferences(
    prefs: LayoutPreferences,
    state: State<'_, Arc<AppState>>,
) -> Result<()> {
    state.storage.set_layout_preferences(&prefs)
}

// --- Quick Snippets Commands ---

#[tauri::command]
fn get_quick_snippets(state: State<'_, Arc<AppState>>) -> Result<Vec<QuickSnippet>> {
    state.storage.get_quick_snippets()
}

#[tauri::command]
fn save_quick_snippet(
    snippet: QuickSnippet,
    state: State<'_, Arc<AppState>>,
) -> Result<()> {
    state.storage.save_quick_snippet(&snippet)
}

#[tauri::command]
fn delete_quick_snippet(id: String, state: State<'_, Arc<AppState>>) -> Result<()> {
    state.storage.delete_quick_snippet(&id)
}

#[tauri::command]
fn delete_quick_snippet_group(group_name: String, state: State<'_, Arc<AppState>>) -> Result<()> {
    state.storage.delete_quick_snippet_group(&group_name)
}

#[tauri::command]
fn rename_quick_snippet_group(
    old_name: String,
    new_name: String,
    state: State<'_, Arc<AppState>>,
) -> Result<()> {
    state.storage.rename_quick_snippet_group(&old_name, &new_name)
}

#[tauri::command]
fn import_quick_snippets(
    snippets: Vec<QuickSnippet>,
    overwrite: bool,
    state: State<'_, Arc<AppState>>,
) -> Result<usize> {
    state.storage.import_quick_snippets(&snippets, overwrite)
}

// --- SSH Key Commands ---

#[tauri::command]
fn get_ssh_keys(state: State<'_, Arc<AppState>>) -> Result<Vec<SshKey>> {
    state.storage.get_ssh_keys()
}

#[tauri::command]
fn get_ssh_key(id: String, state: State<'_, Arc<AppState>>) -> Result<Option<SshKey>> {
    state.storage.get_ssh_key(&id)
}

#[tauri::command]
fn save_ssh_key(key: SshKey, state: State<'_, Arc<AppState>>) -> Result<()> {
    state.storage.save_ssh_key(&key)
}

#[tauri::command]
fn delete_ssh_key(id: String, state: State<'_, Arc<AppState>>) -> Result<()> {
    state.storage.delete_ssh_key(&id)
}

// --- Connection Commands ---

async fn do_connect_server(
    server_id: &str,
    state: &AppState,
    app: Option<&tauri::AppHandle>,
) -> Result<()> {
    state.sftp.close_session(server_id).await;

    let mut server = state
        .storage
        .get_server(server_id)?
        .ok_or_else(|| AppError::NotFound(format!("Server {} not found", server_id)))?;
    let mut secret = state.keyring.get_secret(server_id)?;

    // Resolve saved private key if key_path references a saved key ID
    if server.auth_type == AuthType::PrivateKey {
        if let Some(ref kp) = server.key_path {
            let key_id = kp.strip_prefix("key:").unwrap_or(kp);
            if let Ok(Some(ssh_key)) = state.storage.get_ssh_key(key_id) {
                server.key_path = Some(ssh_key.private_key);
                if secret.is_none() || secret.as_deref() == Some("") {
                    secret = ssh_key.passphrase;
                }
            }
        }
    }

    let res = state
        .connection
        .connect(&server, secret.as_deref())
        .await;

    let current_state = state.connection.get_state(server_id).await;
    if let Some(app) = app {
        let _ = app.emit("connection-state-changed", serde_json::json!({
            "serverId": server_id,
            "state": current_state
        }));
    }

    res
}

async fn ensure_server_connected(
    server_id: &str,
    state: &AppState,
    app: Option<&tauri::AppHandle>,
) -> Result<()> {
    let current_state = state.connection.get_state(server_id).await;
    if current_state != ConnectionState::Connected {
        tracing::info!(
            "Server {} is not connected (state: {:?}), attempting auto-reconnect before SFTP operation",
            server_id,
            current_state
        );
        do_connect_server(server_id, state, app).await?;
    }
    Ok(())
}

#[tauri::command]
async fn connect_server(
    server_id: String,
    state: State<'_, Arc<AppState>>,
    app: tauri::AppHandle,
) -> Result<()> {
    do_connect_server(&server_id, &state, Some(&app)).await
}

#[tauri::command]
async fn disconnect_server(
    server_id: String,
    state: State<'_, Arc<AppState>>,
    app: tauri::AppHandle,
) -> Result<()> {
    state.terminal.close_all_for_server(&server_id).await;
    state.sftp.close_session(&server_id).await;
    state.overview.clear_cache(&server_id).await;
    let res = state.connection.disconnect(&server_id).await;

    let _ = app.emit("connection-state-changed", serde_json::json!({
        "serverId": server_id,
        "state": ConnectionState::Disconnected
    }));

    res
}

#[tauri::command]
async fn reconnect_server(
    server_id: String,
    state: State<'_, Arc<AppState>>,
    app: tauri::AppHandle,
) -> Result<()> {
    state.sftp.close_session(&server_id).await;
    state.connection.reconnect(&server_id, Some(app)).await
}

#[tauri::command]
async fn get_connection_state(
    server_id: String,
    state: State<'_, Arc<AppState>>,
) -> Result<ConnectionState> {
    Ok(state.connection.get_state(&server_id).await)
}

#[tauri::command]
async fn get_all_connection_states(
    state: State<'_, Arc<AppState>>,
) -> Result<std::collections::HashMap<String, ConnectionState>> {
    Ok(state.connection.get_all_states().await)
}

// --- SFTP Commands ---

#[tauri::command]
async fn sftp_read_dir(
    server_id: String,
    path: String,
    state: State<'_, Arc<AppState>>,
    app: tauri::AppHandle,
) -> Result<Vec<FileEntry>> {
    let _ = ensure_server_connected(&server_id, &state, Some(&app)).await;

    match state.sftp.read_dir(&server_id, &path).await {
        Ok(entries) => Ok(entries),
        Err(e) => {
            tracing::warn!(
                "sftp_read_dir initial attempt failed for {} at {}: {}. Attempting auto-reconnect...",
                server_id,
                path,
                e
            );
            state.sftp.close_session(&server_id).await;
            do_connect_server(&server_id, &state, Some(&app)).await?;
            state.sftp.read_dir(&server_id, &path).await
        }
    }
}

#[tauri::command]
async fn sftp_read_file(
    server_id: String,
    path: String,
    state: State<'_, Arc<AppState>>,
    app: tauri::AppHandle,
) -> Result<ReadFileResult> {
    let _ = ensure_server_connected(&server_id, &state, Some(&app)).await;

    match state.sftp.read_file(&server_id, &path).await {
        Ok(res) => Ok(res),
        Err(e) => {
            tracing::warn!(
                "sftp_read_file initial attempt failed for {} at {}: {}. Attempting auto-reconnect...",
                server_id,
                path,
                e
            );
            state.sftp.close_session(&server_id).await;
            do_connect_server(&server_id, &state, Some(&app)).await?;
            state.sftp.read_file(&server_id, &path).await
        }
    }
}

#[tauri::command]
async fn sftp_read_binary_file(
    server_id: String,
    path: String,
    state: State<'_, Arc<AppState>>,
    app: tauri::AppHandle,
) -> Result<ReadBinaryFileResult> {
    let _ = ensure_server_connected(&server_id, &state, Some(&app)).await;

    match state.sftp.read_binary_file(&server_id, &path).await {
        Ok(res) => Ok(res),
        Err(e) => {
            tracing::warn!(
                "sftp_read_binary_file initial attempt failed for {} at {}: {}. Attempting auto-reconnect...",
                server_id,
                path,
                e
            );
            state.sftp.close_session(&server_id).await;
            do_connect_server(&server_id, &state, Some(&app)).await?;
            state.sftp.read_binary_file(&server_id, &path).await
        }
    }
}

#[tauri::command]
async fn sftp_write_file(
    server_id: String,
    path: String,
    content: String,
    expected_mtime: Option<u64>,
    state: State<'_, Arc<AppState>>,
    app: tauri::AppHandle,
) -> Result<WriteFileResult> {
    let _ = ensure_server_connected(&server_id, &state, Some(&app)).await;

    match state
        .sftp
        .write_file(&server_id, &path, &content, expected_mtime)
        .await
    {
        Ok(res) => Ok(res),
        Err(e) => {
            if let AppError::Sftp(ref msg) = e {
                if msg.contains("Conflict detected") {
                    return Err(e);
                }
            }
            tracing::warn!(
                "sftp_write_file initial attempt failed for {} at {}: {}. Attempting auto-reconnect...",
                server_id,
                path,
                e
            );
            state.sftp.close_session(&server_id).await;
            do_connect_server(&server_id, &state, Some(&app)).await?;
            state
                .sftp
                .write_file(&server_id, &path, &content, expected_mtime)
                .await
        }
    }
}

#[tauri::command]
async fn sftp_write_binary_file(
    server_id: String,
    path: String,
    data_base64: String,
    state: State<'_, Arc<AppState>>,
    app: tauri::AppHandle,
) -> Result<()> {
    let _ = ensure_server_connected(&server_id, &state, Some(&app)).await;

    match state
        .sftp
        .write_binary_file(&server_id, &path, &data_base64)
        .await
    {
        Ok(()) => Ok(()),
        Err(e) => {
            tracing::warn!(
                "sftp_write_binary_file initial attempt failed for {} at {}: {}. Attempting auto-reconnect...",
                server_id,
                path,
                e
            );
            state.sftp.close_session(&server_id).await;
            do_connect_server(&server_id, &state, Some(&app)).await?;
            state
                .sftp
                .write_binary_file(&server_id, &path, &data_base64)
                .await
        }
    }
}

pub fn encode_rgba_to_png_base64(width: u32, height: u32, rgba_bytes: &[u8]) -> Result<String> {
    use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
    use base64::Engine;

    let mut png_bytes = Vec::new();
    {
        let mut encoder = png::Encoder::new(&mut png_bytes, width, height);
        encoder.set_color(png::ColorType::Rgba);
        encoder.set_depth(png::BitDepth::Eight);
        let mut writer = encoder
            .write_header()
            .map_err(|e| AppError::Internal(format!("PNG header error: {}", e)))?;
        writer
            .write_image_data(rgba_bytes)
            .map_err(|e| AppError::Internal(format!("PNG write error: {}", e)))?;
    }
    Ok(BASE64_STANDARD.encode(&png_bytes))
}

#[tauri::command]
async fn read_clipboard_image_native() -> Result<Option<String>> {
    tokio::task::spawn_blocking(|| {
        let mut cb = match arboard::Clipboard::new() {
            Ok(cb) => cb,
            Err(e) => {
                tracing::warn!("Failed to initialize native clipboard: {}", e);
                return Ok(None);
            }
        };

        match cb.get_image() {
            Ok(img) => {
                let b64 = encode_rgba_to_png_base64(img.width as u32, img.height as u32, &img.bytes)?;
                Ok(Some(b64))
            }
            Err(arboard::Error::ContentNotAvailable) => Ok(None),
            Err(e) => {
                tracing::debug!("Clipboard does not contain image: {}", e);
                Ok(None)
            }
        }
    })
    .await
    .map_err(|e| AppError::Internal(format!("Clipboard task join error: {}", e)))?
}

#[tauri::command]
async fn sftp_create_file(
    server_id: String,
    path: String,
    state: State<'_, Arc<AppState>>,
    app: tauri::AppHandle,
) -> Result<()> {
    let _ = ensure_server_connected(&server_id, &state, Some(&app)).await;
    match state.sftp.create_file(&server_id, &path).await {
        Ok(()) => Ok(()),
        Err(e) => {
            tracing::warn!(
                "sftp_create_file failed for {} at {}: {}. Attempting auto-reconnect...",
                server_id,
                path,
                e
            );
            state.sftp.close_session(&server_id).await;
            do_connect_server(&server_id, &state, Some(&app)).await?;
            state.sftp.create_file(&server_id, &path).await
        }
    }
}

#[tauri::command]
async fn sftp_create_dir(
    server_id: String,
    path: String,
    state: State<'_, Arc<AppState>>,
    app: tauri::AppHandle,
) -> Result<()> {
    let _ = ensure_server_connected(&server_id, &state, Some(&app)).await;
    match state.sftp.create_dir(&server_id, &path).await {
        Ok(()) => Ok(()),
        Err(e) => {
            tracing::warn!(
                "sftp_create_dir failed for {} at {}: {}. Attempting auto-reconnect...",
                server_id,
                path,
                e
            );
            state.sftp.close_session(&server_id).await;
            do_connect_server(&server_id, &state, Some(&app)).await?;
            state.sftp.create_dir(&server_id, &path).await
        }
    }
}

#[tauri::command]
async fn sftp_rename(
    server_id: String,
    old_path: String,
    new_path: String,
    state: State<'_, Arc<AppState>>,
    app: tauri::AppHandle,
) -> Result<()> {
    let _ = ensure_server_connected(&server_id, &state, Some(&app)).await;
    match state.sftp.rename(&server_id, &old_path, &new_path).await {
        Ok(()) => Ok(()),
        Err(e) => {
            tracing::warn!(
                "sftp_rename failed for {}: {}. Attempting auto-reconnect...",
                server_id,
                e
            );
            state.sftp.close_session(&server_id).await;
            do_connect_server(&server_id, &state, Some(&app)).await?;
            state.sftp.rename(&server_id, &old_path, &new_path).await
        }
    }
}

#[tauri::command]
async fn sftp_remove(
    server_id: String,
    path: String,
    is_dir: bool,
    state: State<'_, Arc<AppState>>,
    app: tauri::AppHandle,
) -> Result<()> {
    let _ = ensure_server_connected(&server_id, &state, Some(&app)).await;
    match state.sftp.remove(&server_id, &path, is_dir).await {
        Ok(()) => Ok(()),
        Err(e) => {
            tracing::warn!(
                "sftp_remove failed for {}: {}. Attempting auto-reconnect...",
                server_id,
                e
            );
            state.sftp.close_session(&server_id).await;
            do_connect_server(&server_id, &state, Some(&app)).await?;
            state.sftp.remove(&server_id, &path, is_dir).await
        }
    }
}

#[tauri::command]
async fn sftp_trash(
    server_id: String,
    path: String,
    state: State<'_, Arc<AppState>>,
    app: tauri::AppHandle,
) -> Result<String> {
    let _ = ensure_server_connected(&server_id, &state, Some(&app)).await;
    match state.sftp.trash(&server_id, &path).await {
        Ok(dest) => Ok(dest),
        Err(e) => {
            tracing::warn!(
                "sftp_trash failed for {}: {}. Attempting auto-reconnect...",
                server_id,
                e
            );
            state.sftp.close_session(&server_id).await;
            do_connect_server(&server_id, &state, Some(&app)).await?;
            state.sftp.trash(&server_id, &path).await
        }
    }
}

#[tauri::command]
async fn sftp_stat(
    server_id: String,
    path: String,
    state: State<'_, Arc<AppState>>,
    app: tauri::AppHandle,
) -> Result<FileEntry> {
    let _ = ensure_server_connected(&server_id, &state, Some(&app)).await;

    match state.sftp.stat(&server_id, &path).await {
        Ok(entry) => Ok(entry),
        Err(e) => {
            tracing::warn!(
                "sftp_stat initial attempt failed for {} at {}: {}. Attempting auto-reconnect...",
                server_id,
                path,
                e
            );
            state.sftp.close_session(&server_id).await;
            do_connect_server(&server_id, &state, Some(&app)).await?;
            state.sftp.stat(&server_id, &path).await
        }
    }
}

// --- Terminal Commands ---

#[tauri::command]
async fn terminal_open(
    server_id: String,
    cols: u32,
    rows: u32,
    initial_dir: Option<String>,
    remote_proxy: Option<String>,
    remote_no_proxy: Option<String>,
    on_data: tauri::ipc::Channel<Vec<u8>>,
    state: State<'_, Arc<AppState>>,
    app: tauri::AppHandle,
) -> Result<String> {
    let server_config = state.storage.get_server(&server_id).ok().flatten();
    let proxy = remote_proxy.or_else(|| server_config.as_ref().and_then(|s| s.remote_proxy.clone()));
    let no_proxy = remote_no_proxy.or_else(|| server_config.as_ref().and_then(|s| s.remote_no_proxy.clone()));

    // If the server connection is not in Connected state, attempt auto-reconnect first
    let current_state = state.connection.get_state(&server_id).await;
    if current_state != ConnectionState::Connected {
        tracing::info!(
            "Server {} is not connected (state: {:?}), attempting auto-reconnect before opening terminal",
            server_id,
            current_state
        );
        do_connect_server(&server_id, &state, Some(&app)).await?;
    }

    let first_try = state
        .terminal
        .open(&server_id, cols, rows, initial_dir.clone(), proxy.clone(), no_proxy.clone(), on_data.clone(), Some(app.clone()))
        .await;

    match first_try {
        Ok(backend_id) => Ok(backend_id),
        Err(e) => {
            tracing::warn!(
                "First attempt to open terminal failed for {}: {}, attempting to reconnect SSH server and retry...",
                server_id,
                e
            );
            do_connect_server(&server_id, &state, Some(&app)).await?;
            state
                .terminal
                .open(&server_id, cols, rows, initial_dir, proxy, no_proxy, on_data, Some(app))
                .await
        }
    }
}

#[tauri::command]
async fn terminal_write(
    session_id: String,
    data: Vec<u8>,
    state: State<'_, Arc<AppState>>,
) -> Result<()> {
    state.terminal.write(&session_id, data).await
}

#[tauri::command]
async fn terminal_resize(
    session_id: String,
    cols: u32,
    rows: u32,
    state: State<'_, Arc<AppState>>,
) -> Result<()> {
    state.terminal.resize(&session_id, cols, rows).await
}

#[tauri::command]
async fn terminal_close(
    session_id: String,
    state: State<'_, Arc<AppState>>,
) -> Result<()> {
    state.terminal.close(&session_id).await
}

// --- Transfer Commands ---

#[tauri::command]
async fn transfer_upload(
    server_id: String,
    local_path: String,
    remote_path: String,
    state: State<'_, Arc<AppState>>,
    app: tauri::AppHandle,
) -> Result<String> {
    state
        .transfer
        .start_upload(&server_id, &local_path, &remote_path, Some(app))
        .await
}

#[tauri::command]
async fn transfer_download(
    server_id: String,
    remote_path: String,
    local_path: Option<String>,
    state: State<'_, Arc<AppState>>,
    app: tauri::AppHandle,
) -> Result<String> {
    let local_path_str = local_path.unwrap_or_default();
    state
        .transfer
        .start_download(&server_id, &remote_path, &local_path_str, Some(app))
        .await
}

#[tauri::command]
fn get_default_download_dir() -> Result<String> {
    let dir = crate::transfer::TransferManager::get_default_download_dir();
    if !dir.exists() {
        let _ = std::fs::create_dir_all(&dir);
    }
    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
async fn open_download_dir<R: tauri::Runtime>(app: tauri::AppHandle<R>) -> Result<String> {
    use tauri_plugin_opener::OpenerExt;
    let dir = crate::transfer::TransferManager::get_default_download_dir();
    if !dir.exists() {
        let _ = std::fs::create_dir_all(&dir);
    }
    let dir_str = dir.to_string_lossy().to_string();
    app.opener()
        .open_path(&dir_str, None::<&str>)
        .map_err(|e| AppError::Internal(format!("Failed to open download folder: {}", e)))?;
    Ok(dir_str)
}

#[tauri::command]
async fn show_item_in_folder<R: tauri::Runtime>(
    path: String,
    app: tauri::AppHandle<R>,
) -> Result<()> {
    use tauri_plugin_opener::OpenerExt;
    let p = std::path::Path::new(&path);
    if p.exists() {
        if p.is_dir() {
            let _ = app.opener().open_path(&path, None::<&str>);
        } else if app.opener().reveal_item_in_dir(p).is_err() {
            if let Some(parent) = p.parent() {
                let _ = app.opener().open_path(parent.to_string_lossy().to_string(), None::<&str>);
            }
        }
    } else if let Some(parent) = p.parent() {
        if parent.exists() {
            let _ = app.opener().open_path(parent.to_string_lossy().to_string(), None::<&str>);
        } else {
            let default_dir = crate::transfer::TransferManager::get_default_download_dir();
            let _ = app.opener().open_path(default_dir.to_string_lossy().to_string(), None::<&str>);
        }
    }
    Ok(())
}

#[tauri::command]
async fn transfer_cancel(
    task_id: String,
    state: State<'_, Arc<AppState>>,
) -> Result<()> {
    state.transfer.cancel_transfer(&task_id).await
}

#[tauri::command]
async fn transfer_list(
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<TransferItem>> {
    Ok(state.transfer.list_transfers().await)
}

// --- TMUX Management Commands ---

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct TmuxSessionInfo {
    pub name: String,
    pub windows: u32,
    pub attached: bool,
    pub created_at: i64,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct TmuxListResult {
    pub installed: bool,
    pub sessions: Vec<TmuxSessionInfo>,
    pub error: Option<String>,
}

#[tauri::command]
async fn tmux_list_sessions(
    server_id: String,
    state: State<'_, Arc<AppState>>,
) -> Result<TmuxListResult> {
    let script = r##"if ! command -v tmux >/dev/null 2>&1; then echo "NOT_INSTALLED"; else echo "INSTALLED"; tmux list-sessions -F "#{session_name}|#{session_windows}|#{session_attached}|#{session_created}" 2>/dev/null || true; fi"##;
    let output = match state.connection.exec_command(&server_id, script).await {
        Ok(out) => out,
        Err(e) => {
            return Ok(TmuxListResult {
                installed: false,
                sessions: vec![],
                error: Some(e.to_string()),
            });
        }
    };

    let mut lines = output.lines();
    let first_line = lines.next().unwrap_or("").trim();

    if first_line == "NOT_INSTALLED" {
        return Ok(TmuxListResult {
            installed: false,
            sessions: vec![],
            error: None,
        });
    }

    let mut sessions = Vec::new();
    for line in lines {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let parts: Vec<&str> = line.split('|').collect();
        if parts.len() >= 4 {
            let name = parts[0].to_string();
            let windows = parts[1].parse::<u32>().unwrap_or(1);
            let attached = parts[2] == "1" || parts[2].eq_ignore_ascii_case("true");
            let created_at = parts[3].parse::<i64>().unwrap_or(0);
            sessions.push(TmuxSessionInfo {
                name,
                windows,
                attached,
                created_at,
            });
        }
    }

    Ok(TmuxListResult {
        installed: true,
        sessions,
        error: None,
    })
}

#[tauri::command]
async fn tmux_kill_session(
    server_id: String,
    session_name: String,
    state: State<'_, Arc<AppState>>,
) -> Result<()> {
    let safe_name = session_name.replace(['"', '\'', ';', '&', '|', '`', '$', '\n', '\r'], "");
    let cmd = format!("tmux kill-session -t \"{}\" 2>/dev/null || true", safe_name);
    state.connection.exec_command(&server_id, &cmd).await?;
    Ok(())
}

#[tauri::command]
async fn tmux_new_session(
    server_id: String,
    session_name: String,
    initial_dir: Option<String>,
    state: State<'_, Arc<AppState>>,
) -> Result<()> {
    let safe_name = session_name.replace(['"', '\'', ';', '&', '|', '`', '$', '\n', '\r'], "");
    let mut cmd = format!("tmux new-session -d -s \"{}\"", safe_name);
    if let Some(ref dir) = initial_dir {
        let trimmed = dir.trim();
        if !trimmed.is_empty() {
            let safe_dir = trimmed.replace(['"', '\'', ';', '&', '|', '`', '$', '\n', '\r'], "");
            cmd.push_str(&format!(" -c \"{}\"", safe_dir));
        }
    }
    cmd.push_str(" \\; set -g mouse on \\; unbind-key -n MouseDown3Pane \\; unbind-key -n MouseDown3Status \\; unbind-key -n MouseDown3StatusLeft \\; unbind-key -n M-MouseDown3Pane");
    state.connection.exec_command(&server_id, &cmd).await?;
    Ok(())
}

// --- Git Integration Commands ---

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct GitFileChange {
    pub path: String,
    pub status: String,
    pub staged: bool,
    pub raw_status: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct GitStatusResult {
    pub is_repo: bool,
    pub current_branch: Option<String>,
    pub branches: Vec<String>,
    pub changes: Vec<GitFileChange>,
    pub ignored: Vec<String>,
    pub error: Option<String>,
}

#[tauri::command]
async fn git_get_status(
    server_id: String,
    repo_path: String,
    state: State<'_, Arc<AppState>>,
) -> Result<GitStatusResult> {
    let safe_path = repo_path.replace(['"', '\'', ';', '&', '|', '`', '$', '\n', '\r'], "");
    let cmd = format!(
        r#"if git -C "{path}" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "===IS_REPO==="
    git -C "{path}" branch --show-current 2>/dev/null || git -C "{path}" rev-parse --abbrev-ref HEAD 2>/dev/null
    echo "===BRANCHES==="
    git -C "{path}" branch --list --no-color 2>/dev/null
    echo "===STATUS==="
    git -C "{path}" status --porcelain=v1 -uall 2>/dev/null
    echo "===IGNORED==="
    git -C "{path}" status --porcelain=v1 --ignored 2>/dev/null | grep '^!!' || true
else
    echo "===NOT_REPO==="
fi"#,
        path = safe_path
    );

    let output = match state.connection.exec_command(&server_id, &cmd).await {
        Ok(out) => out,
        Err(e) => {
            return Ok(GitStatusResult {
                is_repo: false,
                current_branch: None,
                branches: Vec::new(),
                changes: Vec::new(),
                ignored: Vec::new(),
                error: Some(e.to_string()),
            });
        }
    };

    if output.contains("===NOT_REPO===") || !output.contains("===IS_REPO===") {
        return Ok(GitStatusResult {
            is_repo: false,
            current_branch: None,
            branches: Vec::new(),
            changes: Vec::new(),
            ignored: Vec::new(),
            error: None,
        });
    }

    let mut current_branch = None;
    let mut branches = Vec::new();
    let mut changes = Vec::new();
    let mut ignored = Vec::new();

    let mut section = "";
    for line in output.lines() {
        let trimmed = line.trim();
        if trimmed == "===IS_REPO===" {
            section = "branch";
            continue;
        } else if trimmed == "===BRANCHES===" {
            section = "branches";
            continue;
        } else if trimmed == "===STATUS===" {
            section = "status";
            continue;
        } else if trimmed == "===IGNORED===" {
            section = "ignored";
            continue;
        }

        match section {
            "branch" => {
                if !trimmed.is_empty() && current_branch.is_none() {
                    current_branch = Some(trimmed.to_string());
                }
            }
            "branches" => {
                if !trimmed.is_empty() {
                    let clean_branch = trimmed.trim_start_matches('*').trim();
                    if !clean_branch.is_empty() && !branches.contains(&clean_branch.to_string()) {
                        branches.push(clean_branch.to_string());
                    }
                }
            }
            "status" => {
                if line.len() >= 4 {
                    let raw_code = &line[0..2];
                    let mut file_path = line[3..].trim().to_string();
                    if let Some(pos) = file_path.find(" -> ") {
                        file_path = file_path[pos + 4..].trim().to_string();
                    }
                    file_path = file_path.trim_matches('"').to_string();

                    let (status_type, staged) = if raw_code == "??" {
                        ("U".to_string(), false)
                    } else if raw_code.starts_with('A') {
                        ("A".to_string(), true)
                    } else if raw_code.starts_with('D') {
                        ("D".to_string(), true)
                    } else if raw_code.ends_with('D') {
                        ("D".to_string(), false)
                    } else if raw_code.starts_with('R') {
                        ("R".to_string(), true)
                    } else if raw_code.starts_with('M') {
                        ("M".to_string(), true)
                    } else {
                        ("M".to_string(), false)
                    };

                    changes.push(GitFileChange {
                        path: file_path,
                        status: status_type,
                        staged,
                        raw_status: raw_code.to_string(),
                    });
                }
            }
            "ignored" => {
                if line.starts_with("!! ") {
                    let mut ign_path = line[3..].trim().to_string();
                    ign_path = ign_path.trim_matches('"').trim_end_matches('/').to_string();
                    if !ign_path.is_empty() && !ignored.contains(&ign_path) {
                        ignored.push(ign_path);
                    }
                }
            }
            _ => {}
        }
    }

    if branches.is_empty() {
        if let Some(ref cur) = current_branch {
            if !cur.is_empty() && cur != "HEAD" {
                branches.push(cur.clone());
            }
        }
    }

    Ok(GitStatusResult {
        is_repo: true,
        current_branch,
        branches,
        changes,
        ignored,
        error: None,
    })
}

#[tauri::command]
async fn git_checkout(
    server_id: String,
    repo_path: String,
    branch: String,
    create_new: Option<bool>,
    state: State<'_, Arc<AppState>>,
) -> Result<String> {
    let safe_path = repo_path.replace(['"', '\'', ';', '&', '|', '`', '$', '\n', '\r'], "");
    let safe_branch = branch.replace(['"', '\'', ';', '&', '|', '`', '$', '\n', '\r', ' '], "");
    let cmd = if create_new.unwrap_or(false) {
        format!("git -C \"{}\" checkout -b \"{}\"", safe_path, safe_branch)
    } else {
        format!("git -C \"{}\" checkout \"{}\"", safe_path, safe_branch)
    };

    let output = state.connection.exec_command(&server_id, &cmd).await?;
    Ok(output)
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct GhAuthStatus {
    pub is_installed: bool,
    pub active_account: Option<String>,
    pub accounts: Vec<String>,
    pub error: Option<String>,
}

pub fn parse_gh_auth_status(output: &str) -> GhAuthStatus {
    let lower = output.to_lowercase();
    if lower.contains("command not found") || lower.contains("not found") || lower.contains("no such file") {
        return GhAuthStatus {
            is_installed: false,
            active_account: None,
            accounts: Vec::new(),
            error: Some("GitHub CLI (gh) 未在远端服务器安装".to_string()),
        };
    }

    let mut accounts = Vec::new();
    let mut active_account = None;
    let mut current_account: Option<String> = None;

    for line in output.lines() {
        let trimmed = line.trim();
        if let Some(pos) = trimmed.find("account ") {
            let rest = &trimmed[pos + 8..];
            let username = rest
                .split_whitespace()
                .next()
                .unwrap_or("")
                .trim_matches('(')
                .trim_matches(')')
                .trim_matches('\'')
                .trim_matches('"');
            if !username.is_empty() {
                let user_str = username.to_string();
                if !accounts.contains(&user_str) {
                    accounts.push(user_str.clone());
                }
                current_account = Some(user_str);
            }
        }

        if trimmed.contains("Active account: true") {
            if let Some(ref cur) = current_account {
                active_account = Some(cur.clone());
            }
        }
    }

    if active_account.is_none() && accounts.len() == 1 {
        active_account = Some(accounts[0].clone());
    }

    GhAuthStatus {
        is_installed: true,
        active_account,
        accounts,
        error: None,
    }
}

#[tauri::command]
async fn gh_get_auth_status(
    server_id: String,
    state: State<'_, Arc<AppState>>,
) -> Result<GhAuthStatus> {
    let output = match state
        .connection
        .exec_command_with_timeout(&server_id, "gh auth status 2>&1", std::time::Duration::from_secs(10))
        .await
    {
        Ok(out) => out,
        Err(e) => {
            return Ok(GhAuthStatus {
                is_installed: false,
                active_account: None,
                accounts: Vec::new(),
                error: Some(e.to_string()),
            });
        }
    };

    Ok(parse_gh_auth_status(&output))
}

#[tauri::command]
async fn gh_switch_account(
    server_id: String,
    username: String,
    state: State<'_, Arc<AppState>>,
) -> Result<GhAuthStatus> {
    let safe_username: String = username
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_' || *c == '.')
        .collect();
    if safe_username.is_empty() {
        return Err(AppError::InvalidArgument("Invalid GitHub username".to_string()));
    }

    let cmd = format!("gh auth switch --user \"{}\" 2>&1", safe_username);
    let _ = state
        .connection
        .exec_command_with_timeout(&server_id, &cmd, std::time::Duration::from_secs(10))
        .await?;

    gh_get_auth_status(server_id, state).await
}

#[tauri::command]
async fn git_get_diff(
    server_id: String,
    repo_path: String,
    file_path: String,
    state: State<'_, Arc<AppState>>,
) -> Result<String> {
    let safe_path = repo_path.replace(['"', '\'', ';', '&', '|', '`', '$', '\n', '\r'], "");
    let safe_file = file_path.replace(['"', '\'', ';', '&', '|', '`', '$', '\n', '\r'], "");
    let cmd = format!(
        "git -C \"{path}\" diff HEAD -- \"{file}\" 2>/dev/null || git -C \"{path}\" diff --cached -- \"{file}\" 2>/dev/null || git -C \"{path}\" diff -- \"{file}\" 2>&1",
        path = safe_path,
        file = safe_file
    );

    let output = state.connection.exec_command(&server_id, &cmd).await?;
    Ok(output)
}

#[tauri::command]
async fn git_commit(
    server_id: String,
    repo_path: String,
    message: String,
    stage_all: Option<bool>,
    state: State<'_, Arc<AppState>>,
) -> Result<String> {
    if message.trim().is_empty() {
        return Err(AppError::InvalidArgument("Commit message cannot be empty".to_string()));
    }
    let safe_path = repo_path.replace(['"', '\'', ';', '&', '|', '`', '$', '\n', '\r'], "");
    use base64::Engine;
    let b64_msg = base64::prelude::BASE64_STANDARD.encode(message.as_bytes());

    let do_stage = stage_all.unwrap_or(true);
    let stage_part = if do_stage {
        format!("git -C \"{}\" add -A 2>&1 || true\n", safe_path)
    } else {
        String::new()
    };

    let cmd = format!(
        r#"
if ! git -C "{path}" config user.name >/dev/null 2>&1; then
    GH_USER=$(gh api user --jq .login 2>/dev/null || echo "")
    if [ -n "$GH_USER" ]; then
        git -C "{path}" config user.name "$GH_USER"
    elif [[ "{path}" == *"/ssd0/git"* ]]; then
        git -C "{path}" config user.name "xzsean666"
    elif [[ "{path}" == *"/ssd0/ems"* ]]; then
        git -C "{path}" config user.name "0xcube-666"
    fi
fi
if ! git -C "{path}" config user.email >/dev/null 2>&1; then
    GH_EMAIL=$(gh api user --jq '"\(.id)+\(.login)@users.noreply.github.com"' 2>/dev/null || echo "")
    if [ -n "$GH_EMAIL" ]; then
        git -C "{path}" config user.email "$GH_EMAIL"
    else
        GH_USER=$(git -C "{path}" config user.name 2>/dev/null || echo "")
        if [ "$GH_USER" = "xzsean666" ]; then
            git -C "{path}" config user.email "85156828+xzsean666@users.noreply.github.com"
        elif [ "$GH_USER" = "0xcube-666" ]; then
            git -C "{path}" config user.email "312491237+0xcube-666@users.noreply.github.com"
        elif [ -n "$GH_USER" ]; then
            git -C "{path}" config user.email "${{GH_USER}}@users.noreply.github.com"
        fi
    fi
fi
{stage_part}echo "{b64}" | base64 -d | git -C "{path}" commit -F - 2>&1
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
    echo "===REMORA_GIT_ERR:$EXIT_CODE==="
fi
"#,
        path = safe_path,
        stage_part = stage_part,
        b64 = b64_msg
    );

    let output = state
        .connection
        .exec_command_with_timeout(&server_id, &cmd, std::time::Duration::from_secs(15))
        .await?;

    if let Some(pos) = output.find("===REMORA_GIT_ERR:") {
        let err_detail = output[..pos].trim();
        return Err(AppError::Internal(if err_detail.is_empty() {
            "Git commit 失败 (未知错误)".to_string()
        } else {
            err_detail.to_string()
        }));
    }

    Ok(output)
}

#[tauri::command]
async fn git_push(
    server_id: String,
    repo_path: String,
    state: State<'_, Arc<AppState>>,
) -> Result<String> {
    let safe_path = repo_path.replace(['"', '\'', ';', '&', '|', '`', '$', '\n', '\r'], "");
    let cmd = format!(
        r#"
(git -C "{path}" push 2>&1 || git -C "{path}" push -u origin HEAD 2>&1)
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
    echo "===REMORA_GIT_ERR:$EXIT_CODE==="
fi
"#,
        path = safe_path
    );
    let output = state
        .connection
        .exec_command_with_timeout(&server_id, &cmd, std::time::Duration::from_secs(35))
        .await?;

    if let Some(pos) = output.find("===REMORA_GIT_ERR:") {
        let err_detail = output[..pos].trim();
        return Err(AppError::Internal(if err_detail.is_empty() {
            "Git push 失败".to_string()
        } else {
            err_detail.to_string()
        }));
    }

    Ok(output)
}

#[tauri::command]
async fn git_pull(
    server_id: String,
    repo_path: String,
    state: State<'_, Arc<AppState>>,
) -> Result<String> {
    let safe_path = repo_path.replace(['"', '\'', ';', '&', '|', '`', '$', '\n', '\r'], "");
    let cmd = format!(
        r#"
git -C "{path}" pull 2>&1
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
    echo "===REMORA_GIT_ERR:$EXIT_CODE==="
fi
"#,
        path = safe_path
    );
    let output = state
        .connection
        .exec_command_with_timeout(&server_id, &cmd, std::time::Duration::from_secs(35))
        .await?;

    if let Some(pos) = output.find("===REMORA_GIT_ERR:") {
        let err_detail = output[..pos].trim();
        return Err(AppError::Internal(if err_detail.is_empty() {
            "Git pull 失败".to_string()
        } else {
            err_detail.to_string()
        }));
    }

    Ok(output)
}

#[tauri::command]
async fn git_sync(
    server_id: String,
    repo_path: String,
    state: State<'_, Arc<AppState>>,
) -> Result<String> {
    let safe_path = repo_path.replace(['"', '\'', ';', '&', '|', '`', '$', '\n', '\r'], "");
    let cmd = format!(
        r#"
(git -C "{path}" pull 2>&1 && (git -C "{path}" push 2>&1 || git -C "{path}" push -u origin HEAD 2>&1))
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
    echo "===REMORA_GIT_ERR:$EXIT_CODE==="
fi
"#,
        path = safe_path
    );
    let output = state
        .connection
        .exec_command_with_timeout(&server_id, &cmd, std::time::Duration::from_secs(45))
        .await?;

    if let Some(pos) = output.find("===REMORA_GIT_ERR:") {
        let err_detail = output[..pos].trim();
        return Err(AppError::Internal(if err_detail.is_empty() {
            "Git sync 失败".to_string()
        } else {
            err_detail.to_string()
        }));
    }

    Ok(output)
}

#[tauri::command]
async fn git_get_summary_diff(
    server_id: String,
    repo_path: String,
    state: State<'_, Arc<AppState>>,
) -> Result<String> {
    let safe_path = repo_path.replace(['"', '\'', ';', '&', '|', '`', '$', '\n', '\r'], "");
    let cmd = format!(
        r#"echo "===STATUS==="; git -C "{path}" status --short 2>&1; echo "===DIFF==="; (git -C "{path}" diff HEAD 2>/dev/null || git -C "{path}" diff --cached 2>/dev/null || git -C "{path}" diff 2>/dev/null) | head -c 4000"#,
        path = safe_path
    );
    let output = state
        .connection
        .exec_command_with_timeout(&server_id, &cmd, std::time::Duration::from_secs(10))
        .await?;
    Ok(output)
}

// --- Server Overview Command ---

#[tauri::command]
async fn get_server_overview(
    server_id: String,
    state: State<'_, Arc<AppState>>,
) -> Result<ServerOverview> {
    state.overview.get_overview(&server_id).await
}

// --- Search Command ---

#[tauri::command]
async fn search_in_files(
    params: SearchParams,
    state: State<'_, Arc<AppState>>,
) -> Result<SearchResult> {
    SearchService::search_in_files(&state.connection, params).await
}

// --- Window & Lifecycle Commands ---

pub fn open_new_window(app: &tauri::AppHandle) -> Result<()> {
    #[cfg(desktop)]
    {
        let window_id = format!("window-{}", uuid::Uuid::new_v4());
        tauri::WebviewWindowBuilder::new(
            app,
            &window_id,
            tauri::WebviewUrl::App("index.html?new_window=1".into()),
        )
        .title("Remora")
        .inner_size(1280.0, 800.0)
        .min_inner_size(800.0, 600.0)
        .resizable(true)
        .decorations(true)
        .build()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    }
    #[cfg(not(desktop))]
    {
        let _ = app;
    }
    Ok(())
}

#[tauri::command]
async fn create_new_window(app: tauri::AppHandle) -> Result<()> {
    open_new_window(&app)
}

#[derive(serde::Serialize)]
pub struct AppUpdateMetadata {
    pub available: bool,
    pub current_version: String,
    pub latest_version: Option<String>,
    pub body: Option<String>,
    pub date: Option<String>,
}

#[tauri::command]
async fn check_update(app: tauri::AppHandle) -> Result<AppUpdateMetadata> {
    use tauri_plugin_updater::UpdaterExt;
    let current_version = app.package_info().version.to_string();

    match app.updater() {
        Ok(updater) => match updater.check().await {
            Ok(Some(update)) => Ok(AppUpdateMetadata {
                available: true,
                current_version,
                latest_version: Some(update.version.clone()),
                body: update.body.clone(),
                date: update.date.map(|d| d.to_string()),
            }),
            Ok(None) => Ok(AppUpdateMetadata {
                available: false,
                current_version,
                latest_version: None,
                body: None,
                date: None,
            }),
            Err(e) => {
                tracing::warn!("Failed to check for updates: {}", e);
                Ok(AppUpdateMetadata {
                    available: false,
                    current_version,
                    latest_version: None,
                    body: None,
                    date: None,
                })
            }
        },
        Err(e) => {
            tracing::warn!("Updater not configured: {}", e);
            Ok(AppUpdateMetadata {
                available: false,
                current_version,
                latest_version: None,
                body: None,
                date: None,
            })
        }
    }
}

#[tauri::command]
async fn install_update(app: tauri::AppHandle) -> Result<()> {
    use tauri_plugin_updater::UpdaterExt;
    let updater = app.updater().map_err(|e| AppError::Internal(e.to_string()))?;
    if let Some(update) = updater.check().await.map_err(|e| AppError::Internal(e.to_string()))? {
        update
            .download_and_install(|_chunk, _total| {}, || {})
            .await
            .map_err(|e| AppError::Internal(e.to_string()))?;
        app.restart();
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default();
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            tracing::info!("Single instance notification received: {:?}", argv);
            let has_new_window_arg = argv.iter().any(|arg| arg == "--new-window" || arg == "-n");
            if has_new_window_arg {
                let _ = open_new_window(app);
            } else if let Some(window) = app.webview_windows().values().next() {
                let _ = window.show();
                let _ = window.set_focus();
            } else {
                let _ = open_new_window(app);
            }
        }));
    }

    builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            // 获取 Tauri 2 官方标准跨平台应用持久化数据沙盒目录（Android 下为 /data/user/0/com.remora.app/files）
            let app_data_dir = match app.path().app_data_dir() {
                Ok(dir) => dir,
                Err(e) => {
                    tracing::warn!(
                        "Failed to resolve app_data_dir from Tauri: {}, falling back to default",
                        e
                    );
                    StorageService::default_db_path()
                        .parent()
                        .map(|p| p.to_path_buf())
                        .unwrap_or_else(|| std::path::PathBuf::from("."))
                }
            };

            if let Err(e) = std::fs::create_dir_all(&app_data_dir) {
                tracing::warn!("Failed to create app_data_dir {:?}: {}", app_data_dir, e);
            }

            let db_path = app_data_dir.join("remora.db");
            StorageService::migrate_legacy_db(&db_path);

            tracing::info!("Initializing Remora SQLite database at: {:?}", db_path);
            let storage = match StorageService::new(&db_path) {
                Ok(s) => s,
                Err(e) => {
                    tracing::error!(
                        "Failed to open SQLite database at {:?}: {}, falling back to in-memory",
                        db_path,
                        e
                    );
                    StorageService::new_in_memory().expect("in-memory fallback failed")
                }
            };

            let keyring = KeyringService::with_data_dir(app_data_dir);
            let connection = Arc::new(ConnectionManager::new());
            let sftp = Arc::new(SftpService::new(connection.clone()));
            let terminal = TerminalManager::new(connection.clone());
            let transfer = TransferManager::new(sftp.clone());
            let overview = Arc::new(OverviewService::new(connection.clone()));

            let app_state = Arc::new(AppState {
                storage,
                keyring,
                connection,
                sftp,
                terminal,
                transfer,
                overview,
            });

            app.manage(app_state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ping,
            create_new_window,
            check_update,
            install_update,
            get_servers,
            save_server,
            delete_server,
            get_ssh_keys,
            get_ssh_key,
            save_ssh_key,
            delete_ssh_key,
            get_recent_projects,
            add_recent_project,
            remove_recent_project,
            get_preference,
            set_preference,
            get_layout_preferences,
            set_layout_preferences,
            connect_server,
            disconnect_server,
            reconnect_server,
            get_connection_state,
            get_all_connection_states,
            sftp_read_dir,
            sftp_read_file,
            sftp_read_binary_file,
            sftp_write_file,
            sftp_write_binary_file,
            read_clipboard_image_native,
            sftp_create_file,
            sftp_create_dir,
            sftp_rename,
            sftp_remove,
            sftp_trash,
            sftp_stat,
            terminal_open,
            terminal_write,
            terminal_resize,
            terminal_close,
            transfer_upload,
            transfer_download,
            transfer_cancel,
            transfer_list,
            get_default_download_dir,
            open_download_dir,
            show_item_in_folder,
            get_quick_snippets,
            save_quick_snippet,
            delete_quick_snippet,
            delete_quick_snippet_group,
            rename_quick_snippet_group,
            import_quick_snippets,
            tmux_list_sessions,
            tmux_kill_session,
            tmux_new_session,
            git_get_status,
            git_checkout,
            git_get_diff,
            git_commit,
            git_push,
            git_pull,
            git_sync,
            git_get_summary_diff,
            gh_get_auth_status,
            gh_switch_account,
            get_server_overview,
            search_in_files
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encode_rgba_to_png_base64() {
        use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
        use base64::Engine;

        // 2x2 RGBA image (red, green, blue, white)
        let rgba = vec![
            255, 0, 0, 255,   // Red
            0, 255, 0, 255,   // Green
            0, 0, 255, 255,   // Blue
            255, 255, 255, 255, // White
        ];
        let res = encode_rgba_to_png_base64(2, 2, &rgba).expect("encode failed");
        assert!(!res.is_empty());

        let decoded = BASE64_STANDARD.decode(&res).expect("decode failed");
        // PNG magic number: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
        assert_eq!(&decoded[0..8], b"\x89PNG\r\n\x1a\n");
    }

    #[test]
    fn test_parse_gh_auth_status() {
        let sample = r#"
github.com
  ✓ Logged in to github.com account 0xcube-666 (/root/.config/gh/hosts.yml)
  - Active account: false
  - Git operations protocol: https

  ✓ Logged in to github.com account xzsean666 (/root/.config/gh/hosts.yml)
  - Active account: true
  - Git operations protocol: https
"#;
        let status = parse_gh_auth_status(sample);
        assert!(status.is_installed);
        assert_eq!(status.active_account.as_deref(), Some("xzsean666"));
        assert_eq!(status.accounts, vec!["0xcube-666".to_string(), "xzsean666".to_string()]);
        assert!(status.error.is_none());
    }

    #[test]
    fn test_parse_gh_not_installed() {
        let sample = "bash: line 1: gh: command not found";
        let status = parse_gh_auth_status(sample);
        assert!(!status.is_installed);
        assert!(status.active_account.is_none());
        assert!(status.accounts.is_empty());
        assert!(status.error.is_some());
    }
}
