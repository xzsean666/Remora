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

    #[test]
    fn test_quick_snippets_crud_and_groups() {
        let storage = StorageService::new_in_memory().expect("failed to init db");

        // 1. Verify default seed snippets are auto populated
        let initial_snippets = storage.get_quick_snippets().expect("failed to get snippets");
        assert_eq!(initial_snippets.len(), 15);

        // 2. Add custom snippet
        let custom_snippet = crate::core::QuickSnippet {
            id: "custom-1".to_string(),
            title: "Build Production".to_string(),
            command: "cargo build --release".to_string(),
            group_name: "Build".to_string(),
            auto_execute: true,
            description: Some("Compile release binary".to_string()),
            sort_order: 1,
            created_at: 1000,
            updated_at: 1000,
        };
        storage.save_quick_snippet(&custom_snippet).expect("failed to save snippet");

        let snippets_after_add = storage.get_quick_snippets().unwrap();
        assert_eq!(snippets_after_add.len(), 16);
        let found = snippets_after_add.iter().find(|s| s.id == "custom-1").unwrap();
        assert_eq!(found.title, "Build Production");
        assert_eq!(found.command, "cargo build --release");
        assert_eq!(found.group_name, "Build");
        assert!(found.auto_execute);

        // 3. Update snippet
        let mut updated = custom_snippet.clone();
        updated.command = "cargo build --release -v".to_string();
        updated.auto_execute = false;
        updated.updated_at = 2000;
        storage.save_quick_snippet(&updated).expect("failed to update snippet");

        let snippets_after_update = storage.get_quick_snippets().unwrap();
        let updated_found = snippets_after_update.iter().find(|s| s.id == "custom-1").unwrap();
        assert_eq!(updated_found.command, "cargo build --release -v");
        assert!(!updated_found.auto_execute);

        // 4. Rename group
        storage.rename_quick_snippet_group("Build", "CI/CD").expect("failed to rename group");
        let snippets_after_rename = storage.get_quick_snippets().unwrap();
        let renamed_found = snippets_after_rename.iter().find(|s| s.id == "custom-1").unwrap();
        assert_eq!(renamed_found.group_name, "CI/CD");

        // 5. Delete individual snippet
        storage.delete_quick_snippet("custom-1").expect("failed to delete snippet");
        let snippets_after_del = storage.get_quick_snippets().unwrap();
        assert_eq!(snippets_after_del.len(), 15);
        assert!(snippets_after_del.iter().all(|s| s.id != "custom-1"));

        // 6. Delete group
        storage.delete_quick_snippet_group("System").expect("failed to delete group");
        let snippets_after_grp_del = storage.get_quick_snippets().unwrap();
        assert!(snippets_after_grp_del.iter().all(|s| s.group_name != "System"));
        assert_eq!(snippets_after_grp_del.len(), 11); // 15 - 4 System snippets
    }

    #[test]
    fn test_quick_snippets_batch_import() {
        let storage = StorageService::new_in_memory().expect("failed to init db");

        let batch = vec![
            crate::core::QuickSnippet {
                id: "import-1".to_string(),
                title: "K8s Pods".to_string(),
                command: "kubectl get pods -A".to_string(),
                group_name: "Kubernetes".to_string(),
                auto_execute: true,
                description: Some("List all pods across namespaces".to_string()),
                sort_order: 1,
                created_at: 1000,
                updated_at: 1000,
            },
            crate::core::QuickSnippet {
                id: "import-2".to_string(),
                title: "K8s Nodes".to_string(),
                command: "kubectl get nodes -o wide".to_string(),
                group_name: "Kubernetes".to_string(),
                auto_execute: true,
                description: None,
                sort_order: 2,
                created_at: 1000,
                updated_at: 1000,
            },
        ];

        // 1. Merge Import (overwrite = false)
        let count = storage.import_quick_snippets(&batch, false).expect("import failed");
        assert_eq!(count, 2);

        let list = storage.get_quick_snippets().unwrap();
        assert_eq!(list.len(), 17); // 15 defaults + 2 imported
        assert!(list.iter().any(|s| s.id == "import-1"));
        assert!(list.iter().any(|s| s.id == "import-2"));

        // 2. Overwrite Import (overwrite = true)
        let single_item = vec![
            crate::core::QuickSnippet {
                id: "clean-1".to_string(),
                title: "Echo Hello".to_string(),
                command: "echo hello".to_string(),
                group_name: "Testing".to_string(),
                auto_execute: false,
                description: None,
                sort_order: 0,
                created_at: 2000,
                updated_at: 2000,
            },
        ];
        let overwrite_count = storage.import_quick_snippets(&single_item, true).expect("overwrite failed");
        assert_eq!(overwrite_count, 1);

        let list_after_overwrite = storage.get_quick_snippets().unwrap();
        assert_eq!(list_after_overwrite.len(), 1);
        assert_eq!(list_after_overwrite[0].id, "clean-1");
        assert_eq!(list_after_overwrite[0].title, "Echo Hello");
    }

    #[test]
    fn test_ssh_keys_crud() {
        let storage = StorageService::new_in_memory().expect("failed to init db");

        // Initially empty
        let keys = storage.get_ssh_keys().unwrap();
        assert_eq!(keys.len(), 0);

        // Save a key
        let key = crate::core::SshKey {
            id: "key-1".to_string(),
            name: "My Server Key".to_string(),
            private_key: "-----BEGIN OPENSSH PRIVATE KEY-----\ntest\n-----END OPENSSH PRIVATE KEY-----".to_string(),
            passphrase: Some("secret123".to_string()),
            public_key: Some("ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA test@remora".to_string()),
            created_at: 1000,
            updated_at: 1000,
        };
        storage.save_ssh_key(&key).unwrap();

        let fetched = storage.get_ssh_key("key-1").unwrap().expect("key should exist");
        assert_eq!(fetched.name, "My Server Key");
        assert_eq!(fetched.passphrase, Some("secret123".to_string()));

        let all_keys = storage.get_ssh_keys().unwrap();
        assert_eq!(all_keys.len(), 1);

        // Update key
        let updated_key = crate::core::SshKey {
            name: "Updated Server Key".to_string(),
            ..key
        };
        storage.save_ssh_key(&updated_key).unwrap();
        let fetched_updated = storage.get_ssh_key("key-1").unwrap().unwrap();
        assert_eq!(fetched_updated.name, "Updated Server Key");

        // Delete key
        storage.delete_ssh_key("key-1").unwrap();
        let after_delete = storage.get_ssh_key("key-1").unwrap();
        assert_eq!(after_delete, None);
    }
}


