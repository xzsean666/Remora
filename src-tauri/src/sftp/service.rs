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
        match self.do_read_dir(server_id, path).await {
            Ok(entries) => Ok(entries),
            Err(e) => {
                warn!(
                    "SFTP read_dir failed on server {} for path {}: {:?}. Invalidating cached session and retrying...",
                    server_id, path, e
                );
                self.close_session(server_id).await;
                self.do_read_dir(server_id, path).await
            }
        }
    }

    async fn do_read_dir(&self, server_id: &str, path: &str) -> Result<Vec<FileEntry>> {
        let session_arc = self.get_or_create_session(server_id).await?;
        let sftp = session_arc.lock().await;

        let target_path = if path == "~" {
            sftp.canonicalize(".").await.unwrap_or_else(|_| "/root".to_string())
        } else if let Some(sub) = path.strip_prefix("~/") {
            let home = sftp.canonicalize(".").await.unwrap_or_else(|_| "/root".to_string());
            format!("{}/{}", home.trim_end_matches('/'), sub)
        } else {
            path.to_string()
        };

        let entries_res = sftp.read_dir(&target_path).await;
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
            Err(e) => {
                Err(AppError::Sftp(format!("Failed to read directory {}: {}", path, e)))
            }
        }
    }

    pub async fn read_file(&self, server_id: &str, path: &str) -> Result<ReadFileResult> {
        match self.do_read_file(server_id, path).await {
            Ok(res) => Ok(res),
            Err(e) => {
                warn!(
                    "SFTP read_file failed on server {} for path {}: {:?}. Invalidating cached session and retrying...",
                    server_id, path, e
                );
                self.close_session(server_id).await;
                self.do_read_file(server_id, path).await
            }
        }
    }

    async fn do_read_file(&self, server_id: &str, path: &str) -> Result<ReadFileResult> {
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
        let res = self.do_write_file(server_id, path, content, expected_mtime).await;
        if res.is_err() {
            self.close_session(server_id).await;
        }
        res
    }

    async fn do_write_file(
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
        let res = async {
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
        .await;

        if res.is_err() {
            self.close_session(server_id).await;
        }
        res
    }

    pub async fn create_dir(&self, server_id: &str, path: &str) -> Result<()> {
        let res = async {
            let session_arc = self.get_or_create_session(server_id).await?;
            let sftp = session_arc.lock().await;

            sftp.create_dir(path)
                .await
                .map_err(|e| AppError::Sftp(format!("Failed to create directory {}: {}", path, e)))?;
            Ok(())
        }
        .await;

        if res.is_err() {
            self.close_session(server_id).await;
        }
        res
    }

    pub async fn rename(&self, server_id: &str, old_path: &str, new_path: &str) -> Result<()> {
        let res = async {
            let session_arc = self.get_or_create_session(server_id).await?;
            let sftp = session_arc.lock().await;

            sftp.rename(old_path, new_path)
                .await
                .map_err(|e| AppError::Sftp(format!("Failed to rename {} to {}: {}", old_path, new_path, e)))?;
            Ok(())
        }
        .await;

        if res.is_err() {
            self.close_session(server_id).await;
        }
        res
    }

    pub async fn remove(&self, server_id: &str, path: &str, is_dir: bool) -> Result<()> {
        let res = async {
            let session_arc = self.get_or_create_session(server_id).await?;
            let sftp = session_arc.lock().await;

            if is_dir {
                Self::remove_remote_dir_recursive(&sftp, path).await?;
            } else {
                sftp.remove_file(path)
                    .await
                    .map_err(|e| AppError::Sftp(format!("Failed to remove file {}: {}", path, e)))?;
            }
            Ok(())
        }
        .await;

        if res.is_err() {
            self.close_session(server_id).await;
        }
        res
    }

    async fn remove_remote_dir_recursive(sftp: &SftpSession, path: &str) -> Result<()> {
        if let Ok(entries) = sftp.read_dir(path).await {
            for entry in entries {
                let name = entry.file_name();
                if name == "." || name == ".." {
                    continue;
                }
                let child_path = format!("{}/{}", path.trim_end_matches('/'), name);
                if entry.file_type().is_dir() {
                    Box::pin(Self::remove_remote_dir_recursive(sftp, &child_path)).await?;
                } else {
                    let _ = sftp.remove_file(&child_path).await;
                }
            }
        }
        sftp.remove_dir(path)
            .await
            .map_err(|e| AppError::Sftp(format!("Failed to remove directory {}: {}", path, e)))?;
        Ok(())
    }

    async fn ensure_remote_dir_recursive(sftp: &SftpSession, path: &str) -> Result<()> {
        let clean = path.trim_end_matches('/');
        let parts: Vec<&str> = clean.split('/').filter(|s| !s.is_empty()).collect();
        let mut current = String::new();
        for part in parts {
            current.push('/');
            current.push_str(part);
            if sftp.metadata(&current).await.is_err() {
                let _ = sftp.create_dir(&current).await;
            }
        }
        Ok(())
    }

    pub async fn trash(&self, server_id: &str, path: &str) -> Result<String> {
        let res = self.do_trash(server_id, path).await;
        if res.is_err() {
            self.close_session(server_id).await;
        }
        res
    }

    async fn do_trash(&self, server_id: &str, path: &str) -> Result<String> {
        let session_arc = self.get_or_create_session(server_id).await?;
        let sftp = session_arc.lock().await;

        // 1. Resolve remote user home directory via canonicalize(".")
        let home = match sftp.canonicalize(".").await {
            Ok(h) if !h.trim().is_empty() && h != "/" => h.trim().to_string(),
            _ => {
                let segments: Vec<&str> = path.split('/').filter(|s| !s.is_empty()).collect();
                if segments.len() >= 2 && segments[0] == "home" {
                    format!("/home/{}", segments[1])
                } else {
                    "/tmp".to_string()
                }
            }
        };

        let trash_base = format!("{}/.local/share/Trash", home.trim_end_matches('/'));
        let files_dir = format!("{}/files", trash_base);
        let info_dir = format!("{}/info", trash_base);

        let _ = Self::ensure_remote_dir_recursive(&sftp, &files_dir).await;
        let _ = Self::ensure_remote_dir_recursive(&sftp, &info_dir).await;

        let file_name = path.split('/').next_back().unwrap_or("item");
        let now = chrono::Local::now();
        let timestamp_str = now.format("%Y%m%d_%H%M%S").to_string();

        let mut dest_name = file_name.to_string();
        let mut dest_path = format!("{}/{}", files_dir, dest_name);

        if sftp.metadata(&dest_path).await.is_ok() {
            let (stem, ext) = match file_name.rfind('.') {
                Some(idx) if idx > 0 => (&file_name[..idx], &file_name[idx..]),
                _ => (file_name, ""),
            };
            dest_name = format!("{}_{}{}", stem, timestamp_str, ext);
            dest_path = format!("{}/{}", files_dir, dest_name);
        }

        match sftp.rename(path, &dest_path).await {
            Ok(_) => {
                // FreeDesktop .trashinfo metadata
                let trashinfo_path = format!("{}/{}.trashinfo", info_dir, dest_name);
                let deletion_date = now.format("%Y-%m-%dT%H:%M:%S").to_string();
                let trashinfo_content = format!(
                    "[Trash Info]\nPath={}\nDeletionDate={}\n",
                    path, deletion_date
                );
                if let Ok(mut info_file) = sftp
                    .open_with_flags(
                        &trashinfo_path,
                        OpenFlags::CREATE | OpenFlags::WRITE | OpenFlags::TRUNCATE,
                    )
                    .await
                {
                    let _ = info_file.write_all(trashinfo_content.as_bytes()).await;
                }
                info!("Successfully moved '{}' to remote trash at '{}'", path, dest_path);
                Ok(dest_path)
            }
            Err(e) => {
                // Cross-device fallback: move to .remora_trash in parent folder
                let parent = path.rsplit_once('/').map(|(p, _)| p).unwrap_or("");
                if !parent.is_empty() {
                    let fallback_trash = format!("{}/.remora_trash", parent);
                    if Self::ensure_remote_dir_recursive(&sftp, &fallback_trash).await.is_ok() {
                        let fallback_dest = format!("{}/{}", fallback_trash, dest_name);
                        if sftp.rename(path, &fallback_dest).await.is_ok() {
                            info!("Moved '{}' to local fallback trash at '{}'", path, fallback_dest);
                            return Ok(fallback_dest);
                        }
                    }
                }
                Err(AppError::Sftp(format!("Failed to move {} to trash: {}", path, e)))
            }
        }
    }

    pub async fn stat(&self, server_id: &str, path: &str) -> Result<FileEntry> {
        match self.do_stat(server_id, path).await {
            Ok(entry) => Ok(entry),
            Err(e) => {
                warn!(
                    "SFTP stat failed on server {} for path {}: {:?}. Invalidating cached session and retrying...",
                    server_id, path, e
                );
                self.close_session(server_id).await;
                self.do_stat(server_id, path).await
            }
        }
    }

    async fn do_stat(&self, server_id: &str, path: &str) -> Result<FileEntry> {
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
