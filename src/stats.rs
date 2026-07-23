use chrono::Local;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Serialize, Deserialize, Debug, Clone, Default, PartialEq)]
pub struct DailyStat {
    pub date: String,
    pub files_moved: usize,
    pub mb_moved: f64,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default, PartialEq)]
pub struct LifetimeStats {
    pub total_files: usize,
    pub total_mb: f64,
    pub history: HashMap<String, DailyStat>,
}

lazy_static::lazy_static! {
    static ref STATS_STORE: Mutex<Option<LifetimeStats>> = Mutex::new(None);
}

fn get_stats_path() -> Result<PathBuf, String> {
    let config_dir = dirs::config_dir().ok_or_else(|| "Could not locate config directory".to_string())?;
    let jaza_dir = config_dir.join("JazaSort");
    if !jaza_dir.exists() {
        let _ = fs::create_dir_all(&jaza_dir);
    }
    Ok(jaza_dir.join("stats.json"))
}

fn load_stats_from_disk() -> LifetimeStats {
    if let Ok(path) = get_stats_path() {
        if let Ok(data) = fs::read(&path) {
            if let Ok(stats) = serde_json::from_slice::<LifetimeStats>(&data) {
                return stats;
            }
        }
    }
    LifetimeStats::default()
}

fn save_stats_to_disk(stats: &LifetimeStats) {
    if let Ok(path) = get_stats_path() {
        if let Ok(data) = serde_json::to_string_pretty(stats) {
            let _ = fs::write(path, data);
        }
    }
}

pub fn get() -> LifetimeStats {
    let mut lock = STATS_STORE.lock().unwrap();
    if lock.is_none() {
        *lock = Some(load_stats_from_disk());
    }
    lock.clone().unwrap_or_default()
}

pub fn record(files: usize, bytes: u64) {
    let mut lock = STATS_STORE.lock().unwrap();
    if lock.is_none() {
        *lock = Some(load_stats_from_disk());
    }
    let stats = lock.as_mut().unwrap();

    let mb = bytes as f64 / (1024.0 * 1024.0);
    let today = Local::now().format("%Y-%m-%d").to_string();

    stats.total_files += files;
    stats.total_mb += mb;

    let daily = stats.history.entry(today.clone()).or_insert_with(|| DailyStat {
        date: today,
        files_moved: 0,
        mb_moved: 0.0,
    });

    daily.files_moved += files;
    daily.mb_moved += mb;

    save_stats_to_disk(stats);
}

pub fn undo_record(files: usize, bytes: u64) {
    let mut lock = STATS_STORE.lock().unwrap();
    if lock.is_none() {
        *lock = Some(load_stats_from_disk());
    }
    let stats = lock.as_mut().unwrap();

    let mb = bytes as f64 / (1024.0 * 1024.0);
    let today = Local::now().format("%Y-%m-%d").to_string();

    if stats.total_files >= files {
        stats.total_files -= files;
    } else {
        stats.total_files = 0;
    }

    if stats.total_mb >= mb {
        stats.total_mb -= mb;
    } else {
        stats.total_mb = 0.0;
    }

    if let Some(daily) = stats.history.get_mut(&today) {
        if daily.files_moved >= files {
            daily.files_moved -= files;
        } else {
            daily.files_moved = 0;
        }

        if daily.mb_moved >= mb {
            daily.mb_moved -= mb;
        } else {
            daily.mb_moved = 0.0;
        }
    }

    save_stats_to_disk(stats);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_record_and_undo() {
        let initial = get();
        record(2, 2048 * 1024);
        let updated = get();
        assert_eq!(updated.total_files, initial.total_files + 2);

        undo_record(2, 2048 * 1024);
        let undone = get();
        assert_eq!(undone.total_files, initial.total_files);
    }
}
