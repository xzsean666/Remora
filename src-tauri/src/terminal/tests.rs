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

    #[test]
    fn test_build_startup_cmd_variants() {
        use crate::terminal::session::TerminalSession;

        // Case 1: Empty inputs
        assert_eq!(TerminalSession::build_startup_cmd(None, None, None), None);
        assert_eq!(TerminalSession::build_startup_cmd(Some(""), Some(""), Some("")), None);
        assert_eq!(TerminalSession::build_startup_cmd(Some("   "), Some("   "), Some("   ")), None);

        // Case 2: Only initial_dir
        let dir_cmd = TerminalSession::build_startup_cmd(Some("/home/user/project"), None, None).unwrap();
        assert!(dir_cmd.contains("cd \"/home/user/project\""));
        assert!(dir_cmd.contains("clear"));
        assert!(!dir_cmd.contains("http_proxy"));

        // Case 3: Bare remote_proxy without protocol scheme with default rich NO_PROXY
        let proxy_cmd = TerminalSession::build_startup_cmd(None, Some("127.0.0.1:1080"), None).unwrap();
        assert!(proxy_cmd.contains("export http_proxy=\"http://127.0.0.1:1080\""));
        assert!(proxy_cmd.contains("https_proxy=\"http://127.0.0.1:1080\""));
        assert!(proxy_cmd.contains("all_proxy=\"http://127.0.0.1:1080\""));
        assert!(proxy_cmd.contains("HTTP_PROXY=\"http://127.0.0.1:1080\""));
        assert!(proxy_cmd.contains("HTTPS_PROXY=\"http://127.0.0.1:1080\""));
        assert!(proxy_cmd.contains("ALL_PROXY=\"http://127.0.0.1:1080\""));
        // Check Docker range and internal IPs in default no_proxy
        assert!(proxy_cmd.contains("172.16.0.0/12"));
        assert!(proxy_cmd.contains("172.17.0.0/16"));
        assert!(proxy_cmd.contains("172.18.0.0/16"));
        assert!(proxy_cmd.contains("host.docker.internal"));
        assert!(proxy_cmd.contains("10.0.0.0/8"));
        assert!(proxy_cmd.contains("192.168.0.0/16"));
        assert!(proxy_cmd.contains("localhost,127.0.0.1,::1"));
        assert!(proxy_cmd.contains("printf \"\\033[36m[Remora] Remote proxy active: %s\\033[0m\\n\" \"http://127.0.0.1:1080\""));
        assert!(proxy_cmd.contains("clear"));

        // Case 4: SOCKS5 proxy with custom no_proxy and initial_dir
        let socks_cmd = TerminalSession::build_startup_cmd(
            Some("/var/www/html"),
            Some("socks5://127.0.0.1:1080"),
            Some("localhost,my-docker-net,172.17.0.0/16"),
        )
        .unwrap();
        assert!(socks_cmd.contains("export http_proxy=\"socks5://127.0.0.1:1080\""));
        assert!(socks_cmd.contains("all_proxy=\"socks5://127.0.0.1:1080\""));
        assert!(socks_cmd.contains("no_proxy=\"localhost,my-docker-net,172.17.0.0/16\""));
        assert!(socks_cmd.contains("NO_PROXY=\"localhost,my-docker-net,172.17.0.0/16\""));
        assert!(socks_cmd.contains("cd \"/var/www/html\""));
        assert!(socks_cmd.contains("printf \"\\033[36m[Remora] Remote proxy active: %s\\033[0m\\n\" \"socks5://127.0.0.1:1080\""));
    }

    #[tokio::test]
    async fn test_terminal_open_disconnected_server_fails_fast() {
        let connection = Arc::new(ConnectionManager::new());
        let terminal = TerminalManager::new(connection);

        // Writing to non-existent session immediately returns error without hanging
        let res = terminal.write("nonexistent-term", vec![1, 2, 3]).await;
        assert!(res.is_err());
        let err_msg = res.unwrap_err().to_string();
        assert!(err_msg.contains("not found"));
    }
}
