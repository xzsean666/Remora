use russh_sftp::client::fs::DirEntry;
use crate::core::FileEntry;

pub fn from_dir_entry(entry: &DirEntry) -> FileEntry {
    let name = entry.file_name();
    let path = entry.path();
    let meta = entry.metadata();
    let is_dir = meta.is_dir();
    let is_symlink = meta.is_symlink();
    let size = meta.len();
    let mtime = meta.mtime.unwrap_or(0) as u64;

    FileEntry {
        name,
        path,
        is_dir,
        is_symlink,
        size,
        mtime,
    }
}

pub fn sort_file_entries(entries: &mut [FileEntry]) {
    entries.sort_by(|a, b| {
        if a.is_dir && !b.is_dir {
            std::cmp::Ordering::Less
        } else if !a.is_dir && b.is_dir {
            std::cmp::Ordering::Greater
        } else {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        }
    });
}
