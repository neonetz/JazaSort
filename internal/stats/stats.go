package stats

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type DailyStat struct {
	Date       string  `json:"date"`
	FilesMoved int     `json:"files_moved"`
	MBMoved    float64 `json:"mb_moved"`
}

type LifetimeStats struct {
	TotalFiles int                  `json:"total_files"`
	TotalMB    float64              `json:"total_mb"`
	History    map[string]DailyStat `json:"history"`
}

var (
	currentStats *LifetimeStats
	statsMutex   sync.Mutex
)

func getStatsPath() (string, error) {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	jazaDir := filepath.Join(configDir, "JazaSort")
	os.MkdirAll(jazaDir, 0755)
	return filepath.Join(jazaDir, "stats.json"), nil
}

func initStats() {
	if currentStats != nil {
		return
	}
	currentStats = &LifetimeStats{
		History: make(map[string]DailyStat),
	}
	path, err := getStatsPath()
	if err == nil {
		if data, err := os.ReadFile(path); err == nil {
			json.Unmarshal(data, currentStats)
		}
	}
	if currentStats.History == nil {
		currentStats.History = make(map[string]DailyStat)
	}
}

func saveStats() {
	path, err := getStatsPath()
	if err == nil {
		if data, err := json.MarshalIndent(currentStats, "", "  "); err == nil {
			os.WriteFile(path, data, 0644)
		}
	}
}

// Record adds sorting events to the lifetime stats
func Record(files int, bytes int64) {
	statsMutex.Lock()
	defer statsMutex.Unlock()
	initStats()

	mb := float64(bytes) / (1024 * 1024)
	today := time.Now().Format("2006-01-02")

	currentStats.TotalFiles += files
	currentStats.TotalMB += mb

	daily := currentStats.History[today]
	daily.Date = today
	daily.FilesMoved += files
	daily.MBMoved += mb
	currentStats.History[today] = daily

	saveStats()
}

// UndoRecord subtracts sorting events (used when user undoes a sort)
func UndoRecord(files int, bytes int64) {
	statsMutex.Lock()
	defer statsMutex.Unlock()
	initStats()

	mb := float64(bytes) / (1024 * 1024)
	today := time.Now().Format("2006-01-02")

	currentStats.TotalFiles -= files
	if currentStats.TotalFiles < 0 {
		currentStats.TotalFiles = 0
	}
	currentStats.TotalMB -= mb
	if currentStats.TotalMB < 0 {
		currentStats.TotalMB = 0
	}

	daily := currentStats.History[today]
	daily.Date = today
	daily.FilesMoved -= files
	if daily.FilesMoved < 0 {
		daily.FilesMoved = 0
	}
	daily.MBMoved -= mb
	if daily.MBMoved < 0 {
		daily.MBMoved = 0
	}
	currentStats.History[today] = daily

	saveStats()
}

// Get returns the current lifetime stats
func Get() LifetimeStats {
	statsMutex.Lock()
	defer statsMutex.Unlock()
	initStats()
	return *currentStats
}
