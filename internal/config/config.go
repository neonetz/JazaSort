package config

type Config struct {
	SourceFolders   []string `json:"source_folders"`
	ScanSubfolders  bool     `json:"scan_subfolders"`
	EnableMica      bool     `json:"enable_mica"`
	HideUnsupported bool     `json:"hide_unsupported"`
	Rules           []Rule   `json:"rules"`
}

type Rule struct {
	Category     string   `json:"category"`
	TargetFolder string   `json:"target_folder"`
	Extensions   []string `json:"extensions"`
	Keywords     []string `json:"keywords"`
	MinSizeMB    float64  `json:"min_size_mb,omitempty"` // New feature
	MaxSizeMB    float64  `json:"max_size_mb,omitempty"` // New feature
}
