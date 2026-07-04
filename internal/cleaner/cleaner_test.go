package cleaner

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSmartHashingDuplicates(t *testing.T) {
	tmpDir := t.TempDir()

	// File 1 and 2 are identical
	contentA := []byte("Hello World Duplicate Content!")
	file1 := filepath.Join(tmpDir, "file1.txt")
	file2 := filepath.Join(tmpDir, "file2.txt")

	// File 3 has same size but different content
	contentB := []byte("Hello World Different Content!")
	file3 := filepath.Join(tmpDir, "file3.txt")

	// File 4 has different size
	contentC := []byte("Smaller")
	file4 := filepath.Join(tmpDir, "file4.txt")

	require.NoError(t, os.WriteFile(file1, contentA, 0644))
	require.NoError(t, os.WriteFile(file2, contentA, 0644))
	require.NoError(t, os.WriteFile(file3, contentB, 0644))
	require.NoError(t, os.WriteFile(file4, contentC, 0644))

	// Scan duplicates
	groups, err := ScanDuplicates(tmpDir)
	require.NoError(t, err)

	// We expect exactly 1 group of duplicates (file1 and file2)
	assert.Len(t, groups, 1, "Should find exactly 1 group of duplicates")

	if len(groups) == 1 {
		assert.Len(t, groups[0].Files, 2, "Group should contain 2 files")

		names := []string{groups[0].Files[0].Filename, groups[0].Files[1].Filename}
		assert.Contains(t, names, "file1.txt")
		assert.Contains(t, names, "file2.txt")
		assert.NotContains(t, names, "file3.txt", "File 3 should not be marked as duplicate despite same size")
	}
}

func TestDeleteFiles(t *testing.T) {
	tmpDir := t.TempDir()

	file1 := filepath.Join(tmpDir, "delete1.txt")
	file2 := filepath.Join(tmpDir, "delete2.txt")

	os.WriteFile(file1, []byte("test"), 0644)
	os.WriteFile(file2, []byte("test"), 0644)

	deleted, err := DeleteFiles([]string{file1, file2})
	require.NoError(t, err)
	assert.Equal(t, 2, deleted, "Should delete 2 files")

	_, err1 := os.Stat(file1)
	assert.True(t, os.IsNotExist(err1), "File 1 should be gone")

	_, err2 := os.Stat(file2)
	assert.True(t, os.IsNotExist(err2), "File 2 should be gone")
}
