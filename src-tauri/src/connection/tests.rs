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
}
