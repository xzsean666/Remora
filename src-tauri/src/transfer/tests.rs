#[cfg(test)]
mod tests {
    use std::sync::Arc;
    use crate::connection::ConnectionManager;
    use crate::sftp::SftpService;
    use crate::transfer::manager::TransferManager;
    use crate::transfer::model::{TransferDirection, TransferStatus};

    #[tokio::test]
    async fn test_transfer_manager_empty_list() {
        let conn = Arc::new(ConnectionManager::new());
        let sftp = Arc::new(SftpService::new(conn));
        let manager = TransferManager::new(sftp);

        let transfers = manager.list_transfers().await;
        assert!(transfers.is_empty());
    }

    #[tokio::test]
    async fn test_transfer_cancel_nonexistent() {
        let conn = Arc::new(ConnectionManager::new());
        let sftp = Arc::new(SftpService::new(conn));
        let manager = TransferManager::new(sftp);

        let res = manager.cancel_transfer("non-existent-id").await;
        assert!(res.is_err());
    }

    #[tokio::test]
    async fn test_start_upload_nonexistent_local_file() {
        let conn = Arc::new(ConnectionManager::new());
        let sftp = Arc::new(SftpService::new(conn));
        let manager = TransferManager::new(sftp);

        let res = manager.start_upload("srv-1", "/nonexistent/path/here", "/remote/test", None).await;
        assert!(res.is_err());
    }

    #[tokio::test]
    async fn test_start_upload_local_directory() {
        let conn = Arc::new(ConnectionManager::new());
        let sftp = Arc::new(SftpService::new(conn));
        let manager = TransferManager::new(sftp);

        let temp_dir = std::env::temp_dir();
        let test_dir = temp_dir.join(format!("remora_test_upload_dir_{}", std::process::id()));
        let _ = tokio::fs::create_dir_all(&test_dir).await;
        let _ = tokio::fs::write(test_dir.join("sample.txt"), "hello").await;

        let res = manager.start_upload("srv-1", test_dir.to_str().unwrap(), "/remote/test_dir", None).await;
        assert!(res.is_ok());

        let _ = tokio::fs::remove_dir_all(&test_dir).await;
    }

    #[test]
    fn test_transfer_model_serialization() {
        let item = crate::transfer::model::TransferItem {
            id: "test-id".into(),
            server_id: "srv-1".into(),
            direction: TransferDirection::Upload,
            local_path: "/local/file.txt".into(),
            remote_path: "/remote/file.txt".into(),
            filename: "file.txt".into(),
            total_bytes: 1024,
            transferred_bytes: 512,
            status: TransferStatus::Transferring,
            error_message: None,
            speed_bps: 10240,
            started_at: 1000,
            updated_at: 1500,
        };

        let json = serde_json::to_string(&item).expect("Failed to serialize");
        assert!(json.contains("upload"));
        assert!(json.contains("transferring"));
        assert!(json.contains("file.txt"));
    }
}
