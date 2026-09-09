pub mod connection;
pub mod core;
pub mod security;
pub mod sftp;
pub mod storage;
pub mod terminal;
pub mod transfer;

use std::sync::Arc;
use tauri::{Emitter, Manager, State};
use crate::connection::{ConnectionManager, ConnectionState};
use crate::core::{
    AppError, AuthType, FileEntry, LayoutPreferences, QuickSnippet, ReadFileResult, RecentProject, Result,
    ServerConfig, SshKey, WriteFileResult,
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
async fn sftp_trash(
    server_id: String,
    path: String,
    state: State<'_, Arc<AppState>>,
) -> Result<String> {
    state.sftp.trash(&server_id, &path).await
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
    state: State<'_, Arc<AppState>>,
) -> Result<()> {
    let safe_name = session_name.replace(['"', '\'', ';', '&', '|', '`', '$', '\n', '\r'], "");
    let cmd = format!("tmux new-session -d -s \"{}\"", safe_name);
    state.connection.exec_command(&server_id, &cmd).await?;
    Ok(())
}

// --- Window & Lifecycle Commands ---

pub fn open_new_window(app: &tauri::AppHandle) -> Result<()> {
    #[cfg(desktop)]
    {
        let window_id = format!("window-{}", uuid::Uuid::new_v4());
        tauri::WebviewWindowBuilder::new(
            app,
            &window_id,
            tauri::WebviewUrl::App("index.html".into()),
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
        .manage(app_state)
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
            sftp_write_file,
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
            get_quick_snippets,
            save_quick_snippet,
            delete_quick_snippet,
            delete_quick_snippet_group,
            rename_quick_snippet_group,
            import_quick_snippets,
            tmux_list_sessions,
            tmux_kill_session,
            tmux_new_session
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
