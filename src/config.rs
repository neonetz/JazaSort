use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct Rule {
    pub category: String,
    pub target_folder: String,
    pub extensions: Vec<String>,
    pub keywords: Vec<String>,
    #[serde(default)]
    pub min_size_mb: Option<f64>,
    #[serde(default)]
    pub max_size_mb: Option<f64>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Default)]
pub struct Config {
    pub source_folders: Vec<String>,
    pub scan_subfolders: bool,
    pub enable_mica: bool,
    pub hide_unsupported: bool,
    pub rules: Vec<Rule>,
}

const EMBEDDED_CONFIG: &[u8] = include_bytes!("config.json");

pub fn get_config_path() -> Result<PathBuf, String> {
    let config_dir = dirs::config_dir().ok_or_else(|| "Could not locate config directory".to_string())?;
    let jaza_dir = config_dir.join("JazaSort");
    if !jaza_dir.exists() {
        let _ = fs::create_dir_all(&jaza_dir);
    }
    Ok(jaza_dir.join("config.json"))
}

pub fn load_embedded() -> Result<Config, String> {
    let mut cfg: Config = serde_json::from_slice(EMBEDDED_CONFIG)
        .map_err(|e| format!("Failed to parse embedded config: {}", e))?;

    let home_dir = dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| "C:/".to_string());

    for folder in &mut cfg.source_folders {
        *folder = folder.replace("{HOME}", &home_dir);
    }

    for rule in &mut cfg.rules {
        rule.target_folder = rule.target_folder.replace("{HOME}", &home_dir);
    }

    Ok(cfg)
}

pub fn load() -> Result<Config, String> {
    let config_path = match get_config_path() {
        Ok(p) => p,
        Err(_) => return load_embedded(),
    };

    if !config_path.exists() {
        let cfg = load_embedded()?;
        let _ = save(&cfg);
        return Ok(cfg);
    }

    let file_bytes = match fs::read(&config_path) {
        Ok(b) => b,
        Err(_) => return load_embedded(),
    };

    match serde_json::from_slice::<Config>(&file_bytes) {
        Ok(cfg) => Ok(cfg),
        Err(_) => load_embedded(),
    }
}

pub fn save(cfg: &Config) -> Result<(), String> {
    let config_path = get_config_path()?;
    let bytes = serde_json::to_string_pretty(cfg)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    fs::write(config_path, bytes).map_err(|e| format!("Failed to write config file: {}", e))
}

pub fn reset() -> Result<Config, String> {
    let cfg = load_embedded()?;
    save(&cfg)?;
    Ok(cfg)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_load_embedded_config() {
        let cfg = load_embedded().expect("Should parse embedded config");
        assert!(!cfg.rules.is_empty());
        assert_eq!(cfg.rules[0].category, "Documents");
    }

    #[test]
    fn test_home_substitution() {
        let cfg = load_embedded().unwrap();
        assert!(!cfg.rules[0].target_folder.contains("{HOME}"));
        assert!(!cfg.source_folders[0].contains("{HOME}"));
    }
}
