use std::collections::HashMap;
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::sync::{Mutex, RwLock};
use tracing::{info, warn};
use russh_sftp::client::SftpSession;
use russh_sftp::protocol::OpenFlags;
use crate::connection::ConnectionManager;
use crate::core::{AppError, FileEntry, ReadFileResult, Result, WriteFileResult};
use crate::sftp::file_entry::{from_dir_entry, sort_file_entries};

pub struct SftpService {
    connection: Arc<ConnectionManager>,
    sessions: Arc<RwLock<HashMap<String, Arc<Mutex<SftpSession>>>>>,
}

impl SftpService {
    pub fn new(connection: Arc<ConnectionManager>) -> Self {
        Self {
            connection,
            sessions: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn get_or_create_session(&self, server_id: &str) -> Result<Arc<Mutex<SftpSession>>> {
        {
            let sessions = self.sessions.read().await;
            if let Some(sftp_session) = sessions.get(server_id) {
                return Ok(sftp_session.clone());
            }
        }

        info!("Opening new SFTP subsystem channel for server {}", server_id);
        let channel = self.connection.open_channel(server_id).await?;
        channel
            .request_subsystem(true, "sftp")
            .await
            .map_err(|e| AppError::Sftp(format!("Failed to request SFTP subsystem: {}", e)))?;

        let sftp = SftpSession::new(channel.into_stream())
            .await
            .map_err(|e| AppError::Sftp(format!("Failed to initialize SFTP session: {}", e)))?;

        let session_arc = Arc::new(Mutex::new(sftp));
        {
            let mut sessions = self.sessions.write().await;
            sessions.insert(server_id.to_string(), session_arc.clone());
        }
        Ok(session_arc)
    }

    pub async fn close_session(&self, server_id: &str) {
        let mut sessions = self.sessions.write().await;
        sessions.remove(server_id);
    }

    pub async fn read_dir(&self, server_id: &str, path: &str) -> Result<Vec<FileEntry>> {
        let session_arc = self.get_or_create_session(server_id).await?;
        let sftp = session_arc.lock().await;

        let entries_res = sftp.read_dir(path).await;
        match entries_res {
            Ok(dir_stream) => {
                let mut entries = Vec::new();
                for entry in dir_stream {
                    let name = entry.file_name();
                    if name == "." || name == ".." {
                        continue;
                    }
                    entries.push(from_dir_entry(&entry));
                }
                sort_file_entries(&mut entries);
                Ok(entries)
            }
            Err(e) => Err(AppError::Sftp(format!("Failed to read directory {}: {}", path, e))),
        }
    }

    pub async fn read_file(&self, server_id: &str, path: &str) -> Result<ReadFileResult> {
        let session_arc = self.get_or_create_session(server_id).await?;
        let sftp = session_arc.lock().await;

        let meta = sftp
            .metadata(path)
            .await
            .map_err(|e| AppError::Sftp(format!("Failed to stat file {}: {}", path, e)))?;

        let size = meta.len();
        let mtime = meta.mtime.unwrap_or(0) as u64;

        let mut file = sftp
            .open_with_flags(path, OpenFlags::READ)
            .await
            .map_err(|e| AppError::Sftp(format!("Failed to open file {}: {}", path, e)))?;

        let mut content = String::new();
        file.read_to_string(&mut content)
            .await
            .map_err(|e| AppError::Sftp(format!("Failed to read file {}: {}", path, e)))?;

        Ok(ReadFileResult {
            content,
            mtime,
            size,
        })
    }

    pub async fn write_file(
        &self,
        server_id: &str,
        path: &str,
        content: &str,
        expected_mtime: Option<u64>,
    ) -> Result<WriteFileResult> {
        let session_arc = self.get_or_create_session(server_id).await?;
        let sftp = session_arc.lock().await;

        // Conflict Detection: check if remote file was modified after expected_mtime
        if let Some(expected) = expected_mtime {
            if let Ok(current_meta) = sftp.metadata(path).await {
                let current_mtime = current_meta.mtime.unwrap_or(0) as u64;
                if current_mtime > expected {
                    warn!(
                        "File conflict detected on {}: remote mtime {} > expected {}",
                        path, current_mtime, expected
                    );
                    return Err(AppError::Sftp(format!(
                        "Conflict detected: remote file has been modified externally (mtime: {}, opened at: {})",
                        current_mtime, expected
                    )));
                }
            }
        }

        let mut file = sftp
            .open_with_flags(
                path,
                OpenFlags::WRITE | OpenFlags::CREATE | OpenFlags::TRUNCATE,
            )
            .await
            .map_err(|e| AppError::Sftp(format!("Failed to open file for writing {}: {}", path, e)))?;

        file.write_all(content.as_bytes())
            .await
            .map_err(|e| AppError::Sftp(format!("Failed to write content to {}: {}", path, e)))?;

        file.flush()
            .await
            .map_err(|e| AppError::Sftp(format!("Failed to flush file {}: {}", path, e)))?;

        let new_meta = sftp.metadata(path).await.ok();
        let new_mtime = new_meta.and_then(|m| m.mtime).unwrap_or(0) as u64;

        Ok(WriteFileResult {
            success: true,
            new_mtime,
        })
    }

    pub async fn create_file(&self, server_id: &str, path: &str) -> Result<()> {
        let session_arc = self.get_or_create_session(server_id).await?;
        let sftp = session_arc.lock().await;

        let mut file = sftp
            .open_with_flags(path, OpenFlags::WRITE | OpenFlags::CREATE)
            .await
            .map_err(|e| AppError::Sftp(format!("Failed to create file {}: {}", path, e)))?;

        file.flush()
            .await
            .map_err(|e| AppError::Sftp(format!("Failed to flush new file {}: {}", path, e)))?;

        Ok(())
    }

    pub async fn create_dir(&self, server_id: &str, path: &str) -> Result<()> {
        let session_arc = self.get_or_create_session(server_id).await?;
        let sftp = session_arc.lock().await;

        sftp.create_dir(path)
            .await
            .map_err(|e| AppError::Sftp(format!("Failed to create directory {}: {}", path, e)))?;
        Ok(())
    }

    pub async fn rename(&self, server_id: &str, old_path: &str, new_path: &str) -> Result<()> {
        let session_arc = self.get_or_create_session(server_id).await?;
        let sftp = session_arc.lock().await;

        sftp.rename(old_path, new_path)
            .await
            .map_err(|e| AppError::Sftp(format!("Failed to rename {} to {}: {}", old_path, new_path, e)))?;
        Ok(())
    }

    pub async fn remove(&self, server_id: &str, path: &str, is_dir: bool) -> Result<()> {
        let session_arc = self.get_or_create_session(server_id).await?;
        let sftp = session_arc.lock().await;

        if is_dir {
            sftp.remove_dir(path)
                .await
                .map_err(|e| AppError::Sftp(format!("Failed to remove directory {}: {}", path, e)))?;
        } else {
            sftp.remove_file(path)
                .await
                .map_err(|e| AppError::Sftp(format!("Failed to remove file {}: {}", path, e)))?;
        }
        Ok(())
    }

    pub async fn stat(&self, server_id: &str, path: &str) -> Result<FileEntry> {
        let session_arc = self.get_or_create_session(server_id).await?;
        let sftp = session_arc.lock().await;

        let meta = sftp
            .metadata(path)
            .await
            .map_err(|e| AppError::Sftp(format!("Failed to stat {}: {}", path, e)))?;

        let name = path.split('/').next_back().unwrap_or(path).to_string();
        Ok(FileEntry {
            name,
            path: path.to_string(),
            is_dir: meta.is_dir(),
            is_symlink: meta.is_symlink(),
            size: meta.len(),
            mtime: meta.mtime.unwrap_or(0) as u64,
        })
    }
}
