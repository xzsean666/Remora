use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tauri::ipc::Channel as TauriChannel;
use crate::connection::ConnectionManager;
use crate::core::{AppError, Result};
use super::session::TerminalSession;

pub struct TerminalManager {
    connection: Arc<ConnectionManager>,
    sessions: Arc<RwLock<HashMap<String, Arc<TerminalSession>>>>,
}

impl TerminalManager {
    pub fn new(connection: Arc<ConnectionManager>) -> Self {
        Self {
            connection,
            sessions: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn open(
        &self,
        server_id: &str,
        cols: u32,
        rows: u32,
        initial_dir: Option<String>,
        remote_proxy: Option<String>,
        remote_no_proxy: Option<String>,
        on_data: TauriChannel<Vec<u8>>,
        app: Option<tauri::AppHandle>,
    ) -> Result<String> {
        let session = TerminalSession::start(
            server_id,
            cols,
            rows,
            initial_dir,
            remote_proxy,
            remote_no_proxy,
            on_data,
            self.connection.clone(),
            app,
        )
        .await?;

        let id = session.id.clone();
        let mut sessions = self.sessions.write().await;
        sessions.insert(id.clone(), Arc::new(session));
        Ok(id)
    }

    pub async fn write(&self, session_id: &str, data: Vec<u8>) -> Result<()> {
        let sessions = self.sessions.read().await;
        let session = sessions
            .get(session_id)
            .ok_or_else(|| AppError::Terminal(format!("Terminal session {} not found", session_id)))?;
        session.write(data).await
    }

    pub async fn resize(&self, session_id: &str, cols: u32, rows: u32) -> Result<()> {
        let sessions = self.sessions.read().await;
        let session = sessions
            .get(session_id)
            .ok_or_else(|| AppError::Terminal(format!("Terminal session {} not found", session_id)))?;
        session.resize(cols, rows).await
    }

    pub async fn close(&self, session_id: &str) -> Result<()> {
        let mut sessions = self.sessions.write().await;
        if let Some(session) = sessions.remove(session_id) {
            session.close().await?;
        }
        Ok(())
    }

    pub async fn close_all_for_server(&self, server_id: &str) {
        let mut sessions = self.sessions.write().await;
        let ids_to_remove: Vec<String> = sessions
            .iter()
            .filter(|(_, s)| s.server_id == server_id)
            .map(|(id, _)| id.clone())
            .collect();

        for id in ids_to_remove {
            if let Some(s) = sessions.remove(&id) {
                let _ = s.close().await;
            }
        }
    }
}
