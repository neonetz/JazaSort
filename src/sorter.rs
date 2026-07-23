use chrono::{DateTime, Local};
use id3::TagLike;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{self, File};
use std::path::Path;
use std::sync::Mutex;
use walkdir::WalkDir;

use crate::config::{Config, Rule};
use crate::stats;

pub const SYSTEM_PATHS: &[&str] = &[
    "C:\\",
    "C:\\Windows",
    "C:\\Program Files",
    "C:\\Program Files (x86)",
    "C:\\System32",
];

pub fn is_system_path(path: &str) -> bool {
    let cleaned = path.trim_end_matches(['\\', '/']).to_lowercase();
    for sys in SYSTEM_PATHS {
        let sys_cleaned = sys.trim_end_matches(['\\', '/']).to_lowercase();
        if sys_cleaned == "c:" {
            if cleaned == "c:" {
                return true;
            }
        } else if cleaned == sys_cleaned || cleaned.starts_with(&format!("{}\\", sys_cleaned)) || cleaned.starts_with(&format!("{}/", sys_cleaned)) {
            return true;
        }
    }
    false
}


lazy_static::lazy_static! {
    static ref SORT_CANCEL_FLAG: Mutex<bool> = Mutex::new(false);
    static ref LAST_MOVE_HISTORY: Mutex<Vec<MoveRecord>> = Mutex::new(Vec::new());
}

pub fn cancel_sort() {
    let mut flag = SORT_CANCEL_FLAG.lock().unwrap();
    *flag = true;
}

pub fn is_sort_cancelled() -> bool {
    *SORT_CANCEL_FLAG.lock().unwrap()
}

pub fn reset_cancel_flag() {
    let mut flag = SORT_CANCEL_FLAG.lock().unwrap();
    *flag = false;
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Default)]
pub struct TreeNode {
    pub id: String,
    pub name: String,
    pub is_dir: bool,
    pub children: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Default)]
pub struct ScanResult {
    pub nodes: HashMap<String, TreeNode>,
    pub root_id: String,
    pub extension_stats: HashMap<String, usize>,
    pub total_sortable: usize,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct MoveRecord {
    pub original_path: String,
    pub new_path: String,
    pub size_bytes: u64,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct SortProgressPayload {
    pub total_moved: usize,
    pub total_errors: usize,
    pub is_done: bool,
    pub error_msg: String,
}

pub fn scan_directory(root_folder: &str, cfg: &Config) -> Result<ScanResult, String> {
    let root_path = Path::new(root_folder);
    if !root_path.exists() {
        return Err(format!("Path does not exist: {}", root_folder));
    }

    let mut result = ScanResult {
        root_id: root_folder.to_string(),
        ..Default::default()
    };

    let root_name = root_path
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| root_folder.to_string());

    result.nodes.insert(
        root_folder.to_string(),
        TreeNode {
            id: root_folder.to_string(),
            name: root_name,
            is_dir: true,
            children: Vec::new(),
        },
    );

    let walker = WalkDir::new(root_folder).min_depth(1);
    for entry in walker.into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        let path_str = path.to_string_lossy().to_string();
        let parent_path_str = path.parent().map(|p| p.to_string_lossy().to_string()).unwrap_or_default();

        if !cfg.scan_subfolders && parent_path_str != root_folder {
            continue;
        }

        let is_dir = entry.file_type().is_dir();
        let file_name = entry.file_name().to_string_lossy().to_string();

        if !is_dir {
            if let Ok(metadata) = entry.metadata() {
                let size_bytes = metadata.len();
                if let Some(_matched_rule) = find_matching_rule(&file_name, size_bytes, &cfg.rules) {
                    let ext = path
                        .extension()
                        .map(|s| format!(".{}", s.to_string_lossy().to_lowercase()))
                        .unwrap_or_else(|| "no_ext".to_string());

                    *result.extension_stats.entry(ext).or_insert(0) += 1;
                    result.total_sortable += 1;
                } else if cfg.hide_unsupported {
                    continue;
                }
            }
        }

        result.nodes.insert(
            path_str.clone(),
            TreeNode {
                id: path_str.clone(),
                name: file_name,
                is_dir,
                children: Vec::new(),
            },
        );

        if let Some(parent_node) = result.nodes.get_mut(&parent_path_str) {
            parent_node.children.push(path_str);
        }
    }

