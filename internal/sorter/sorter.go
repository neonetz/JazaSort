package sorter

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/dhowden/tag"
	"github.com/rwcarlsen/goexif/exif"

	"jazasort/internal/config"
	"jazasort/internal/stats"
)

var SystemPaths = []string{
	"C:\\",
	"C:\\Windows",
	"C:\\Program Files",
	"C:\\Program Files (x86)",
	"C:\\System32",
}

func IsSystemPath(path string) bool {
	cleaned := strings.ToLower(strings.TrimRight(path, "\\/"))
	for _, sys := range SystemPaths {
		sysCleaned := strings.ToLower(strings.TrimRight(sys, "\\/"))
		if strings.HasPrefix(cleaned, sysCleaned) {
			return true
		}
	}
	return false
}

var (
	sortCancelFlag bool
	cancelMutex    sync.Mutex
)

func CancelSort() {
	cancelMutex.Lock()
	sortCancelFlag = true
	cancelMutex.Unlock()
}

type TreeNode struct {
	ID       string
	Name     string
	IsDir    bool
	Children []string
}

type ScanResult struct {
	Nodes          map[string]*TreeNode
	RootID         string
	ExtensionStats map[string]int
	TotalSortable  int
}

// MoveRecord tracks moves for Undo feature
type MoveRecord struct {
	OriginalPath string
	NewPath      string
	SizeBytes    int64
}

var (
	lastMoveHistory []MoveRecord
	historyMutex    sync.Mutex
)

// ScanDirectory performs a dry run on a SINGLE selected folder
func ScanDirectory(rootFolder string, cfg *config.Config) (*ScanResult, error) {
	result := &ScanResult{
		Nodes:          make(map[string]*TreeNode),
		RootID:         rootFolder,
		ExtensionStats: make(map[string]int),
	}

	if _, err := os.Stat(rootFolder); os.IsNotExist(err) {
		return result, err
	}

	result.Nodes[rootFolder] = &TreeNode{
		ID:       rootFolder,
		Name:     filepath.Base(rootFolder),
		IsDir:    true,
		Children: []string{},
	}

	filepath.WalkDir(rootFolder, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil
		}

		if path == rootFolder {
			return nil
		}

		parentPath := filepath.Dir(path)

		// Check deep scan setting
		if !cfg.ScanSubfolders && parentPath != rootFolder {
			if d.IsDir() {
				return fs.SkipDir
			}
			return nil
		}

		nodeID := path

		if !d.IsDir() {
			info, err := d.Info()
			if err != nil {
				return nil
			}

			matchedRule := findMatchingRule(d.Name(), info.Size(), cfg.Rules)

			// Prune unsupported files to save RAM
			if matchedRule == nil && cfg.HideUnsupported {
				return nil
			}

			if matchedRule != nil {
				ext := strings.ToLower(filepath.Ext(d.Name()))
				if ext == "" {
					ext = "no_ext"
				}
				result.ExtensionStats[ext]++
				result.TotalSortable++
			}
		}

		result.Nodes[nodeID] = &TreeNode{
			ID:       nodeID,
			Name:     d.Name(),
			IsDir:    d.IsDir(),
			Children: []string{},
		}

		if parentNode, exists := result.Nodes[parentPath]; exists {
			parentNode.Children = append(parentNode.Children, nodeID)
		}

		return nil
	})

	// Post-processing: Remove empty directories if HideUnsupported is true
	if cfg.HideUnsupported {
		changed := true
		for changed {
			changed = false
			for id, node := range result.Nodes {
				if node.IsDir && id != rootFolder && len(node.Children) == 0 {
					// Remove from parent
					parentPath := filepath.Dir(id)
					if parent, ok := result.Nodes[parentPath]; ok {
						newChildren := []string{}
						for _, childID := range parent.Children {
							if childID != id {
								newChildren = append(newChildren, childID)
							}
						}
						parent.Children = newChildren
					}
					// Delete node
					delete(result.Nodes, id)
					changed = true
				}
			}
		}
	}

	return result, nil
}

