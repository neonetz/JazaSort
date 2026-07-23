use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::Read;
use std::path::Path;
use walkdir::WalkDir;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct DuplicateFile {
    pub path: String,
    pub filename: String,
    pub size_mb: f64,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct DuplicateGroup {
    pub hash: String,
    pub files: Vec<DuplicateFile>,
}

pub fn scan_duplicates(root_folder: &str) -> Result<Vec<DuplicateGroup>, String> {
    if root_folder.is_empty() || !Path::new(root_folder).exists() {
        return Ok(Vec::new());
    }

    // 1. Group by size first
    let mut size_map: HashMap<u64, Vec<String>> = HashMap::new();
    for entry in WalkDir::new(root_folder).into_iter().filter_map(|e| e.ok()) {
        if entry.file_type().is_file() {
            if let Ok(metadata) = entry.metadata() {
                let size = metadata.len();
                if size > 0 {
                    size_map.entry(size).or_default().push(entry.path().to_string_lossy().to_string());
                }
            }
        }
    }

    // 2. Group by fast hash (First 1MB + size byte)
    let mut fast_hash_map: HashMap<String, Vec<String>> = HashMap::new();
    for (_size, paths) in size_map {
        if paths.len() > 1 {
            for p in paths {
                if let Ok(f_hash) = compute_fast_hash(&p) {
                    fast_hash_map.entry(f_hash).or_default().push(p);
                }
            }
        }
    }

    // 3. Hash full files ONLY if fast hash matches
    let mut full_hash_map: HashMap<String, Vec<DuplicateFile>> = HashMap::new();
    for (_f_hash, paths) in fast_hash_map {
        if paths.len() > 1 {
            for p in paths {
                if let Ok(hash) = compute_full_hash(&p) {
                    if let Ok(metadata) = fs::metadata(&p) {
                        let size_mb = metadata.len() as f64 / (1024.0 * 1024.0);
                        let filename = Path::new(&p)
                            .file_name()
                            .map(|s| s.to_string_lossy().to_string())
                            .unwrap_or_default();

                        full_hash_map.entry(hash).or_default().push(DuplicateFile {
                            path: p,
                            filename,
                            size_mb,
                        });
                    }
                }
            }
        }
    }

    // 4. Format result
    let mut results = Vec::new();
    for (hash, files) in full_hash_map {
        if files.len() > 1 {
            results.push(DuplicateGroup { hash, files });
        }
    }

    Ok(results)
}

fn compute_fast_hash(file_path: &str) -> Result<String, String> {
    let mut file = File::open(file_path).map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();

    let mut buffer = vec![0u8; 1024 * 1024];
    let n = file.read(&mut buffer).map_err(|e| e.to_string())?;
    hasher.update(&buffer[..n]);

    if let Ok(metadata) = file.metadata() {
        hasher.update(&[metadata.len() as u8]);
    }

    Ok(hex::encode(hasher.finalize()))
}

fn compute_full_hash(file_path: &str) -> Result<String, String> {
    let mut file = File::open(file_path).map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 8192];

    loop {
        let count = file.read(&mut buffer).map_err(|e| e.to_string())?;
        if count == 0 {
            break;
        }
        hasher.update(&buffer[..count]);
    }

    Ok(hex::encode(hasher.finalize()))
}

pub fn delete_files(paths: Vec<String>) -> (usize, Result<(), String>) {
    let mut deleted = 0;
    for p in paths {
        if fs::remove_file(p).is_ok() {
            deleted += 1;
        }
    }
    (deleted, Ok(()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::tempdir;

    #[test]
    fn test_duplicate_scanner() {
        let dir = tempdir().unwrap();
        let file1_path = dir.path().join("test1.txt");
        let file2_path = dir.path().join("test2.txt");

        let content = b"Duplicate content test data 123456789";
        {
            let mut f1 = File::create(&file1_path).unwrap();
            f1.write_all(content).unwrap();
            f1.sync_all().unwrap();
        }
        {
            let mut f2 = File::create(&file2_path).unwrap();
            f2.write_all(content).unwrap();
            f2.sync_all().unwrap();
        }

        let dups = scan_duplicates(dir.path().to_str().unwrap()).unwrap();
        assert_eq!(dups.len(), 1);
        assert_eq!(dups[0].files.len(), 2);
    }
}

