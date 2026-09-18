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

    #[test]
    fn test_default_download_dir() {
        let dir = TransferManager::get_default_download_dir();
        assert!(dir.ends_with("Remora"));
    }

    #[tokio::test]
    async fn test_get_safe_local_download_path_nonexistent() {
        let temp_dir = std::env::temp_dir();
        let target = temp_dir.join(format!("unique_file_test_{}.tar.gz", std::process::id()));
        if target.exists() {
            let _ = tokio::fs::remove_file(&target).await;
        }

        let safe = TransferManager::get_safe_local_download_path(&target);
        assert_eq!(safe, target);
    }

    #[tokio::test]
    async fn test_get_safe_local_download_path_collision_avoidance() {
        let temp_dir = std::env::temp_dir();
        let base_name = format!("collision_test_{}.tar.gz", std::process::id());
        let target = temp_dir.join(&base_name);

        // Create the base file
        let _ = tokio::fs::write(&target, "content").await;

        let safe = TransferManager::get_safe_local_download_path(&target);
        let expected_candidate = temp_dir.join(format!("collision_test_{}-1.tar.gz", std::process::id()));
        assert_eq!(safe, expected_candidate);

        // Also create candidate 1 to verify candidate 2
        let _ = tokio::fs::write(&expected_candidate, "content2").await;
        let safe2 = TransferManager::get_safe_local_download_path(&target);
        let expected_candidate2 = temp_dir.join(format!("collision_test_{}-2.tar.gz", std::process::id()));
        assert_eq!(safe2, expected_candidate2);

        // Clean up
        let _ = tokio::fs::remove_file(&target).await;
        let _ = tokio::fs::remove_file(&expected_candidate).await;
    }

    #[test]
    fn test_build_folder_pack_script() {
        let remote_path = "/home/ubuntu/projects/my-app";
        let archive_path = "/tmp/test_archive.tar.gz";

        let script = TransferManager::build_folder_pack_script(remote_path, archive_path);
        assert!(script.contains("decode_b64"));
        assert!(script.contains("TARGET_DIR="));
        assert!(script.contains("git -C \"$TARGET_DIR\" rev-parse --is-inside-work-tree"));
        assert!(script.contains("git -C \"$TARGET_DIR\" ls-files -z --cached --others --exclude-standard"));
        assert!(script.contains("exclude-vcs-ignores"));
        assert!(script.contains("SUCCESS:$ARCHIVE_SIZE"));
    }

    #[tokio::test]
    async fn test_start_download_folder_without_connection() {
        let conn = Arc::new(ConnectionManager::new());
        let sftp = Arc::new(SftpService::new(conn));
        let manager = TransferManager::new(sftp); // connection is None

        let res = manager
            .start_download_folder("srv-1", "/remote/test_dir", "", None)
            .await;
        assert!(res.is_err());
    }

    #[tokio::test]
    async fn test_start_download_folder_with_connection() {
        let conn = Arc::new(ConnectionManager::new());
        let sftp = Arc::new(SftpService::new(conn.clone()));
        let manager = TransferManager::with_connection(sftp, conn);

        let res = manager
            .start_download_folder("srv-1", "/remote/test_dir", "", None)
            .await;
        assert!(res.is_ok());

        let task_id = res.unwrap();
        let item = manager.get_transfer(&task_id).await;
        assert!(item.is_some());
        let item = item.unwrap();
        assert_eq!(item.filename, "test_dir.tar.gz");
        assert_eq!(item.direction, TransferDirection::Download);
        assert_eq!(item.status, TransferStatus::Pending);
    }
}
