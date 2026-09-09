use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{mpsc, Mutex};
use russh::ChannelMsg;
use russh::client::Msg;
use tauri::ipc::Channel as TauriChannel;
use tauri::Emitter;
use tracing::{info, warn};
use crate::connection::ConnectionManager;
use crate::core::{AppError, Result};

pub struct TerminalSession {
    pub id: String,
    pub server_id: String,
    tx_input: mpsc::Sender<Vec<u8>>,
    write_half: Arc<Mutex<russh::ChannelWriteHalf<Msg>>>,
}

pub const DEFAULT_NO_PROXY: &str =
    "localhost,127.0.0.1,::1,10.0.0.0/8,172.16.0.0/12,172.17.0.0/16,172.18.0.0/16,172.19.0.0/16,172.20.0.0/16,192.168.0.0/16,*.local,.internal,host.docker.internal";

impl TerminalSession {
    /// Builds the shell startup command sequence for directory switching and remote proxy injection.
    pub fn build_startup_cmd(
        initial_dir: Option<&str>,
        remote_proxy: Option<&str>,
        remote_no_proxy: Option<&str>,
    ) -> Option<String> {
        let mut parts = Vec::new();
        let mut proxy_display = None;

        if let Some(proxy) = remote_proxy {
            let trimmed = proxy.trim();
            if !trimmed.is_empty() {
                let proxy_url = if !trimmed.contains("://") {
                    format!("http://{}", trimmed)
                } else {
                    trimmed.to_string()
                };
                let safe_url = proxy_url.replace(['\r', '\n'], "").replace('"', "\\\"");
                proxy_display = Some(safe_url.clone());

                let no_proxy_val = remote_no_proxy
                    .map(|s| s.trim())
                    .filter(|s| !s.is_empty())
                    .unwrap_or(DEFAULT_NO_PROXY);
                let safe_no_proxy = no_proxy_val.replace(['\r', '\n'], "").replace('"', "\\\"");

                parts.push(format!(
                    "export http_proxy=\"{url}\" https_proxy=\"{url}\" all_proxy=\"{url}\" HTTP_PROXY=\"{url}\" HTTPS_PROXY=\"{url}\" ALL_PROXY=\"{url}\" no_proxy=\"{no_proxy}\" NO_PROXY=\"{no_proxy}\"",
                    url = safe_url,
                    no_proxy = safe_no_proxy
                ));
            }
        }

        if let Some(dir) = initial_dir {
            let trimmed = dir.trim();
            if !trimmed.is_empty() {
                let safe_dir = trimmed.replace(['\r', '\n'], "").replace('"', "\\\"");
                parts.push(format!("cd \"{}\"", safe_dir));
            }
        }

        if parts.is_empty() {
            None
        } else {
            parts.push("clear".to_string());
            if let Some(disp) = proxy_display {
                parts.push(format!("printf \"\\033[36m[Remora] Remote proxy active: %s\\033[0m\\n\" \"{}\"", disp));
            }
            Some(format!("{}\n", parts.join(" && ")))
        }
    }

