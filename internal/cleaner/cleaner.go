package cleaner

import (
	"crypto/sha256"
	"encoding/hex"
	"io"
	"io/fs"
	"os"
	"path/filepath"
)

type DuplicateFile struct {
	Path     string  `json:"path"`
	Filename string  `json:"filename"`
	SizeMB   float64 `json:"size_mb"`
}

type DuplicateGroup struct {
	Hash  string          `json:"hash"`
	Files []DuplicateFile `json:"files"`
}

func ScanDuplicates(rootFolder string) ([]DuplicateGroup, error) {
	// 1. Group by size first (fast pass)
	sizeMap := make(map[int64][]string)

	filepath.WalkDir(rootFolder, func(path string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return nil
		}
		info, err := d.Info()
		if err != nil {
			return nil
		}
		size := info.Size()
		if size > 0 { // Ignore empty files
			sizeMap[size] = append(sizeMap[size], path)
		}
		return nil
	})

	// 2. Group by fast hash (First 1MB) for files with identical sizes
	fastHashMap := make(map[string][]string)
	for _, paths := range sizeMap {
		if len(paths) > 1 {
			for _, p := range paths {
				fHash, err := computeFastHash(p)
				if err == nil {
					fastHashMap[fHash] = append(fastHashMap[fHash], p)
				}
			}
		}
	}

	// 3. Hash full files ONLY if fast hash matches
	fullHashMap := make(map[string][]DuplicateFile)
	for _, paths := range fastHashMap {
		if len(paths) > 1 {
			for _, p := range paths {
				hash, err := computeFullHash(p)
				if err == nil {
					info, _ := os.Stat(p)
					mb := float64(info.Size()) / (1024 * 1024)
					fullHashMap[hash] = append(fullHashMap[hash], DuplicateFile{
						Path:     p,
						Filename: filepath.Base(p),
						SizeMB:   mb,
					})
				}
			}
		}
	}

	// 4. Format result
	var results []DuplicateGroup
	for hash, files := range fullHashMap {
		if len(files) > 1 {
			results = append(results, DuplicateGroup{
				Hash:  hash,
				Files: files,
			})
		}
	}

	return results, nil
}

// computeFastHash reads only the first 1MB of a file
func computeFastHash(filePath string) (string, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return "", err
	}
	defer file.Close()

	hash := sha256.New()
	// Read up to 1MB
	if _, err := io.CopyN(hash, file, 1024*1024); err != nil && err != io.EOF {
		return "", err
	}

	// Incorporate file size into fast hash to avoid cross-size collision accidentally
	info, err := file.Stat()
	if err == nil {
		// Just mix size
		hash.Write([]byte{byte(info.Size())})
	}

	return hex.EncodeToString(hash.Sum(nil)), nil
}

func computeFullHash(filePath string) (string, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return "", err
	}
	defer file.Close()

	hash := sha256.New()
	if _, err := io.Copy(hash, file); err != nil {
		return "", err
	}

	return hex.EncodeToString(hash.Sum(nil)), nil
}

func DeleteFiles(paths []string) (int, error) {
	deleted := 0
	for _, p := range paths {
		if err := os.Remove(p); err == nil {
			deleted++
		}
	}
	return deleted, nil
}
