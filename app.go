package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"strings"

	"jazasort/internal/cleaner"
	"jazasort/internal/config"
	"jazasort/internal/sorter"
	"jazasort/internal/stats"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct is the core Wails application controller.
type App struct {
	ctx context.Context
	cfg *config.Config
}

// NewApp creates a new App application struct.
func NewApp() *App {
	return &App{}
}

// startup is called when the Wails app starts. It initializes the context and configuration.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	cfg, err := config.Load()
	if err != nil {
		fmt.Println("Error loading config:", err)
	}
	a.cfg = cfg
}

// SelectTargetFolder opens a dialog to select a target folder and returns the path
// SelectTargetFolder opens a dialog to select a target folder and returns the path
func (a *App) SelectTargetFolder() string {
	folder, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Pilih Folder Tujuan",
	})
	if err != nil {
		return ""
	}
	return folder
}

// GetConfig returns the current configuration
func (a *App) GetConfig() config.Config {
	if a.cfg == nil {
		return config.Config{}
	}
	return *a.cfg
}

// ResetConfig restores the configuration to factory defaults
func (a *App) ResetConfig() config.Config {
	cfg, err := config.Reset()
	if err != nil {
		fmt.Println("Error resetting config:", err)
		return a.GetConfig()
	}
	a.cfg = cfg
	return *a.cfg
}

// SaveConfig updates and saves the configuration
func (a *App) SaveConfig(cfg config.Config) error {
	a.cfg = &cfg
	return config.Save(&cfg)
}

// SelectFolder opens a dialog to select a folder and returns the path
func (a *App) SelectFolder() string {
	folder, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Pilih Folder untuk Disortir",
	})
	if err != nil {
		return ""
	}
	return folder
}

// Stats representation for frontend
type ExtStat struct {
	Ext   string `json:"ext"`
	Count int    `json:"count"`
}

type ScanResponse struct {
	RootID        string    `json:"rootId"`
	TotalSortable int       `json:"totalSortable"`
	Stats         []ExtStat `json:"stats"`
	Error         string    `json:"error"`
}

// ScanFolder scans the directory and returns stats
func (a *App) ScanFolder(path string) ScanResponse {
	if path == "" {
		return ScanResponse{Error: "Path is empty"}
	}

	scanRes, err := sorter.ScanDirectory(path, a.cfg)
	if err != nil {
		return ScanResponse{Error: err.Error()}
	}

	var stats []ExtStat
	var exts []string
	for k := range scanRes.ExtensionStats {
		exts = append(exts, k)
	}
	sort.Strings(exts)

	for _, ext := range exts {
		extName := strings.ToUpper(ext)
		if extName == "NO_EXT" {
			extName = "UNKNOWN"
		}
		stats = append(stats, ExtStat{
			Ext:   extName,
			Count: scanRes.ExtensionStats[ext],
		})
	}

	return ScanResponse{
		RootID:        scanRes.RootID,
		TotalSortable: scanRes.TotalSortable,
		Stats:         stats,
	}
}

// SortProgress struct for frontend
type SortProgressPayload struct {
	TotalMoved  int    `json:"totalMoved"`
	TotalErrors int    `json:"totalErrors"`
	IsDone      bool   `json:"isDone"`
	ErrorMsg    string `json:"errorMsg"`
}

// SortFolder initiates the sorting process and sends events to frontend
func (a *App) SortFolder(path string) {
	if path == "" {
		return
	}

	progressCh := make(chan sorter.SortProgress)
	go sorter.SortFilesAsync(path, a.cfg, progressCh)

	go func() {
		for p := range progressCh {
			runtime.EventsEmit(a.ctx, "sort-progress", SortProgressPayload{
				TotalMoved:  p.TotalMoved,
				TotalErrors: p.TotalErrors,
				IsDone:      p.IsDone,
				ErrorMsg:    p.ErrorMsg,
			})
		}
	}()
}

// UndoLastSort undoes the last sort operation
func (a *App) UndoLastSort() (int, error) {
	return sorter.UndoLastSort()
}

// HasUndoHistory returns whether there are items to undo
func (a *App) HasUndoHistory() bool {
	return sorter.HasUndoHistory()
}

// CancelSort stops an ongoing sort operation
func (a *App) CancelSort() {
	sorter.CancelSort()
}

// IsSystemPath checks if the given path is a protected Windows system path
func (a *App) IsSystemPath(path string) bool {
	return sorter.IsSystemPath(path)
}

// GetLifetimeStats returns historical statistics from the local storage.
func (a *App) GetLifetimeStats() stats.LifetimeStats {
	return stats.Get()
}

// ExportConfig exports the current JSON configuration to a user-selected file on their disk.
func (a *App) ExportConfig() error {
	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Export Settings",
		DefaultFilename: "JazaSort_Profile.json",
		Filters: []runtime.FileFilter{
			{DisplayName: "JSON Files", Pattern: "*.json"},
		},
	})
	if err != nil || path == "" {
		return err
	}

	bytes, err := json.MarshalIndent(a.cfg, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(path, bytes, 0644)
}

// ImportConfig imports a configuration from a user-selected file
func (a *App) ImportConfig() (config.Config, error) {
	path, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Import Settings",
		Filters: []runtime.FileFilter{
			{DisplayName: "JSON Files", Pattern: "*.json"},
		},
	})
	if err != nil || path == "" {
		return a.GetConfig(), err
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return a.GetConfig(), err
	}

	var newCfg config.Config
	if err := json.Unmarshal(data, &newCfg); err != nil {
		return a.GetConfig(), err
	}

	a.cfg = &newCfg
	config.Save(a.cfg)
	return *a.cfg, nil
}

// ScanDuplicates finds duplicate files in a directory
func (a *App) ScanDuplicates(path string) ([]cleaner.DuplicateGroup, error) {
	if path == "" {
		return nil, nil
	}
	return cleaner.ScanDuplicates(path)
}

// DeleteFiles deletes the specified files
func (a *App) DeleteFiles(paths []string) (int, error) {
	return cleaner.DeleteFiles(paths)
}
