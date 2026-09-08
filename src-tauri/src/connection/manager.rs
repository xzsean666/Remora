use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tauri::Emitter;
use tokio::sync::{Mutex, RwLock};
use tracing::{error, info, warn};
use russh::client::Handle;
use crate::connection::client_handler::ClientHandler;
use crate::connection::state::ConnectionState;
use crate::core::{AppError, AuthType, Result, ServerConfig};

pub struct ConnectionSession {
    pub server_id: String,
    pub server: ServerConfig,
    pub secret: Option<String>,
    pub state: Arc<RwLock<ConnectionState>>,
    pub handle: Arc<Mutex<Option<Handle<ClientHandler>>>>,
}

#[derive(Clone)]
pub struct ConnectionManager {
    sessions: Arc<RwLock<HashMap<String, Arc<RwLock<ConnectionSession>>>>>,
}

pub fn expand_home_dir(path_str: &str) -> std::path::PathBuf {
    let clean_path = path_str.trim().trim_matches('\'').trim_matches('"');
    if let Some(stripped) = clean_path.strip_prefix("~/") {
        if let Some(home) = dirs::home_dir() {
            return home.join(stripped);
        }
    } else if clean_path == "~" {
        if let Some(home) = dirs::home_dir() {
            return home;
        }
    }
    std::path::PathBuf::from(clean_path)
}

