use std::sync::Arc;
use remora_lib::connection::{ConnectionManager, ConnectionState};
use remora_lib::core::{AuthType, FileEntry, ServerConfig};
use remora_lib::security::KeyringService;
use remora_lib::sftp::file_entry::sort_file_entries;
use remora_lib::sftp::SftpService;
use remora_lib::storage::StorageService;
use remora_lib::terminal::TerminalManager;
use remora_lib::transfer::TransferManager;

#[tokio::test]
async fn test_e2e_full_stack_lifecycle() {
    // 1. Storage & Keyring Layer
    let storage = StorageService::new_in_memory().expect("In-memory storage failed");
    let keyring = KeyringService::new();

    let server_id = "test-e2e-srv-1";
    let server = ServerConfig {
        id: server_id.to_string(),
        name: "E2E Production Server".to_string(),
        host: "10.0.0.1".to_string(),
        port: 22,
        username: "developer".to_string(),
        auth_type: AuthType::Password,
        key_path: None,
        default_workspace: Some("/home/developer/workspace".to_string()),
        created_at: 1000,
        updated_at: 1000,
    };

    // Save server to SQLite
    storage.save_server(&server).expect("Failed to save server");
    let loaded_server = storage.get_server(server_id).expect("Failed to get server");
    assert!(loaded_server.is_some());
    assert_eq!(loaded_server.unwrap().name, "E2E Production Server");

    // Save credentials to Keyring
    keyring.set_secret(server_id, "super_secure_password").expect("Failed to set secret");
    let secret = keyring.get_secret(server_id).expect("Failed to get secret");
    assert_eq!(secret, Some("super_secure_password".to_string()));

    // 2. Connection Manager
    let conn_manager = Arc::new(ConnectionManager::new());
    let init_state = conn_manager.get_state(server_id).await;
    assert_eq!(init_state, ConnectionState::Disconnected);

    conn_manager.set_state(server_id, ConnectionState::Connecting).await;
    assert_eq!(conn_manager.get_state(server_id).await, ConnectionState::Disconnected); // not yet in active sessions

    // 3. SFTP File Service
    let sftp_service = Arc::new(SftpService::new(conn_manager.clone()));
    let mut files = vec![
        FileEntry {
            name: "package.json".to_string(),
            path: "/home/developer/package.json".to_string(),
            is_dir: false,
            is_symlink: false,
            size: 1024,
            mtime: 100,
        },
        FileEntry {
            name: "src".to_string(),
            path: "/home/developer/src".to_string(),
            is_dir: true,
            is_symlink: false,
            size: 4096,
            mtime: 200,
        },
        FileEntry {
            name: ".gitignore".to_string(),
            path: "/home/developer/.gitignore".to_string(),
            is_dir: false,
            is_symlink: false,
            size: 256,
            mtime: 50,
        },
    ];

    sort_file_entries(&mut files);
    assert!(files[0].is_dir);
    assert_eq!(files[0].name, "src");
    assert_eq!(files[1].name, ".gitignore");
    assert_eq!(files[2].name, "package.json");

    // 4. Terminal Manager
    let terminal_manager = TerminalManager::new(conn_manager.clone());
    let write_res = terminal_manager.write("non-existent-session", vec![1, 2, 3]).await;
    assert!(write_res.is_err());

    // 5. Transfer Manager
    let transfer_manager = TransferManager::new(sftp_service.clone());
    let transfers = transfer_manager.list_transfers().await;
    assert!(transfers.is_empty());

    // Clean up
    keyring.delete_secret(server_id).expect("Failed to delete secret");
    assert_eq!(keyring.get_secret(server_id).expect("Secret deleted"), None);

    storage.delete_server(server_id).expect("Failed to delete server");
    assert!(storage.get_server(server_id).expect("Server deleted").is_none());
}
