package config

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLoadEmbedded(t *testing.T) {
	cfg, err := loadEmbedded()

	// Assert no error loading embedded config
	require.NoError(t, err)
	require.NotNil(t, cfg)

	// Assert macros are expanded
	for _, folder := range cfg.SourceFolders {
		assert.NotContains(t, folder, "{HOME}", "Macro {HOME} should be replaced in SourceFolders")
	}

	for _, rule := range cfg.Rules {
		assert.NotContains(t, rule.TargetFolder, "{HOME}", "Macro {HOME} should be replaced in Rules")
	}

	// Assert default values
	assert.False(t, cfg.ScanSubfolders, "Default scan_subfolders should be false as per requirement")
	assert.NotEmpty(t, cfg.Rules, "Rules should not be empty")
}
