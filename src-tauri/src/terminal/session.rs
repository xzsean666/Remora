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

impl TerminalSession {
    pub async fn start(
        server_id: &str,
        cols: u32,
        rows: u32,
        initial_dir: Option<String>,
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

        // If an initial directory was specified, cd into it
        if let Some(dir) = initial_dir {
            if !dir.trim().is_empty() {
                let cd_cmd = format!("cd \"{}\" && clear\n", dir);
                let _ = channel.data(cd_cmd.as_bytes()).await;
            }
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
