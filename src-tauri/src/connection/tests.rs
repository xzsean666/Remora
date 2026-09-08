#[cfg(test)]
mod tests {
    use super::super::manager::ConnectionManager;
    use super::super::state::ConnectionState;
    use crate::core::{AuthType, ServerConfig};

    #[tokio::test]
    async fn test_connection_state_lifecycle() {
        let manager = ConnectionManager::new();

        // Initially disconnected
        let state = manager.get_state("srv-1").await;
        assert_eq!(state, ConnectionState::Disconnected);

        // Transition to Connecting
        manager
            .set_state("srv-1", ConnectionState::Connecting)
            .await;
        // Since srv-1 wasn't inserted yet, get_state returns Disconnected
        assert_eq!(manager.get_state("srv-1").await, ConnectionState::Disconnected);

        // Attempting connect to an unreachable port triggers Failed status
        let server = ServerConfig {
            id: "srv-fail".to_string(),
            name: "Unreachable".to_string(),
            host: "127.0.0.1".to_string(),
            port: 59999, // Unreachable port
            username: "nobody".to_string(),
            auth_type: AuthType::Password,
            key_path: None,
            default_workspace: None,
            remote_proxy: None,
            remote_no_proxy: None,
            created_at: 0,
            updated_at: 0,
        };

        let result = manager.connect(&server, Some("dummy")).await;
        assert!(result.is_err());

        let final_state = manager.get_state("srv-fail").await;
        match final_state {
            ConnectionState::Failed { error } => {
                assert!(!error.is_empty());
            }
            _ => panic!("Expected Failed state, got {:?}", final_state),
        }

        // Test disconnect resets or clears
        let _ = manager.disconnect("srv-fail").await;
        let disconnected_state = manager.get_state("srv-fail").await;
        assert_eq!(disconnected_state, ConnectionState::Disconnected);
    }

    #[tokio::test]
    async fn test_reconnect_nonexistent() {
        let manager = ConnectionManager::new();
        let res = manager.reconnect("non-existent-server", None).await;
        assert!(res.is_err());
    }

    #[test]
    fn test_expand_home_dir() {
        use super::super::manager::expand_home_dir;

        let home = dirs::home_dir().unwrap_or_else(|| std::path::PathBuf::from("/home/test"));

        let p1 = expand_home_dir("~/ssh/sean");
        assert_eq!(p1, home.join("ssh/sean"));

        let p2 = expand_home_dir("~");
        assert_eq!(p2, home);

        let p3 = expand_home_dir("/etc/ssh/ssh_host_rsa_key");
        assert_eq!(p3, std::path::PathBuf::from("/etc/ssh/ssh_host_rsa_key"));

        // Quotes should be trimmed
        let p4 = expand_home_dir("\"~/ssh/sean\"");
        assert_eq!(p4, home.join("ssh/sean"));
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn test_keyring_inside_tokio_worker_runtime() {
        use crate::security::KeyringService;

        // This verifies that invoking keyring inside a multi-threaded Tokio worker thread
        // NEVER causes 'Cannot start a runtime from within a runtime' panic!
        let keyring = KeyringService::new();
        let set_res = keyring.set_secret("srv-tokio-test", "tokio-pass-123");
        assert!(set_res.is_ok());

        let get_res = keyring.get_secret("srv-tokio-test");
        assert!(get_res.is_ok());
        assert_eq!(get_res.unwrap(), Some("tokio-pass-123".to_string()));

        let del_res = keyring.delete_secret("srv-tokio-test");
        assert!(del_res.is_ok());
    }

    #[tokio::test]
    async fn test_get_all_states() {
        let manager = ConnectionManager::new();
        let all_states = manager.get_all_states().await;
        assert!(all_states.is_empty());
    }
}