    pub async fn start(
        server_id: &str,
        cols: u32,
        rows: u32,
        initial_dir: Option<String>,
        remote_proxy: Option<String>,
        remote_no_proxy: Option<String>,
        on_data: TauriChannel<Vec<u8>>,
        connection: Arc<ConnectionManager>,
        app_handle: Option<tauri::AppHandle>,
    ) -> Result<Self> {
        let id = format!("term-{}", uuid::Uuid::new_v4());
        let channel = match tokio::time::timeout(
            Duration::from_secs(10),
            connection.open_channel(server_id),
        )
        .await
        {
            Ok(res) => res?,
            Err(_) => return Err(AppError::Terminal("Timed out opening SSH channel (10s)".to_string())),
        };

        // Request interactive PTY with timeout
        match tokio::time::timeout(
            Duration::from_secs(10),
            channel.request_pty(
                false,
                "xterm-256color",
                cols.max(10),
                rows.max(5),
                0,
                0,
                &[],
            ),
        )
        .await
        {
            Ok(Ok(())) => {}
            Ok(Err(e)) => return Err(AppError::Terminal(format!("Failed to request PTY: {}", e))),
            Err(_) => return Err(AppError::Terminal("Timed out requesting PTY (10s)".to_string())),
        }

        // Request interactive shell with timeout
        match tokio::time::timeout(Duration::from_secs(10), channel.request_shell(true)).await {
            Ok(Ok(())) => {}
            Ok(Err(e)) => return Err(AppError::Terminal(format!("Failed to request shell: {}", e))),
            Err(_) => return Err(AppError::Terminal("Timed out requesting shell (10s)".to_string())),
        }

        // Execute directory switch and proxy environment injection if configured
        if let Some(startup_cmd) = Self::build_startup_cmd(
            initial_dir.as_deref(),
            remote_proxy.as_deref(),
            remote_no_proxy.as_deref(),
        ) {
            let _ = tokio::time::timeout(
                Duration::from_secs(10),
                channel.data(startup_cmd.as_bytes()),
            )
            .await;
        }

        let (read_half, write_half) = channel.split();
        let write_half_arc = Arc::new(Mutex::new(write_half));
        let (tx_input, mut rx_input) = mpsc::channel::<Vec<u8>>(128);

        let session_id_clone = id.clone();
        let server_id_clone = server_id.to_string();
        let app_handle_clone = app_handle.clone();

        // Spawn dedicated background reader task (lockless on read_half)
        tokio::spawn(async move {
            info!("Terminal background reader started for session {}", session_id_clone);
            let mut read_half = read_half;
            while let Some(msg) = read_half.wait().await {
                match msg {
                    ChannelMsg::Data { ref data } => {
                        if on_data.send(data.to_vec()).is_err() {
                            break;
                        }
                    }
                    ChannelMsg::ExtendedData { ref data, .. } => {
                        if on_data.send(data.to_vec()).is_err() {
                            break;
                        }
                    }
                    ChannelMsg::Eof | ChannelMsg::Close => {
                        break;
                    }
                    _ => {}
                }
            }
            info!("Terminal session {} reader loop terminated", session_id_clone);
            let _ = on_data.send(b"\r\n\x1b[33m[Remora] Remote host closed the terminal session.\x1b[0m\r\n".to_vec());
            if let Some(ref app) = app_handle_clone {
                let _ = app.emit("terminal-session-closed", serde_json::json!({
                    "sessionId": session_id_clone,
                    "serverId": server_id_clone,
                    "reason": "Remote host closed connection"
                }));
            }
        });

        // Spawn dedicated background writer task
        let wh_clone = write_half_arc.clone();
        let session_id_clone_w = id.clone();
        tokio::spawn(async move {
            while let Some(input) = rx_input.recv().await {
                let wh = wh_clone.lock().await;
                if let Err(e) = wh.data(input.as_slice()).await {
                    warn!("Terminal input write failed for {}: {}", session_id_clone_w, e);
                    break;
                }
            }
        });

        Ok(Self {
            id,
            server_id: server_id.to_string(),
            tx_input,
            write_half: write_half_arc,
        })
    }

    pub async fn write(&self, data: Vec<u8>) -> Result<()> {
        self.tx_input
            .send(data)
            .await
            .map_err(|e| AppError::Terminal(format!("Terminal session channel closed: {}", e)))
    }

    pub async fn resize(&self, cols: u32, rows: u32) -> Result<()> {
        let wh = self.write_half.lock().await;
        wh.window_change(cols.max(10), rows.max(5), 0, 0)
            .await
            .map_err(|e| AppError::Terminal(format!("Failed to send window resize: {}", e)))
    }

    pub async fn close(&self) -> Result<()> {
        let _ = tokio::time::timeout(Duration::from_millis(800), async {
            let wh = self.write_half.lock().await;
            let _ = wh.eof().await;
            let _ = wh.close().await;
        })
        .await;
        Ok(())
    }
}
