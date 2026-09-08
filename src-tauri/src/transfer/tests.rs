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
