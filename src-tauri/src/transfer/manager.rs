use std::collections::HashMap;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;
use tauri::Emitter;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::sync::RwLock;
use tracing::{error, info, warn};
use uuid::Uuid;
use russh_sftp::protocol::OpenFlags;

use crate::core::{AppError, Result};
use crate::sftp::SftpService;
use crate::transfer::model::{TransferDirection, TransferItem, TransferStatus};

const CHUNK_SIZE: usize = 64 * 1024; // 64 KB chunk size for optimal throughput

struct TaskHandle {
    item: Arc<RwLock<TransferItem>>,
    cancelled: Arc<AtomicBool>,
}

pub struct TransferManager {
    sftp: Arc<SftpService>,
    tasks: Arc<RwLock<HashMap<String, Arc<TaskHandle>>>>,
}

impl TransferManager {
    pub fn new(sftp: Arc<SftpService>) -> Self {
        Self {
            sftp,
            tasks: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn list_transfers(&self) -> Vec<TransferItem> {
        let tasks = self.tasks.read().await;
        let mut items = Vec::new();
        for task in tasks.values() {
            items.push(task.item.read().await.clone());
        }
        items.sort_by(|a, b| b.started_at.cmp(&a.started_at));
        items
    }

    pub async fn get_transfer(&self, id: &str) -> Option<TransferItem> {
        let tasks = self.tasks.read().await;
        if let Some(task) = tasks.get(id) {
            Some(task.item.read().await.clone())
        } else {
            None
        }
    }

    pub async fn cancel_transfer(&self, id: &str) -> Result<()> {
        let tasks = self.tasks.read().await;
        if let Some(task) = tasks.get(id) {
            task.cancelled.store(true, Ordering::SeqCst);
            let mut item = task.item.write().await;
            if item.status == TransferStatus::Pending || item.status == TransferStatus::Transferring {
                item.status = TransferStatus::Cancelled;
                item.updated_at = chrono::Utc::now().timestamp_millis();
            }
            Ok(())
        } else {
            Err(AppError::NotFound(format!("Transfer task {} not found", id)))
        }
    }

    pub async fn start_upload(
        &self,
        server_id: &str,
        local_path: &str,
        remote_path: &str,
        app_handle: Option<tauri::AppHandle>,
    ) -> Result<String> {
        let local_meta = tokio::fs::metadata(local_path)
            .await
            .map_err(|e| AppError::Sftp(format!("Local file metadata error: {}", e)))?;

        let total_bytes = local_meta.len();
        let filename = Path::new(local_path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("file")
            .to_string();

        let task_id = Uuid::new_v4().to_string();
        let now = chrono::Utc::now().timestamp_millis();

        let item = TransferItem {
            id: task_id.clone(),
            server_id: server_id.to_string(),
            direction: TransferDirection::Upload,
            local_path: local_path.to_string(),
            remote_path: remote_path.to_string(),
            filename,
            total_bytes,
            transferred_bytes: 0,
            status: TransferStatus::Pending,
            error_message: None,
            speed_bps: 0,
            started_at: now,
            updated_at: now,
        };

        let task_handle = Arc::new(TaskHandle {
            item: Arc::new(RwLock::new(item)),
            cancelled: Arc::new(AtomicBool::new(false)),
        });

        {
            let mut tasks = self.tasks.write().await;
            tasks.insert(task_id.clone(), task_handle.clone());
        }

        let sftp_service = self.sftp.clone();
        let server_id_owned = server_id.to_string();
        let local_path_owned = local_path.to_string();
        let remote_path_owned = remote_path.to_string();
        let task_handle_clone = task_handle.clone();

        tokio::spawn(async move {
            Self::execute_upload(
                sftp_service,
                server_id_owned,
                local_path_owned,
                remote_path_owned,
                total_bytes,
                task_handle_clone,
                app_handle,
            )
            .await;
        });

        Ok(task_id)
    }

    async fn execute_upload(
        sftp_service: Arc<SftpService>,
        server_id: String,
        local_path: String,
        remote_path: String,
        total_bytes: u64,
        task: Arc<TaskHandle>,
        app_handle: Option<tauri::AppHandle>,
    ) {
        {
            let mut item = task.item.write().await;
            item.status = TransferStatus::Transferring;
            item.updated_at = chrono::Utc::now().timestamp_millis();
            Self::emit_progress(&app_handle, &item);
        }

        let is_dir = match tokio::fs::metadata(&local_path).await {
            Ok(m) => m.is_dir(),
            Err(e) => {
                Self::fail_task(&task, &app_handle, format!("Failed to stat local file: {}", e)).await;
                return;
            }
        };

        if is_dir {
            if let Err(e) = Self::upload_directory_recursive(
                sftp_service,
                &server_id,
                Path::new(&local_path),
                &remote_path,
                &task,
                &app_handle,
            )
            .await
            {
                Self::fail_task(&task, &app_handle, e.to_string()).await;
                return;
            }

            let mut item = task.item.write().await;
            item.status = TransferStatus::Completed;
            item.updated_at = chrono::Utc::now().timestamp_millis();
            Self::emit_progress(&app_handle, &item);
            info!("Directory upload task {} completed successfully", item.id);
            return;
        }

        let session_res = sftp_service.get_or_create_session(&server_id).await;
        let session = match session_res {
            Ok(s) => s,
            Err(e) => {
                Self::fail_task(&task, &app_handle, format!("Failed to get SFTP session: {}", e)).await;
                return;
            }
        };

        let mut local_file = match tokio::fs::File::open(&local_path).await {
            Ok(f) => f,
            Err(e) => {
                Self::fail_task(&task, &app_handle, format!("Failed to open local file: {}", e)).await;
                return;
            }
        };

        let remote_file_res = {
            let sftp = session.lock().await;
            sftp.open_with_flags(
                &remote_path,
                OpenFlags::WRITE | OpenFlags::CREATE | OpenFlags::TRUNCATE,
            )
            .await
        };

        let mut remote_file = match remote_file_res {
            Ok(f) => f,
            Err(e) => {
                Self::fail_task(&task, &app_handle, format!("Failed to open remote file: {}", e)).await;
                return;
            }
        };

        let mut buffer = vec![0u8; CHUNK_SIZE];
        let mut transferred = 0u64;
        let start_time = Instant::now();
        let mut last_emit = Instant::now();

        loop {
            if task.cancelled.load(Ordering::SeqCst) {
                info!("Upload task {} was cancelled", task.item.read().await.id);
                let mut item = task.item.write().await;
                item.status = TransferStatus::Cancelled;
                item.updated_at = chrono::Utc::now().timestamp_millis();
                Self::emit_progress(&app_handle, &item);
                return;
            }

            let read_bytes = match local_file.read(&mut buffer).await {
                Ok(0) => break, // EOF reached
                Ok(n) => n,
                Err(e) => {
                    Self::fail_task(&task, &app_handle, format!("Read local file error: {}", e)).await;
                    return;
                }
            };

            if let Err(e) = remote_file.write_all(&buffer[..read_bytes]).await {
                Self::fail_task(&task, &app_handle, format!("Write SFTP file error: {}", e)).await;
                return;
            }

            transferred += read_bytes as u64;

            if last_emit.elapsed().as_millis() >= 100 || transferred == total_bytes {
                let elapsed_sec = start_time.elapsed().as_secs_f64();
                let speed_bps = if elapsed_sec > 0.0 {
                    (transferred as f64 / elapsed_sec) as u64
                } else {
                    0
                };

                let mut item = task.item.write().await;
                item.transferred_bytes = transferred;
                item.speed_bps = speed_bps;
                item.updated_at = chrono::Utc::now().timestamp_millis();
                Self::emit_progress(&app_handle, &item);
                last_emit = Instant::now();
            }
        }

        if let Err(e) = remote_file.flush().await {
            Self::fail_task(&task, &app_handle, format!("Flush SFTP file error: {}", e)).await;
            return;
        }

        let mut item = task.item.write().await;
        item.status = TransferStatus::Completed;
        item.transferred_bytes = total_bytes;
        item.updated_at = chrono::Utc::now().timestamp_millis();
        Self::emit_progress(&app_handle, &item);
        info!("Upload task {} completed successfully", item.id);
    }

    async fn upload_directory_recursive(
        sftp_service: Arc<SftpService>,
        server_id: &str,
        local_dir: &Path,
        remote_dir: &str,
        task: &Arc<TaskHandle>,
        app_handle: &Option<tauri::AppHandle>,
    ) -> Result<()> {
        let _ = sftp_service.create_dir(server_id, remote_dir).await;

        let mut dir_reader = tokio::fs::read_dir(local_dir)
            .await
            .map_err(|e| AppError::Sftp(format!("Failed to read local dir: {}", e)))?;

        while let Some(entry) = dir_reader
            .next_entry()
            .await
            .map_err(|e| AppError::Sftp(e.to_string()))?
        {
            if task.cancelled.load(Ordering::SeqCst) {
                return Ok(());
            }
            let file_type = entry
                .file_type()
                .await
                .map_err(|e| AppError::Sftp(e.to_string()))?;
            let name = entry.file_name();
            let name_str = name.to_string_lossy();
            let child_remote = format!("{}/{}", remote_dir.trim_end_matches('/'), name_str);
            let child_local = entry.path();

            if file_type.is_dir() {
                Box::pin(Self::upload_directory_recursive(
                    sftp_service.clone(),
                    server_id,
                    &child_local,
                    &child_remote,
                    task,
                    app_handle,
                ))
                .await?;
            } else {
                Self::upload_file_stream(
                    sftp_service.clone(),
                    server_id,
                    &child_local,
                    &child_remote,
                    task,
                    app_handle,
                )
                .await?;
            }
        }
        Ok(())
    }

    async fn upload_file_stream(
        sftp_service: Arc<SftpService>,
        server_id: &str,
        local_path: &Path,
        remote_path: &str,
        task: &Arc<TaskHandle>,
        app_handle: &Option<tauri::AppHandle>,
    ) -> Result<()> {
        let session = sftp_service.get_or_create_session(server_id).await?;
        let mut local_file = tokio::fs::File::open(local_path)
            .await
            .map_err(|e| AppError::Sftp(format!("Failed to open local file: {}", e)))?;

        let remote_file_res = {
            let sftp = session.lock().await;
            sftp.open_with_flags(
                remote_path,
                OpenFlags::WRITE | OpenFlags::CREATE | OpenFlags::TRUNCATE,
            )
            .await
        };

        let mut remote_file = remote_file_res
            .map_err(|e| AppError::Sftp(format!("Failed to open remote file: {}", e)))?;

        let mut buffer = vec![0u8; CHUNK_SIZE];
        loop {
            if task.cancelled.load(Ordering::SeqCst) {
                return Ok(());
            }
            let read_bytes = local_file
                .read(&mut buffer)
                .await
                .map_err(|e| AppError::Sftp(format!("Read local file error: {}", e)))?;
            if read_bytes == 0 {
                break;
            }
            remote_file
                .write_all(&buffer[..read_bytes])
                .await
                .map_err(|e| AppError::Sftp(format!("Write SFTP file error: {}", e)))?;

            {
                let mut item = task.item.write().await;
                item.transferred_bytes += read_bytes as u64;
                item.updated_at = chrono::Utc::now().timestamp_millis();
                Self::emit_progress(app_handle, &item);
            }
        }

        remote_file
            .flush()
            .await
            .map_err(|e| AppError::Sftp(format!("Flush SFTP file error: {}", e)))?;
        Ok(())
    }

    pub async fn start_download(
        &self,
        server_id: &str,
        remote_path: &str,
        local_path: &str,
        app_handle: Option<tauri::AppHandle>,
    ) -> Result<String> {
        let session = self.sftp.get_or_create_session(server_id).await?;
        let total_bytes = {
            let sftp = session.lock().await;
            let meta = sftp
                .metadata(remote_path)
                .await
                .map_err(|e| AppError::Sftp(format!("Stat remote file failed: {}", e)))?;
            meta.len()
        };

        let filename = Path::new(remote_path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("file")
            .to_string();

        let task_id = Uuid::new_v4().to_string();
        let now = chrono::Utc::now().timestamp_millis();

        let item = TransferItem {
            id: task_id.clone(),
            server_id: server_id.to_string(),
            direction: TransferDirection::Download,
            local_path: local_path.to_string(),
            remote_path: remote_path.to_string(),
            filename,
            total_bytes,
            transferred_bytes: 0,
            status: TransferStatus::Pending,
            error_message: None,
            speed_bps: 0,
            started_at: now,
            updated_at: now,
        };

        let task_handle = Arc::new(TaskHandle {
            item: Arc::new(RwLock::new(item)),
            cancelled: Arc::new(AtomicBool::new(false)),
        });

        {
            let mut tasks = self.tasks.write().await;
            tasks.insert(task_id.clone(), task_handle.clone());
        }

        let sftp_service = self.sftp.clone();
        let server_id_owned = server_id.to_string();
        let remote_path_owned = remote_path.to_string();
        let local_path_owned = local_path.to_string();
        let task_handle_clone = task_handle.clone();

        tokio::spawn(async move {
            Self::execute_download(
                sftp_service,
                server_id_owned,
                remote_path_owned,
                local_path_owned,
                total_bytes,
                task_handle_clone,
                app_handle,
            )
            .await;
        });

        Ok(task_id)
    }

    async fn execute_download(
        sftp_service: Arc<SftpService>,
        server_id: String,
        remote_path: String,
        local_path: String,
        total_bytes: u64,
        task: Arc<TaskHandle>,
        app_handle: Option<tauri::AppHandle>,
    ) {
        {
            let mut item = task.item.write().await;
            item.status = TransferStatus::Transferring;
            item.updated_at = chrono::Utc::now().timestamp_millis();
            Self::emit_progress(&app_handle, &item);
        }

        let session_res = sftp_service.get_or_create_session(&server_id).await;
        let session = match session_res {
            Ok(s) => s,
            Err(e) => {
                Self::fail_task(&task, &app_handle, format!("Failed to get SFTP session: {}", e)).await;
                return;
            }
        };

        let remote_file_res = {
            let sftp = session.lock().await;
            sftp.open_with_flags(&remote_path, OpenFlags::READ).await
        };

        let mut remote_file = match remote_file_res {
            Ok(f) => f,
            Err(e) => {
                Self::fail_task(&task, &app_handle, format!("Failed to open remote file: {}", e)).await;
                return;
            }
        };

        let mut local_file = match tokio::fs::File::create(&local_path).await {
            Ok(f) => f,
            Err(e) => {
                Self::fail_task(&task, &app_handle, format!("Failed to create local file: {}", e)).await;
                return;
            }
        };

        let mut buffer = vec![0u8; CHUNK_SIZE];
        let mut transferred = 0u64;
        let start_time = Instant::now();
        let mut last_emit = Instant::now();

        loop {
            if task.cancelled.load(Ordering::SeqCst) {
                info!("Download task {} was cancelled", task.item.read().await.id);
                drop(local_file);
                let _ = tokio::fs::remove_file(&local_path).await;
                let mut item = task.item.write().await;
                item.status = TransferStatus::Cancelled;
                item.updated_at = chrono::Utc::now().timestamp_millis();
                Self::emit_progress(&app_handle, &item);
                return;
            }

            let read_bytes = match remote_file.read(&mut buffer).await {
                Ok(0) => break,
                Ok(n) => n,
                Err(e) => {
                    Self::fail_task(&task, &app_handle, format!("Read SFTP error: {}", e)).await;
                    return;
                }
            };

            if let Err(e) = local_file.write_all(&buffer[..read_bytes]).await {
                Self::fail_task(&task, &app_handle, format!("Write local file error: {}", e)).await;
                return;
            }

            transferred += read_bytes as u64;

            if last_emit.elapsed().as_millis() >= 100 || transferred == total_bytes {
                let elapsed_sec = start_time.elapsed().as_secs_f64();
                let speed_bps = if elapsed_sec > 0.0 {
                    (transferred as f64 / elapsed_sec) as u64
                } else {
                    0
                };

                let mut item = task.item.write().await;
                item.transferred_bytes = transferred;
                item.speed_bps = speed_bps;
                item.updated_at = chrono::Utc::now().timestamp_millis();
                Self::emit_progress(&app_handle, &item);
                last_emit = Instant::now();
            }
        }

        if let Err(e) = local_file.flush().await {
            Self::fail_task(&task, &app_handle, format!("Flush local file error: {}", e)).await;
            return;
        }

        let mut item = task.item.write().await;
        item.status = TransferStatus::Completed;
        item.transferred_bytes = total_bytes;
        item.updated_at = chrono::Utc::now().timestamp_millis();
        Self::emit_progress(&app_handle, &item);
        info!("Download task {} completed successfully", item.id);
    }

    async fn fail_task(task: &Arc<TaskHandle>, app_handle: &Option<tauri::AppHandle>, error_message: String) {
        error!("Transfer error: {}", error_message);
        let mut item = task.item.write().await;
        item.status = TransferStatus::Failed;
        item.error_message = Some(error_message);
        item.updated_at = chrono::Utc::now().timestamp_millis();
        Self::emit_progress(app_handle, &item);
    }

    fn emit_progress(app_handle: &Option<tauri::AppHandle>, item: &TransferItem) {
        if let Some(app) = app_handle {
            if let Err(err) = app.emit("transfer-progress", item) {
                warn!("Failed to emit transfer-progress: {}", err);
            }
        }
    }
}
