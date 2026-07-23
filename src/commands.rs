use crate::cleaner::{self, DuplicateGroup};
use crate::config::{self, Config};
use crate::sorter::{self, SortProgressPayload};
use crate::stats::{self, LifetimeStats};
use std::fs;

use tauri::{AppHandle, Emitter};

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct ExtStat {
    pub ext: String,
    pub count: usize,
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct ScanResponse {
    pub root_id: String,
    pub total_sortable: usize,
    pub stats: Vec<ExtStat>,
    pub error: String,
}

#[tauri::command]
pub fn get_config() -> Config {
    config::load().unwrap_or_default()
}

#[tauri::command]
pub fn reset_config() -> Config {
    config::reset().unwrap_or_default()
}

#[tauri::command]
pub fn save_config(cfg: Config) -> Result<(), String> {
    config::save(&cfg)
}

#[tauri::command]
pub fn export_config(path: String, cfg: Config) -> Result<(), String> {
    if path.is_empty() {
        return Err("Path is empty".to_string());
    }
    let data = serde_json::to_string_pretty(&cfg).map_err(|e| e.to_string())?;
    fs::write(path, data).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn import_config(path: String) -> Result<Config, String> {
    if path.is_empty() {
        return Ok(get_config());
    }
    let data = fs::read(&path).map_err(|e| e.to_string())?;
    let new_cfg: Config = serde_json::from_slice(&data).map_err(|e| e.to_string())?;
    let _ = config::save(&new_cfg);
    Ok(new_cfg)
}

#[tauri::command]
pub fn scan_folder(path: String) -> ScanResponse {
    if path.is_empty() {
        return ScanResponse {
            root_id: String::new(),
            total_sortable: 0,
            stats: Vec::new(),
            error: "Path is empty".to_string(),
        };
    }

    let cfg = get_config();
    match sorter::scan_directory(&path, &cfg) {
        Ok(res) => {
            let mut exts: Vec<String> = res.extension_stats.keys().cloned().collect();
            exts.sort();

            let mut stats = Vec::new();
            for ext in exts {
                let mut ext_name = ext.trim_start_matches('.').to_uppercase();
                if ext_name.is_empty() || ext_name == "NO_EXT" {
                    ext_name = "UNKNOWN".to_string();
                }
                let count = *res.extension_stats.get(&ext).unwrap_or(&0);
                stats.push(ExtStat { ext: ext_name, count });
            }

            ScanResponse {
                root_id: res.root_id,
                total_sortable: res.total_sortable,
                stats,
                error: String::new(),
            }
        }
        Err(e) => ScanResponse {
            root_id: path,
            total_sortable: 0,
            stats: Vec::new(),
            error: e,
        },
    }
}

#[tauri::command]
pub fn sort_folder(app: AppHandle, path: String) {
    if path.is_empty() {
        return;
    }

    let cfg = get_config();
    std::thread::spawn(move || {
        sorter::sort_files_sync(&path, &cfg, |progress: SortProgressPayload| {
            let _ = app.emit("sort-progress", progress);
        });
    });
}

#[tauri::command]
pub fn cancel_sort() {
    sorter::cancel_sort();
}

#[tauri::command]
pub fn undo_last_sort() -> Result<usize, String> {
    let (count, res) = sorter::undo_last_sort();
    res.map(|_| count)
}

#[tauri::command]
pub fn has_undo_history() -> bool {
    sorter::has_undo_history()
}

#[tauri::command]
pub fn is_system_path(path: String) -> bool {
    sorter::is_system_path(&path)
}

#[tauri::command]
pub fn get_lifetime_stats() -> LifetimeStats {
    stats::get()
}

#[tauri::command]
pub fn scan_duplicates(path: String) -> Result<Vec<DuplicateGroup>, String> {
    cleaner::scan_duplicates(&path)
}

#[tauri::command]
pub fn delete_files(paths: Vec<String>) -> (usize, Result<(), String>) {
    cleaner::delete_files(paths)
}
