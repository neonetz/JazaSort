# Agent Instructions for JazaSort

This file contains high-signal context for AI agents working on JazaSort. Read this before making changes to avoid common pitfalls.

## Architecture & Frameworks
* **App Type:** Native Windows desktop application.
* **Backend:** Go 1.23+ with Wails v2.
* **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Chart.js.
* **Entrypoints:**
  * Go Entrypoint: `main.go` (Wails initialization, embed) and `app.go` (JS bindings).
  * JS Entrypoint: `frontend/src/main.tsx` and `frontend/src/App.tsx`.

## Quirks & Gotchas
* **`go:embed` Dependency:** `main.go` requires the compiled frontend assets (`//go:embed all:frontend/dist`). **You MUST build the frontend before running Go backend tests**, or you will get a `pattern all:frontend/dist: no matching files found` error.
* **Mica/Translucency:** Windows-specific Mica backdrop and transparency settings are initialized in `main.go`. 
* **Environment:** GitHub Actions requires Node.js 22 (for `node:util` `styleText` support in Vitest/Rolldown) and Go 1.23. Ensure you do not downgrade these in workflows.

## Common Commands

### Development
* Run full dev environment (Go rebuilds + Vite HMR):
  ```bash
  wails dev
  ```

### Testing (Strict Order Required)
To run backend tests locally without `go:embed` failing, use this exact order:
```bash
# 1. Build frontend first
cd frontend
npm ci
npm run build
# 2. Run frontend tests
npm run test -- --run
# 3. Run backend tests
cd ..
go test -v -race ./...
```

### Building for Production
* Requires Wails CLI (`go install github.com/wailsapp/wails/v2/cmd/wails@latest`)
* Clean build: `wails build -clean`
* Outputs to: `build/bin/JazaSort.exe`

## Contribution Rules
* **Testing is Mandatory:** Any PR or feature addition requires proof of testing (unit test output or manual testing logs).
* **Code Style:** Run `go fmt ./...` for Go files, and `npm run lint` inside `frontend/` for TS/React files.
