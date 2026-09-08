pub mod connection;
pub mod core;
pub mod security;
pub mod sftp;
pub mod storage;
pub mod terminal;
pub mod transfer;

use std::sync::Arc;
use tauri::{Emitter, State};
use crate::connection::{ConnectionManager, ConnectionState};
use crate::core::{
    AppError, FileEntry, LayoutPreferences, ReadFileResult, RecentProject, Result,
    ServerConfig, WriteFileResult,
};
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

// --- Connection Commands ---

#[tauri::command]
async fn connect_server(
    server_id: String,
    state: State<'_, Arc<AppState>>,
    app: tauri::AppHandle,
) -> Result<()> {
    let server = state
        .storage
        .get_server(&server_id)?
        .ok_or_else(|| AppError::NotFound(format!("Server {} not found", server_id)))?;
    let secret = state.keyring.get_secret(&server_id)?;
    let res = state
        .connection
        .connect(&server, secret.as_deref())
        .await;

    let current_state = state.connection.get_state(&server_id).await;
    let _ = app.emit("connection-state-changed", serde_json::json!({
        "serverId": server_id,
        "state": current_state
    }));

    res
}

#[tauri::command]
async fn disconnect_server(
    server_id: String,
    state: State<'_, Arc<AppState>>,
    app: tauri::AppHandle,
) -> Result<()> {
    state.terminal.close_all_for_server(&server_id).await;
    state.sftp.close_session(&server_id).await;
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
    state.connection.reconnect(&server_id, Some(app)).await
}

#[tauri::command]
async fn get_connection_state(
    server_id: String,
    state: State<'_, Arc<AppState>>,
) -> Result<ConnectionState> {
    Ok(state.connection.get_state(&server_id).await)
}

// --- SFTP Commands ---

#[tauri::command]
async fn sftp_read_dir(
    server_id: String,
    path: String,
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<FileEntry>> {
    state.sftp.read_dir(&server_id, &path).await
}

#[tauri::command]
async fn sftp_read_file(
    server_id: String,
    path: String,
    state: State<'_, Arc<AppState>>,
) -> Result<ReadFileResult> {
    state.sftp.read_file(&server_id, &path).await
}

#[tauri::command]
async fn sftp_write_file(
    server_id: String,
    path: String,
    content: String,
    expected_mtime: Option<u64>,
    state: State<'_, Arc<AppState>>,
) -> Result<WriteFileResult> {
    state
        .sftp
        .write_file(&server_id, &path, &content, expected_mtime)
        .await
}

#[tauri::command]
async fn sftp_create_file(
    server_id: String,
    path: String,
    state: State<'_, Arc<AppState>>,
) -> Result<()> {
    state.sftp.create_file(&server_id, &path).await
}

#[tauri::command]
async fn sftp_create_dir(
    server_id: String,
    path: String,
    state: State<'_, Arc<AppState>>,
) -> Result<()> {
    state.sftp.create_dir(&server_id, &path).await
}

#[tauri::command]
async fn sftp_rename(
    server_id: String,
    old_path: String,
    new_path: String,
    state: State<'_, Arc<AppState>>,
) -> Result<()> {
    state.sftp.rename(&server_id, &old_path, &new_path).await
}

#[tauri::command]
async fn sftp_remove(
    server_id: String,
    path: String,
    is_dir: bool,
    state: State<'_, Arc<AppState>>,
) -> Result<()> {
    state.sftp.remove(&server_id, &path, is_dir).await
}

#[tauri::command]
async fn sftp_stat(
    server_id: String,
    path: String,
    state: State<'_, Arc<AppState>>,
) -> Result<FileEntry> {
    state.sftp.stat(&server_id, &path).await
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
) -> Result<String> {
    let server_config = state.storage.get_server(&server_id).ok().flatten();
    let proxy = remote_proxy.or_else(|| server_config.as_ref().and_then(|s| s.remote_proxy.clone()));
    let no_proxy = remote_no_proxy.or_else(|| server_config.as_ref().and_then(|s| s.remote_no_proxy.clone()));

    state
        .terminal
        .open(&server_id, cols, rows, initial_dir, proxy, no_proxy, on_data)
        .await
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
    local_path: String,
    state: State<'_, Arc<AppState>>,
    app: tauri::AppHandle,
) -> Result<String> {
    state
        .transfer
        .start_download(&server_id, &remote_path, &local_path, Some(app))
        .await
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db_path = StorageService::default_db_path();
    let storage = StorageService::new(db_path)
        .unwrap_or_else(|_| StorageService::new_in_memory().expect("in-memory fallback failed"));
    let keyring = KeyringService::new();
    let connection = Arc::new(ConnectionManager::new());
    let sftp = Arc::new(SftpService::new(connection.clone()));
    let terminal = TerminalManager::new(connection.clone());
    let transfer = TransferManager::new(sftp.clone());

    let app_state = Arc::new(AppState {
        storage,
        keyring,
        connection,
        sftp,
        terminal,
        transfer,
    });

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            ping,
            get_servers,
            save_server,
            delete_server,
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
            sftp_read_dir,
            sftp_read_file,
            sftp_write_file,
            sftp_create_file,
            sftp_create_dir,
            sftp_rename,
            sftp_remove,
            sftp_stat,
            terminal_open,
            terminal_write,
            terminal_resize,
            terminal_close,
            transfer_upload,
            transfer_download,
            transfer_cancel,
            transfer_list
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
