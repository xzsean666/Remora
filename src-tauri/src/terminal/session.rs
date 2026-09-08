use std::sync::Arc;
use tokio::sync::{mpsc, Mutex};
use russh::ChannelMsg;
use russh::client::Msg;
use tauri::ipc::Channel as TauriChannel;
use tracing::{info, warn};
use crate::connection::ConnectionManager;
use crate::core::{AppError, Result};

pub struct TerminalSession {
    pub id: String,
    pub server_id: String,
    tx_input: mpsc::Sender<Vec<u8>>,
    channel: Arc<Mutex<russh::Channel<Msg>>>,
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
    ) -> Result<Self> {
        let id = format!("term-{}", uuid::Uuid::new_v4());
        let channel = connection.open_channel(server_id).await?;

        // Request interactive PTY
        channel
            .request_pty(
                false,
                "xterm-256color",
                cols.max(10),
                rows.max(5),
                0,
                0,
                &[],
            )
            .await
            .map_err(|e| AppError::Terminal(format!("Failed to request PTY: {}", e)))?;

        // Request interactive shell
        channel
            .request_shell(true)
            .await
            .map_err(|e| AppError::Terminal(format!("Failed to request shell: {}", e)))?;

        // Execute directory switch and proxy environment injection if configured
        if let Some(startup_cmd) = Self::build_startup_cmd(
            initial_dir.as_deref(),
            remote_proxy.as_deref(),
            remote_no_proxy.as_deref(),
        ) {
            let _ = channel.data(startup_cmd.as_bytes()).await;
        }

        let channel_arc = Arc::new(Mutex::new(channel));
        let (tx_input, mut rx_input) = mpsc::channel::<Vec<u8>>(128);

        let ch_clone = channel_arc.clone();
        let session_id_clone = id.clone();

        tokio::spawn(async move {
            info!("Terminal background task started for session {}", session_id_clone);
            loop {
                tokio::select! {
                    Some(input) = rx_input.recv() => {
                        let ch = ch_clone.lock().await;
                        if let Err(e) = ch.data(input.as_slice()).await {
                            warn!("Terminal input write failed: {}", e);
                            break;
                        }
                    }
                    msg = async {
                        let mut ch = ch_clone.lock().await;
                        ch.wait().await
                    } => {
                        match msg {
                            Some(ChannelMsg::Data { ref data }) => {
                                if on_data.send(data.to_vec()).is_err() {
                                    // Webview channel closed or navigated
                                    break;
                                }
                            }
                            Some(ChannelMsg::ExtendedData { ref data, .. }) => {
                                if on_data.send(data.to_vec()).is_err() {
                                    break;
                                }
                            }
                            Some(ChannelMsg::Eof) | Some(ChannelMsg::Close) | None => {
                                info!("Terminal session {} closed by remote host", session_id_clone);
                                break;
                            }
                            _ => {}
                        }
                    }
                }
            }
        });

        Ok(Self {
            id,
            server_id: server_id.to_string(),
            tx_input,
            channel: channel_arc,
        })
    }

    pub async fn write(&self, data: Vec<u8>) -> Result<()> {
        self.tx_input
            .send(data)
            .await
            .map_err(|e| AppError::Terminal(format!("Failed to queue terminal input: {}", e)))
    }

    pub async fn resize(&self, cols: u32, rows: u32) -> Result<()> {
        let ch = self.channel.lock().await;
        ch.window_change(cols.max(10), rows.max(5), 0, 0)
            .await
            .map_err(|e| AppError::Terminal(format!("Failed to send window resize: {}", e)))
    }

    pub async fn close(&self) -> Result<()> {
        let ch = self.channel.lock().await;
        let _ = ch.eof().await;
        let _ = ch.close().await;
        Ok(())
    }
}
