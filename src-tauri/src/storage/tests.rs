#[cfg(test)]
mod tests {
    use super::super::db::StorageService;
    use crate::core::{AuthType, LayoutPreferences, RecentProject, ServerConfig};
    use crate::security::KeyringService;

    #[test]
    fn test_server_crud() {
        let storage = StorageService::new_in_memory().expect("failed to init db");

        let server = ServerConfig {
            id: "srv-1".to_string(),
            name: "Test Server".to_string(),
            host: "192.168.1.100".to_string(),
            port: 22,
            username: "root".to_string(),
            auth_type: AuthType::Password,
            key_path: None,
            default_workspace: Some("/var/www".to_string()),
            remote_proxy: Some("127.0.0.1:1080".to_string()),
            remote_no_proxy: Some("localhost,127.0.0.1,172.16.0.0/12".to_string()),
            created_at: 1000,
            updated_at: 1000,
        };

        // 1. Create
        storage.save_server(&server).expect("save server failed");

        // 2. Read
        let fetched = storage.get_server("srv-1").expect("get server failed");
        assert!(fetched.is_some());
        let fetched = fetched.unwrap();
        assert_eq!(fetched.name, "Test Server");
        assert_eq!(fetched.host, "192.168.1.100");
        assert_eq!(fetched.auth_type, AuthType::Password);
        assert_eq!(fetched.remote_proxy, Some("127.0.0.1:1080".to_string()));
        assert_eq!(fetched.remote_no_proxy, Some("localhost,127.0.0.1,172.16.0.0/12".to_string()));

        // 3. Update
        let mut updated = server.clone();
        updated.name = "Renamed Server".to_string();
        updated.remote_proxy = Some("socks5://127.0.0.1:1080".to_string());
        updated.remote_no_proxy = Some("localhost,10.0.0.0/8".to_string());
        updated.updated_at = 2000;
        storage.save_server(&updated).expect("update server failed");

        let fetched_updated = storage.get_server("srv-1").unwrap().unwrap();
        assert_eq!(fetched_updated.name, "Renamed Server");
        assert_eq!(fetched_updated.remote_proxy, Some("socks5://127.0.0.1:1080".to_string()));
        assert_eq!(fetched_updated.remote_no_proxy, Some("localhost,10.0.0.0/8".to_string()));
        assert_eq!(fetched_updated.updated_at, 2000);

        // 4. List
        let list = storage.get_servers().expect("get_servers failed");
        assert_eq!(list.len(), 1);

        // 5. Delete
        storage.delete_server("srv-1").expect("delete failed");
        let after_delete = storage.get_server("srv-1").unwrap();
        assert!(after_delete.is_none());
    }

    #[test]
    fn test_recent_projects_crud() {
        let storage = StorageService::new_in_memory().expect("failed to init db");

        let project1 = RecentProject {
            id: "proj-1".to_string(),
            server_id: "srv-1".to_string(),
            server_name: "Ubuntu Dev".to_string(),
            project_name: "api-backend".to_string(),
            remote_path: "/root/api-backend".to_string(),
            last_opened_at: 100,
        };

        let project2 = RecentProject {
            id: "proj-2".to_string(),
            server_id: "srv-1".to_string(),
            server_name: "Ubuntu Dev".to_string(),
            project_name: "web-frontend".to_string(),
            remote_path: "/root/web-frontend".to_string(),
            last_opened_at: 200,
        };

        storage.add_recent_project(&project1).unwrap();
        storage.add_recent_project(&project2).unwrap();

        let recents = storage.get_recent_projects(10).unwrap();
        assert_eq!(recents.len(), 2);
        // Project 2 should be first because last_opened_at is higher
        assert_eq!(recents[0].id, "proj-2");

        storage.remove_recent_project("proj-1").unwrap();
        let recents_after = storage.get_recent_projects(10).unwrap();
        assert_eq!(recents_after.len(), 1);
        assert_eq!(recents_after[0].id, "proj-2");
    }

    #[test]
    fn test_preferences() {
        let storage = StorageService::new_in_memory().expect("failed to init db");

        storage.set_preference("theme", "dark").unwrap();
        let val = storage.get_preference("theme").unwrap();
        assert_eq!(val, Some("dark".to_string()));

        let prefs = LayoutPreferences {
            sidebar_width: Some(300),
            terminal_height: Some(250),
            sidebar_visible: Some(true),
            terminal_visible: Some(true),
            active_sidebar_tab: Some("explorer".to_string()),
        };

        storage.set_layout_preferences(&prefs).unwrap();
        let loaded = storage.get_layout_preferences().unwrap();
        assert_eq!(loaded.sidebar_width, Some(300));
        assert_eq!(loaded.terminal_height, Some(250));
    }

    #[test]
    fn test_keyring_safe_storage() {
        let keyring = KeyringService::new();
        keyring.set_secret("srv-1", "mypassword123").unwrap();
        let secret = keyring.get_secret("srv-1").unwrap();
        assert_eq!(secret, Some("mypassword123".to_string()));

        keyring.delete_secret("srv-1").unwrap();
        let secret_after = keyring.get_secret("srv-1").unwrap();
        assert_eq!(secret_after, None);
    }
}
