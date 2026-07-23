#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod cleaner;
mod commands;
mod config;
mod sorter;
mod stats;

use commands::*;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            select_folder,
            select_target_folder,
            get_config,
            reset_config,
            save_config,
            export_config,
            import_config,
            scan_folder,
            sort_folder,
            cancel_sort,
            undo_last_sort,
            has_undo_history,
            is_system_path,
            get_lifetime_stats,
            scan_duplicates,
            delete_files,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
