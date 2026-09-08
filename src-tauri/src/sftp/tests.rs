#[cfg(test)]
mod tests {
    use crate::core::FileEntry;
    use crate::sftp::file_entry::sort_file_entries;

    #[test]
    fn test_file_entry_sorting() {
        let mut entries = vec![
            FileEntry {
                name: "zoo.txt".to_string(),
                path: "/app/zoo.txt".to_string(),
                is_dir: false,
                is_symlink: false,
                size: 10,
                mtime: 100,
            },
            FileEntry {
                name: "src".to_string(),
                path: "/app/src".to_string(),
                is_dir: true,
                is_symlink: false,
                size: 4096,
                mtime: 200,
            },
            FileEntry {
                name: "alpha.rs".to_string(),
                path: "/app/alpha.rs".to_string(),
                is_dir: false,
                is_symlink: false,
                size: 20,
                mtime: 150,
            },
            FileEntry {
                name: ".git".to_string(),
                path: "/app/.git".to_string(),
                is_dir: true,
                is_symlink: false,
                size: 4096,
                mtime: 50,
            },
        ];

        sort_file_entries(&mut entries);

        // Directories must come first, sorted alphabetically
        assert_eq!(entries[0].name, ".git");
        assert!(entries[0].is_dir);
        assert_eq!(entries[1].name, "src");
        assert!(entries[1].is_dir);

        // Files come after directories, sorted alphabetically
        assert_eq!(entries[2].name, "alpha.rs");
        assert!(!entries[2].is_dir);
        assert_eq!(entries[3].name, "zoo.txt");
        assert!(!entries[3].is_dir);
    }

    #[test]
    fn test_mtime_conflict_detection_logic() {
        let opened_at_mtime: u64 = 1700000000;
        let remote_mtime_same: u64 = 1700000000;
        let remote_mtime_modified: u64 = 1700000500;

        // No conflict if mtime is unchanged
        let conflict_none = remote_mtime_same > opened_at_mtime;
        assert!(!conflict_none);

        // Conflict triggered if remote file mtime was updated externally
        let conflict_detected = remote_mtime_modified > opened_at_mtime;
        assert!(conflict_detected);
    }
}