    if cfg.hide_unsupported {
        let mut changed = true;
        while changed {
            changed = false;
            let keys: Vec<String> = result.nodes.keys().cloned().collect();
            for id in keys {
                if id == root_folder {
                    continue;
                }
                let is_empty_dir = {
                    if let Some(node) = result.nodes.get(&id) {
                        node.is_dir && node.children.is_empty()
                    } else {
                        false
                    }
                };

                if is_empty_dir {
                    let parent_path = Path::new(&id).parent().map(|p| p.to_string_lossy().to_string());
                    if let Some(parent_str) = parent_path {
                        if let Some(parent) = result.nodes.get_mut(&parent_str) {
                            parent.children.retain(|c| c != &id);
                        }
                    }
                    result.nodes.remove(&id);
                    changed = true;
                }
            }
        }
    }

    Ok(result)
}

pub fn sort_files_sync<F>(root_folder: &str, cfg: &Config, mut progress_cb: F)
where
    F: FnMut(SortProgressPayload),
{
    reset_cancel_flag();
    LAST_MOVE_HISTORY.lock().unwrap().clear();

    let mut total_moved = 0;
    let mut total_errors = 0;
    let mut total_bytes_moved: u64 = 0;
    let mut errors: Vec<String> = Vec::new();

    let walker = WalkDir::new(root_folder).min_depth(1);
    for entry in walker.into_iter().filter_map(|e| e.ok()) {
        if is_sort_cancelled() {
            break;
        }

        let path = entry.path();
        let parent_path_str = path.parent().map(|p| p.to_string_lossy().to_string()).unwrap_or_default();

        if !cfg.scan_subfolders && parent_path_str != root_folder {
            continue;
        }

        if entry.file_type().is_dir() {
            continue;
        }

        if let Ok(metadata) = entry.metadata() {
            let file_name = entry.file_name().to_string_lossy().to_string();
            let size_bytes = metadata.len();

            if let Some(rule) = find_matching_rule(&file_name, size_bytes, &cfg.rules) {
                let path_str = path.to_string_lossy().to_string();
                let target_folder_resolved = resolve_macros(&rule.target_folder, &metadata, &path_str);

                if let Err(e) = fs::create_dir_all(&target_folder_resolved) {
                    errors.push(format!("Failed to create directory {}: {}", target_folder_resolved, e));
                    total_errors += 1;
                    continue;
                }

                let dest_file_path = Path::new(&target_folder_resolved).join(&file_name);
                let target_path = get_unique_path(&dest_file_path.to_string_lossy());

                match fs::rename(&path_str, &target_path) {
                    Ok(_) => {
                        LAST_MOVE_HISTORY.lock().unwrap().push(MoveRecord {
                            original_path: path_str.clone(),
                            new_path: target_path.clone(),
                            size_bytes,
                        });
                        total_moved += 1;
                        total_bytes_moved += size_bytes;
                        progress_cb(SortProgressPayload {
                            total_moved,
                            total_errors,
                            is_done: false,
                            error_msg: String::new(),
                        });
                    }
                    Err(e) => {
                        errors.push(format!("Failed to move {}: {}", file_name, e));
                        total_errors += 1;
                    }
                }
            }
        }
    }

    if total_moved > 0 {
        stats::record(total_moved, total_bytes_moved);
    }

    let mut err_msg = errors.join("; ");
    if is_sort_cancelled() {
        err_msg = "Cancelled by user. Some files may not have been moved.".to_string();
    }

    progress_cb(SortProgressPayload {
        total_moved,
        total_errors,
        is_done: true,
        error_msg: err_msg,
    });
}

pub fn undo_last_sort() -> (usize, Result<(), String>) {
    let mut history = LAST_MOVE_HISTORY.lock().unwrap();
    let mut count = 0;
    let mut bytes_undone: u64 = 0;

    for record in history.iter() {
        if let Some(parent) = Path::new(&record.original_path).parent() {
            let _ = fs::create_dir_all(parent);
        }
        let safe_orig = get_unique_path(&record.original_path);
        if fs::rename(&record.new_path, &safe_orig).is_ok() {
            count += 1;
            bytes_undone += record.size_bytes;
        }
    }

    if count > 0 {
        stats::undo_record(count, bytes_undone);
    }

    history.clear();
    (count, Ok(()))
}

pub fn has_undo_history() -> bool {
    !LAST_MOVE_HISTORY.lock().unwrap().is_empty()
}

