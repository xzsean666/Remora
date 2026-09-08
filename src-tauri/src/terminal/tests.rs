#[cfg(test)]
mod tests {
    use std::sync::Arc;
    use crate::connection::ConnectionManager;
    use crate::terminal::TerminalManager;

    #[tokio::test]
    async fn test_terminal_manager_lifecycle() {
        let connection = Arc::new(ConnectionManager::new());
        let terminal = TerminalManager::new(connection);

        // Writing or resizing a non-existent session should fail with AppError::Terminal
        let write_res = terminal.write("term-nonexistent", vec![1, 2, 3]).await;
        assert!(write_res.is_err());

        let resize_res = terminal.resize("term-nonexistent", 80, 24).await;
        assert!(resize_res.is_err());

        // Closing a non-existent session should succeed gracefully
        let close_res = terminal.close("term-nonexistent").await;
        assert!(close_res.is_ok());

        // close_all_for_server on empty manager should not panic
        terminal.close_all_for_server("srv-1").await;
    }
}