impl ConnectionManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn get_state(&self, server_id: &str) -> ConnectionState {
        let sessions = self.sessions.read().await;
        if let Some(session_lock) = sessions.get(server_id) {
            let session = session_lock.read().await;
            let current_state = session.state.read().await.clone();
            current_state
        } else {
            ConnectionState::Disconnected
        }
    }

    pub async fn get_all_states(&self) -> HashMap<String, ConnectionState> {
        let sessions = self.sessions.read().await;
        let mut map = HashMap::new();
        for (id, session_lock) in sessions.iter() {
            let session = session_lock.read().await;
            let current_state = session.state.read().await.clone();
            map.insert(id.clone(), current_state);
        }
        map
    }

    pub async fn set_state(&self, server_id: &str, new_state: ConnectionState) {
        let sessions = self.sessions.read().await;
        if let Some(session_lock) = sessions.get(server_id) {
            let session = session_lock.read().await;
            *session.state.write().await = new_state;
        }
    }

    pub async fn connect(
        &self,
        server: &ServerConfig,
        secret: Option<&str>,
    ) -> Result<()> {
        let state_arc = Arc::new(RwLock::new(ConnectionState::Connecting));
        let handle_arc = Arc::new(Mutex::new(None));
        let session = Arc::new(RwLock::new(ConnectionSession {
            server_id: server.id.clone(),
            server: server.clone(),
            secret: secret.map(|s| s.to_string()),
            state: state_arc.clone(),
            handle: handle_arc.clone(),
        }));

        {
            let mut sessions = self.sessions.write().await;
            sessions.insert(server.id.clone(), session.clone());
        }

        let mut config = russh::client::Config::default();
        config.keepalive_interval = Some(Duration::from_secs(15));
        let config = Arc::new(config);

        let handler = ClientHandler::new(server.id.clone(), state_arc.clone());
        let addr = format!("{}:{}", server.host, server.port);

        info!("Connecting to SSH server {} at {}", server.name, addr);
        let mut handle = match tokio::time::timeout(
            Duration::from_secs(10),
            russh::client::connect(config, addr.as_str(), handler),
        )
        .await
        {
            Ok(Ok(h)) => h,
            Ok(Err(e)) => {
                let err_msg = format!("SSH TCP connect failed: {}", e);
                *state_arc.write().await = ConnectionState::Failed {
                    error: err_msg.clone(),
                };
                return Err(AppError::Connection(err_msg));
            }
            Err(_) => {
                let err_msg = "SSH connection timed out".to_string();
                *state_arc.write().await = ConnectionState::Failed {
                    error: err_msg.clone(),
                };
                return Err(AppError::Connection(err_msg));
            }
        };

        // Authenticate based on AuthType
        let auth_res = match server.auth_type {
            AuthType::Password => {
                let pwd = secret.unwrap_or("");
                handle.authenticate_password(&server.username, pwd).await
            }
            AuthType::PrivateKey => {
                if let Some(ref path_or_content) = server.key_path {
                    let key = if path_or_content.contains("BEGIN ") || path_or_content.contains("PRIVATE KEY") {
                        match russh::keys::decode_secret_key(path_or_content, secret) {
                            Ok(k) => k,
                            Err(e) => {
                                let err_msg = format!("Failed to decode private key: {}", e);
                                warn!("{}", err_msg);
                                *state_arc.write().await = ConnectionState::Failed {
                                    error: err_msg.clone(),
                                };
                                return Err(AppError::Security(err_msg));
                            }
                        }
                    } else {
                        let expanded_path = expand_home_dir(path_or_content);
                        match russh::keys::load_secret_key(&expanded_path, secret) {
                            Ok(k) => k,
                            Err(e) => {
                                let err_msg = format!(
                                    "Failed to load private key from '{}': {}",
                                    expanded_path.display(),
                                    e
                                );
                                warn!("{}", err_msg);
                                *state_arc.write().await = ConnectionState::Failed {
                                    error: err_msg.clone(),
                                };
                                return Err(AppError::Security(err_msg));
                            }
                        }
                    };
                    let key_with_alg = russh::keys::PrivateKeyWithHashAlg::new(Arc::new(key), None);
                    handle
                        .authenticate_publickey(&server.username, key_with_alg)
                        .await
                } else {
                    let err_msg = "Private key path or content not specified".to_string();
                    *state_arc.write().await = ConnectionState::Failed {
                        error: err_msg.clone(),
                    };
                    return Err(AppError::Security(err_msg));
                }
            }
            AuthType::Agent => {
                match russh::keys::agent::client::AgentClient::connect_env().await {
                    Ok(mut agent) => {
                        let mut authenticated = false;
                        if let Ok(identities) = agent.request_identities().await {
                            for identity in identities {
                                let key = identity.public_key().into_owned();
                                if let Ok(russh::client::AuthResult::Success) =
                                    handle
                                        .authenticate_publickey_with(
                                             &server.username,
                                             key,
                                             None,
                                             &mut agent,
                                        )
                                        .await
                                {
                                    authenticated = true;
                                    break;
                                }
                            }
                        }
                        if authenticated {
                            Ok(russh::client::AuthResult::Success)
                        } else {
                            Err(russh::Error::NoAuthMethod)
                        }
                    }
                    Err(e) => {
                        warn!("SSH Agent unavailable: {}", e);
                        Err(russh::Error::NoAuthMethod)
                    }
                }
            }
        };

        match auth_res {
            Ok(russh::client::AuthResult::Success) => {
                info!("SSH authentication succeeded for {}", server.name);
                *state_arc.write().await = ConnectionState::Connected;
                let mut handle_guard = handle_arc.lock().await;
                *handle_guard = Some(handle);
                Ok(())
            }
            Ok(other) => {
                let err_msg = format!("SSH authentication rejected: {:?}", other);
                warn!("{}", err_msg);
                *state_arc.write().await = ConnectionState::Failed {
                    error: err_msg.clone(),
                };
                Err(AppError::Connection(err_msg))
            }
            Err(e) => {
                let err_msg = format!("SSH authentication failed: {}", e);
                warn!("{}", err_msg);
                *state_arc.write().await = ConnectionState::Failed {
                    error: err_msg.clone(),
                };
                Err(AppError::Connection(err_msg))
            }
        }
    }

    pub async fn disconnect(&self, server_id: &str) -> Result<()> {
        let mut sessions = self.sessions.write().await;
        if let Some(session_lock) = sessions.remove(server_id) {
            let session = session_lock.read().await;
            let mut handle_guard = session.handle.lock().await;
            if let Some(ref mut handle) = *handle_guard {
                let _ = handle.disconnect(russh::Disconnect::ByApplication, "", "").await;
            }
            *handle_guard = None;
            *session.state.write().await = ConnectionState::Disconnected;
        }
        Ok(())
    }

    pub async fn get_handle(&self, server_id: &str) -> Result<Arc<Mutex<Option<Handle<ClientHandler>>>>> {
        let sessions = self.sessions.read().await;
        let session_lock = sessions.get(server_id).ok_or_else(|| {
            AppError::Connection(format!("Server {} not connected", server_id))
        })?;
        let session = session_lock.read().await;
        Ok(session.handle.clone())
    }

    pub async fn open_channel(&self, server_id: &str) -> Result<russh::Channel<russh::client::Msg>> {
        let handle_arc = self.get_handle(server_id).await?;
        let mut guard = handle_arc.lock().await;
        let handle = guard.as_mut().ok_or_else(|| {
            AppError::Connection(format!("Server {} handle is not active", server_id))
        })?;
        match tokio::time::timeout(Duration::from_secs(10), handle.channel_open_session()).await {
            Ok(Ok(ch)) => Ok(ch),
            Ok(Err(e)) => Err(AppError::Connection(format!("Failed to open SSH channel: {}", e))),
            Err(_) => Err(AppError::Connection("SSH channel open timed out after 10s. Remote host or connection may be stalled.".to_string())),
        }
    }

    pub async fn reconnect(
        &self,
        server_id: &str,
        app_handle: Option<tauri::AppHandle>,
    ) -> Result<()> {
        let (server, secret) = {
            let sessions = self.sessions.read().await;
            let session_lock = sessions.get(server_id).ok_or_else(|| {
                AppError::NotFound(format!("No previous connection session found for {}", server_id))
            })?;
            let session = session_lock.read().await;
            (session.server.clone(), session.secret.clone())
        };

        let this = self.clone();
        let server_id_owned = server_id.to_string();

        tokio::spawn(async move {
            let max_attempts = 5;
            for attempt in 1..=max_attempts {
                info!(
                    "Reconnecting to server {} (attempt {}/{})",
                    server_id_owned, attempt, max_attempts
                );

                let state = ConnectionState::Reconnecting { attempt };
                this.set_state(&server_id_owned, state.clone()).await;
                if let Some(ref app) = app_handle {
                    let _ = app.emit("connection-state-changed", serde_json::json!({
                        "serverId": server_id_owned,
                        "state": state
                    }));
                }

                // Exponential backoff: 1s, 2s, 4s, 8s, 16s
                let backoff_secs = 1u64 << (attempt - 1);
                tokio::time::sleep(Duration::from_secs(backoff_secs)).await;

                // Close stale handle before retrying
                {
                    let sessions = this.sessions.read().await;
                    if let Some(session_lock) = sessions.get(&server_id_owned) {
                        let session = session_lock.read().await;
                        let mut handle_guard = session.handle.lock().await;
                        *handle_guard = None;
                    }
                }

                match this.connect(&server, secret.as_deref()).await {
                    Ok(_) => {
                        info!("Reconnected successfully to {}", server_id_owned);
                        let state = ConnectionState::Connected;
                        this.set_state(&server_id_owned, state.clone()).await;
                        if let Some(ref app) = app_handle {
                            let _ = app.emit("connection-state-changed", serde_json::json!({
                                "serverId": server_id_owned,
                                "state": state
                            }));
                        }
                        return;
                    }
                    Err(e) => {
                        warn!(
                            "Reconnect attempt {} failed for {}: {}",
                            attempt, server_id_owned, e
                        );
                        if attempt == max_attempts {
                            error!(
                                "All {} reconnect attempts failed for {}",
                                max_attempts, server_id_owned
                            );
                            let state = ConnectionState::Failed {
                                error: format!("Failed to reconnect after {} attempts: {}", max_attempts, e),
                            };
                            this.set_state(&server_id_owned, state.clone()).await;
                            if let Some(ref app) = app_handle {
                                let _ = app.emit("connection-state-changed", serde_json::json!({
                                    "serverId": server_id_owned,
                                    "state": state
                                }));
                            }
                        }
                    }
                }
            }
        });

        Ok(())
    }
}

impl Default for ConnectionManager {
    fn default() -> Self {
        Self::new()
    }
}