pub fn get_unique_path(dst: &str) -> String {
    if !Path::new(dst).exists() {
        return dst.to_string();
    }

    let path = Path::new(dst);
    let dir = path.parent().unwrap_or_else(|| Path::new(""));
    let ext = path.extension().map(|e| format!(".{}", e.to_string_lossy())).unwrap_or_default();
    let file_stem = path.file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_default();

    let mut counter = 1;
    loop {
        let new_name = format!("{} ({}){}", file_stem, counter, ext);
        let new_path = dir.join(new_name);
        if !new_path.exists() {
            return new_path.to_string_lossy().to_string();
        }
        counter += 1;
    }
}

pub fn resolve_macros(target: &str, metadata: &fs::Metadata, file_path: &str) -> String {
    let modified: DateTime<Local> = metadata.modified().ok().map(Into::into).unwrap_or_else(Local::now);

    let mut res = target.replace("{YEAR}", &modified.format("%Y").to_string());
    res = res.replace("{MONTH}", &modified.format("%m").to_string());
    res = res.replace("{MONTH_NAME}", &modified.format("%B").to_string());

    if res.contains("{ARTIST}") || res.contains("{ALBUM}") {
        let mut artist = "Unknown_Artist".to_string();
        let mut album = "Unknown_Album".to_string();

        if let Ok(tag) = id3::Tag::read_from_path(file_path) {
            if let Some(a) = tag.artist() {
                if !a.trim().is_empty() {
                    artist = clean_dir_name(a);
                }
            }
            if let Some(al) = tag.album() {
                if !al.trim().is_empty() {
                    album = clean_dir_name(al);
                }
            }
        }

        res = res.replace("{ARTIST}", &artist);
        res = res.replace("{ALBUM}", &album);
    }

    if res.contains("{CAMERA}") {
        let mut camera = "Unknown_Camera".to_string();
        if let Ok(file) = File::open(file_path) {
            let mut buf_reader = std::io::BufReader::new(file);
            if let Ok(exif_data) = exif::Reader::new().read_from_container(&mut buf_reader) {
                if let Some(field) = exif_data.get_field(exif::Tag::Model, exif::In::PRIMARY) {
                    let cam_str = field.display_value().to_string();
                    let trimmed = cam_str.trim_matches('"').trim();
                    if !trimmed.is_empty() {
                        camera = clean_dir_name(trimmed);
                    }
                }
            }
        }
        res = res.replace("{CAMERA}", &camera);
    }


    res
}

pub fn clean_dir_name(name: &str) -> String {
    let invalid_chars = ['<', '>', ':', '"', '/', '\\', '|', '?', '*'];
    let mut res = name.to_string();
    for ch in invalid_chars {
        res = res.replace(ch, "_");
    }
    res.trim().to_string()
}

pub fn find_matching_rule<'a>(filename: &str, size_bytes: u64, rules: &'a [Rule]) -> Option<&'a Rule> {
    let lower_name = filename.to_lowercase();
    let ext = Path::new(filename)
        .extension()
        .map(|e| format!(".{}", e.to_string_lossy().to_lowercase()))
        .unwrap_or_default();

    let size_mb = size_bytes as f64 / (1024.0 * 1024.0);

    for rule in rules {
        if let Some(min) = rule.min_size_mb {
            if min > 0.0 && size_mb < min {
                continue;
            }
        }
        if let Some(max) = rule.max_size_mb {
            if max > 0.0 && size_mb > max {
                continue;
            }
        }

        let mut matched = false;
        for rule_ext in &rule.extensions {
            if ext == rule_ext.to_lowercase() {
                matched = true;
                break;
            }
        }

        if !matched {
            for keyword in &rule.keywords {
                if !keyword.is_empty() && lower_name.contains(&keyword.to_lowercase()) {
                    matched = true;
                    break;
                }
            }
        }

        if matched {
            return Some(rule);
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_system_path() {
        assert!(is_system_path("C:\\Windows\\System32"));
        assert!(!is_system_path("C:\\Users\\StandardUser\\Downloads"));
    }

    #[test]
    fn test_clean_dir_name() {
        assert_eq!(clean_dir_name("Artist: Name / Test?"), "Artist_ Name _ Test_");
    }

    #[test]
    fn test_find_matching_rule() {
        let rule = Rule {
            category: "Images".to_string(),
            target_folder: "Pictures".to_string(),
            extensions: vec![".jpg".to_string(), ".png".to_string()],
            keywords: vec![],
            min_size_mb: None,
            max_size_mb: None,
        };

        let rules = vec![rule];
        assert!(find_matching_rule("photo.jpg", 1024, &rules).is_some());
        assert!(find_matching_rule("document.pdf", 1024, &rules).is_none());
    }
}