type SortProgress struct {
	TotalMoved  int
	TotalErrors int
	IsDone      bool
	ErrorMsg    string
}

// SortFilesAsync runs sorting on a SINGLE selected folder
func SortFilesAsync(rootFolder string, cfg *config.Config, progressCh chan<- SortProgress) {
	totalMoved := 0
	totalErrors := 0
	var totalBytesMoved int64
	var errors []string

	// Reset cancel flag
	cancelMutex.Lock()
	sortCancelFlag = false
	cancelMutex.Unlock()

	// Clear history before new sort
	historyMutex.Lock()
	lastMoveHistory = make([]MoveRecord, 0)
	historyMutex.Unlock()

	filepath.WalkDir(rootFolder, func(path string, d fs.DirEntry, err error) error {
		cancelMutex.Lock()
		cancelled := sortCancelFlag
		cancelMutex.Unlock()

		if cancelled {
			return filepath.SkipDir // or return an error to break completely
		}

		if err != nil {
			return nil
		}

		if path == rootFolder {
			return nil
		}

		parentPath := filepath.Dir(path)
		if !cfg.ScanSubfolders && parentPath != rootFolder {
			if d.IsDir() {
				return fs.SkipDir
			}
			return nil
		}

		if d.IsDir() {
			return nil
		}

		info, err := d.Info()
		if err != nil {
			return nil
		}

		matchedRule := findMatchingRule(d.Name(), info.Size(), cfg.Rules)
		if matchedRule != nil {
			// Resolve macros
			targetFolder := resolveMacros(matchedRule.TargetFolder, info, path)

			if err := os.MkdirAll(targetFolder, 0755); err != nil {
				errors = append(errors, fmt.Sprintf("Failed to create %s", targetFolder))
				totalErrors++
				return nil
			}

			targetPath := getUniquePath(filepath.Join(targetFolder, d.Name()))

			if err := moveFile(path, targetPath); err != nil {
				errors = append(errors, fmt.Sprintf("Failed to move %s", d.Name()))
				totalErrors++
			} else {
				// Record history
				historyMutex.Lock()
				lastMoveHistory = append(lastMoveHistory, MoveRecord{
					OriginalPath: path,
					NewPath:      targetPath,
					SizeBytes:    info.Size(),
				})
				historyMutex.Unlock()

				totalMoved++
				totalBytesMoved += info.Size()
				progressCh <- SortProgress{TotalMoved: totalMoved, TotalErrors: totalErrors, IsDone: false}
			}
		}

		return nil
	})

	if totalMoved > 0 {
		stats.Record(totalMoved, totalBytesMoved)
	}

	errMsg := ""
	if len(errors) > 0 {
		errMsg = strings.Join(errors, "; ")
	}

	cancelMutex.Lock()
	wasCancelled := sortCancelFlag
	cancelMutex.Unlock()

	if wasCancelled {
		errMsg = "Cancelled by user. Some files may not have been moved."
	}

	progressCh <- SortProgress{TotalMoved: totalMoved, TotalErrors: totalErrors, IsDone: true, ErrorMsg: errMsg}
}

// UndoLastSort reverts the last sorting operation
func UndoLastSort() (int, error) {
	historyMutex.Lock()
	defer historyMutex.Unlock()

	count := 0
	var bytesUndone int64

	for _, record := range lastMoveHistory {
		os.MkdirAll(filepath.Dir(record.OriginalPath), 0755)

		safeOrig := getUniquePath(record.OriginalPath)
		if err := os.Rename(record.NewPath, safeOrig); err == nil {
			count++
			bytesUndone += record.SizeBytes
		}
	}

	if count > 0 {
		stats.UndoRecord(count, bytesUndone)
	}

	lastMoveHistory = make([]MoveRecord, 0)

	return count, nil
}

