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

    #[test]
    fn test_trashinfo_formatting() {
        let original_path = "/home/developer/projects/app/main.rs";
        let date_str = "2026-09-08T12:00:00";
        let trashinfo = format!("[Trash Info]\nPath={}\nDeletionDate={}\n", original_path, date_str);

        assert!(trashinfo.starts_with("[Trash Info]"));
        assert!(trashinfo.contains("Path=/home/developer/projects/app/main.rs"));
        assert!(trashinfo.contains("DeletionDate=2026-09-08T12:00:00"));
    }

    #[test]
    fn test_trash_filename_conflict_handling() {
        let filename = "document.pdf";
        let timestamp = "20260908_120000";
        let (stem, ext) = match filename.rfind('.') {
            Some(idx) if idx > 0 => (&filename[..idx], &filename[idx..]),
            _ => (filename, ""),
        };
        let unique_name = format!("{}_{}{}", stem, timestamp, ext);
        assert_eq!(unique_name, "document_20260908_120000.pdf");

        let dir_name = "my_folder";
        let (d_stem, d_ext) = match dir_name.rfind('.') {
            Some(idx) if idx > 0 => (&dir_name[..idx], &dir_name[idx..]),
            _ => (dir_name, ""),
        };
        let unique_dir = format!("{}_{}{}", d_stem, timestamp, d_ext);
        assert_eq!(unique_dir, "my_folder_20260908_120000");
    }

    #[test]
    fn test_guess_image_mime_by_extension_and_magic() {
        use crate::sftp::service::guess_image_mime;

        assert_eq!(guess_image_mime("avatar.png", &[]), "image/png");
        assert_eq!(guess_image_mime("photo.jpg", &[]), "image/jpeg");
        assert_eq!(guess_image_mime("photo.jpeg", &[]), "image/jpeg");
        assert_eq!(guess_image_mime("anim.gif", &[]), "image/gif");
        assert_eq!(guess_image_mime("banner.webp", &[]), "image/webp");
        assert_eq!(guess_image_mime("logo.svg", &[]), "image/svg+xml");
        assert_eq!(guess_image_mime("favicon.ico", &[]), "image/x-icon");
        assert_eq!(guess_image_mime("bitmap.bmp", &[]), "image/bmp");
        assert_eq!(guess_image_mime("hero.avif", &[]), "image/avif");

        // Magic bytes fallback when extension is absent or ambiguous
        assert_eq!(guess_image_mime("raw_data", b"\x89PNG\r\n\x1a\n"), "image/png");
        assert_eq!(guess_image_mime("raw_data", &[0xff, 0xd8, 0xff]), "image/jpeg");
        assert_eq!(guess_image_mime("raw_data", b"GIF89a"), "image/gif");
        assert_eq!(guess_image_mime("unknown.bin", b"hello world"), "application/octet-stream");
    }
}
