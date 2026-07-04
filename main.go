package main

import (
	"embed"

	"jazasort/internal/config"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	// Create an instance of the app structure
	app := NewApp()

	// Load configuration to determine Mica setting
	cfg, err := config.Load()
	micaEnabled := true // default to true if config fails
	if err == nil {
		micaEnabled = cfg.EnableMica
	}

	winOptions := &windows.Options{
		WebviewIsTransparent: false,
		WindowIsTranslucent:  false,
		BackdropType:         windows.None,
	}

	bgColour := &options.RGBA{R: 27, G: 38, B: 54, A: 1}

	if micaEnabled {
		bgColour = &options.RGBA{R: 0, G: 0, B: 0, A: 0}
		winOptions.WebviewIsTransparent = true
		winOptions.WindowIsTranslucent = true
		winOptions.BackdropType = windows.Mica
	}

	// Create application with options
	err = wails.Run(&options.App{
		Title:  "jazasort",
		Width:  1024,
		Height: 768,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: bgColour,
		Windows:          winOptions,
		OnStartup:        app.startup,
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