// HasUndoHistory returns true if there's an undo history available
func HasUndoHistory() bool {
	historyMutex.Lock()
	defer historyMutex.Unlock()
	return len(lastMoveHistory) > 0
}

func resolveMacros(target string, info fs.FileInfo, filePath string) string {
	modTime := info.ModTime()
	res := strings.ReplaceAll(target, "{YEAR}", modTime.Format("2006"))
	res = strings.ReplaceAll(res, "{MONTH}", modTime.Format("01"))
	res = strings.ReplaceAll(res, "{MONTH_NAME}", modTime.Format("January"))

	// Check if audio macros exist
	if strings.Contains(res, "{ARTIST}") || strings.Contains(res, "{ALBUM}") {
		artist := "Unknown_Artist"
		album := "Unknown_Album"

		if f, err := os.Open(filePath); err == nil {
			if m, err := tag.ReadFrom(f); err == nil {
				if m.Artist() != "" {
					artist = cleanDirName(m.Artist())
				}
				if m.Album() != "" {
					album = cleanDirName(m.Album())
				}
			}
			f.Close()
		}
		res = strings.ReplaceAll(res, "{ARTIST}", artist)
		res = strings.ReplaceAll(res, "{ALBUM}", album)
	}

	// Check if image macros exist
	if strings.Contains(res, "{CAMERA}") {
		camera := "Unknown_Camera"

		if f, err := os.Open(filePath); err == nil {
			if x, err := exif.Decode(f); err == nil {
				if camModel, err := x.Get(exif.Model); err == nil {
					camStr, _ := camModel.StringVal()
					camStr = strings.TrimSpace(camStr)
					if camStr != "" {
						camera = cleanDirName(camStr)
					}
				}
			}
			f.Close()
		}
		res = strings.ReplaceAll(res, "{CAMERA}", camera)
	}

	return res
}

func cleanDirName(name string) string {
	// Remove invalid characters for windows paths
	invalidChars := []string{"<", ">", ":", "\"", "/", "\\", "|", "?", "*"}
	res := name
	for _, char := range invalidChars {
		res = strings.ReplaceAll(res, char, "_")
	}
	return strings.TrimSpace(res)
}

func getUniquePath(dst string) string {
	if _, err := os.Stat(dst); os.IsNotExist(err) {
		return dst // Path is unique
	}

	dir := filepath.Dir(dst)
	ext := filepath.Ext(dst)
	base := strings.TrimSuffix(filepath.Base(dst), ext)

	counter := 1
	for {
		newPath := filepath.Join(dir, fmt.Sprintf("%s (%d)%s", base, counter, ext))
		if _, err := os.Stat(newPath); os.IsNotExist(err) {
			return newPath
		}
		counter++
	}
}

func findMatchingRule(filename string, sizeBytes int64, rules []config.Rule) *config.Rule {
	lowerName := strings.ToLower(filename)
	ext := strings.ToLower(filepath.Ext(filename))
	sizeMB := float64(sizeBytes) / (1024 * 1024)

	for _, rule := range rules {
		// Size check
		if rule.MinSizeMB > 0 && sizeMB < rule.MinSizeMB {
			continue
		}
		if rule.MaxSizeMB > 0 && sizeMB > rule.MaxSizeMB {
			continue
		}

		matched := false

		// Check extensions
		for _, ruleExt := range rule.Extensions {
			if ext == strings.ToLower(ruleExt) {
				matched = true
				break
			}
		}

		// Check keywords (if not matched by extension)
		if !matched {
			for _, keyword := range rule.Keywords {
				if strings.Contains(lowerName, strings.ToLower(keyword)) {
					matched = true
					break
				}
			}
		}

		if matched {
			return &rule
		}
	}
	return nil
}

func moveFile(src, dst string) error {
	return os.Rename(src, dst)
}
