package sorter

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"jazasort/internal/config"

	"github.com/stretchr/testify/assert"
)

func TestFindMatchingRule(t *testing.T) {
	rules := []config.Rule{
		{
			Category:   "Large Videos",
			Extensions: []string{".mp4"},
			MinSizeMB:  100,
		},
		{
			Category:   "Documents",
			Extensions: []string{".pdf", ".docx"},
		},
		{
			Category: "Secret Files",
			Keywords: []string{"secret", "confidential"},
		},
	}

	tests := []struct {
		name     string
		filename string
		sizeMB   float64
		expected string // Expected matched category
	}{
		{"Match Extension PDF", "report.pdf", 5.0, "Documents"},
		{"Match Keyword Secret", "my_secret_plan.txt", 1.0, "Secret Files"},
		{"Match Large Video", "movie.mp4", 150.0, "Large Videos"},
		{"Skip Small Video", "clip.mp4", 50.0, ""}, // Less than 100MB
		{"No Match", "song.mp3", 10.0, ""},
		{"Case Insensitive Keyword", "CONFIDENTIAL_DOC.xls", 2.0, "Secret Files"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			sizeBytes := int64(tt.sizeMB * 1024 * 1024)
			matched := findMatchingRule(tt.filename, sizeBytes, rules)
			if tt.expected == "" {
				assert.Nil(t, matched)
			} else {
				assert.NotNil(t, matched)
				assert.Equal(t, tt.expected, matched.Category)
			}
		})
	}
}

func TestGetUniquePath(t *testing.T) {
	tmpDir := t.TempDir()

	// Target path
	targetFile := filepath.Join(tmpDir, "test.txt")

	// Create dummy file to simulate existing
	os.WriteFile(targetFile, []byte("dummy"), 0644)

	// Test unique path generation
	uniquePath := getUniquePath(targetFile)
	expectedPath := filepath.Join(tmpDir, "test (1).txt")

	assert.Equal(t, expectedPath, uniquePath, "Should append (1) to existing file")

	// Create the (1) file
	os.WriteFile(expectedPath, []byte("dummy"), 0644)
	uniquePath2 := getUniquePath(targetFile)
	expectedPath2 := filepath.Join(tmpDir, "test (2).txt")

	assert.Equal(t, expectedPath2, uniquePath2, "Should append (2) if (1) exists")
}

// MockFileInfo implements fs.FileInfo for testing resolveMacros
type MockFileInfo struct {
	name    string
	size    int64
	modTime time.Time
}

func (m MockFileInfo) Name() string       { return m.name }
func (m MockFileInfo) Size() int64        { return m.size }
func (m MockFileInfo) Mode() os.FileMode  { return 0 }
func (m MockFileInfo) ModTime() time.Time { return m.modTime }
func (m MockFileInfo) IsDir() bool        { return false }
func (m MockFileInfo) Sys() any           { return nil }

func TestResolveMacrosBasic(t *testing.T) {
	mockTime := time.Date(2023, 5, 15, 0, 0, 0, 0, time.UTC)
	mockInfo := MockFileInfo{modTime: mockTime}

	target := "C:/Sorted/{YEAR}/{MONTH_NAME}/{MONTH}"
	resolved := resolveMacros(target, mockInfo, "dummy.txt")

	expected := "C:/Sorted/2023/May/05"
	assert.Equal(t, expected, resolved, "Date macros should resolve correctly")
}
