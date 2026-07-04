package config

import (
	_ "embed"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
)

//go:embed config.json
var embeddedConfig []byte

// getConfigPath returns the path to AppData/Roaming/JazaSort/config.json
func getConfigPath() (string, error) {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	jazaDir := filepath.Join(configDir, "JazaSort")

	// Create directory if it doesn't exist
	if err := os.MkdirAll(jazaDir, 0755); err != nil {
		return "", err
	}

	return filepath.Join(jazaDir, "config.json"), nil
}

// Load reads and parses the configuration file (from AppData or embedded default)
func Load() (*Config, error) {
	configPath, err := getConfigPath()
	if err != nil {
		return loadEmbedded()
	}

	// Check if user config exists
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		// Doesn't exist, create it from embedded
		cfg, err := loadEmbedded()
		if err != nil {
			return nil, err
		}
		// Save it to AppData
		Save(cfg)
		return cfg, nil
	}

	// Exists, read from AppData
	fileBytes, err := os.ReadFile(configPath)
	if err != nil {
		return loadEmbedded() // fallback
	}

	var cfg Config
	if err := json.Unmarshal(fileBytes, &cfg); err != nil {
		return loadEmbedded() // fallback on invalid JSON
	}

	return &cfg, nil
}

// loadEmbedded loads the embedded default config and replaces {HOME}
func loadEmbedded() (*Config, error) {
	var cfg Config
	if err := json.Unmarshal(embeddedConfig, &cfg); err != nil {
		return nil, err
	}

	homeDir, err := os.UserHomeDir()
	if err != nil {
		homeDir = "C:/"
	}

	for i, folder := range cfg.SourceFolders {
		cfg.SourceFolders[i] = strings.ReplaceAll(folder, "{HOME}", homeDir)
	}

	for i, rule := range cfg.Rules {
		cfg.Rules[i].TargetFolder = strings.ReplaceAll(rule.TargetFolder, "{HOME}", homeDir)
	}

	return &cfg, nil
}

// Reset deletes the user configuration, falls back to embedded, and saves it
func Reset() (*Config, error) {
	cfg, err := loadEmbedded()
	if err != nil {
		return nil, err
	}
	err = Save(cfg)
	if err != nil {
		return nil, err
	}
	return cfg, nil
}

// Save saves the current configuration to AppData
func Save(cfg *Config) error {
	configPath, err := getConfigPath()
	if err != nil {
		return err
	}

	bytes, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(configPath, bytes, 0644)
}
