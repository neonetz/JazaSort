# Contributing to JazaSort

Thank you for your interest in contributing to JazaSort! This document outlines the process for building from source, the architecture overview, and our development workflow.

---

## 🏗️ Building from Source

### Prerequisites
- **Go 1.20+** - [Download](https://go.dev/dl/)
- **Node.js 18+** - [Download](https://nodejs.org/)
- **Wails CLI v2** - [Installation Guide](https://wails.io/docs/gettingstarted/installation)
  ```bash
  go install github.com/wailsapp/wails/v2/cmd/wails@latest
  ```
- **Git** - For version control

### Build Steps
```bash
# 1. Clone the repository
git clone https://github.com/yourusername/JazaSort.git
cd JazaSort

# 2. Install frontend dependencies
cd frontend
npm install
cd ..

# 3. Build the executable (Windows)
wails build -clean
# Output: build/bin/JazaSort.exe

# 4. (Optional) Run in development mode with hot reload
wails dev
```

### Development Mode (Hot Reload)
```bash
wails dev
```
This launches the app with Vite's HMR (Hot Module Replacement) for the React frontend and automatic Go rebuilds.

---

## 🏛️ Architecture Overview

### Technology Stack
- **Backend:** Go 1.20+ (Standard Library + Wails v2)
- **Frontend:** React 18 + TypeScript + Vite
- **Styling:** Tailwind CSS
- **Charts:** Chart.js (react-chartjs-2)
- **Desktop Runtime:** Wails v2 (WebView2 on Windows)

### Project Structure
```
JazaSort/
├── app.go                 # Wails entry point, Go <-> JS bindings
├── main.go                # Application entry point
├── wails.json             # Wails project configuration
├── go.mod / go.sum        # Go dependencies
├── LICENSE                # MIT License
├── README.md              # User documentation
├── CONTRIBUTING.md        # This file
├── internal/
│   ├── config/            # Configuration models & parser (go:embed)
│   ├── sorter/            # Core file sorting logic & undo system
│   ├── cleaner/           # Duplicate finder (SHA-256 + Smart Hashing)
│   └── stats/             # Lifetime analytics persistence
├── frontend/
│   ├── src/
│   │   ├── App.tsx        # Main React component (Tabs: Sorter, Cleaner, Analytics)
│   │   ├── main.tsx       # React entry point
│   │   └── style.css      # Tailwind imports + custom styles
│   ├── package.json       # NPM dependencies
│   ├── tailwind.config.cjs
│   └── vite.config.ts
└── build/                 # Wails build assets (icons, Windows manifest)
```

### Key Modules
| Module | Responsibility |
|--------|----------------|
| `internal/config` | Embedded default config, user config persistence (AppData), `{HOME}` macro expansion |
| `internal/sorter` | File traversal, rule matching (ext/keywords/size), move with undo history, macro resolution (`{YEAR}`, `{ARTIST}`, etc.) |
| `internal/cleaner` | Duplicate detection: Size grouping → Fast Hash (1MB) → Full SHA-256 |
| `internal/stats` | Lifetime analytics (JSON persistence in AppData) |
| `frontend/src/App.tsx` | Single-page React app with 3 tabs (Sorter, Cleaner, Analytics) |

---

## 🔄 Release & Development Cycle

We follow a **predictable, disciplined release cadence**:

| Cycle | Frequency | Scope |
|-------|-----------|-------|
| **Major Releases** | **Every 6 Months** (Bi-annual) | New features, UI overhauls, breaking changes, new modules |
| **Patch Releases** | As Needed (Continuous) | Bug fixes, performance improvements, minor enhancements |

### Versioning
We follow **Semantic Versioning (SemVer)**:
- `MAJOR.MINOR.PATCH` (e.g., `v1.2.0`)
- **Beta/Pre-release:** `v1.0.0-beta.1`, `v1.0.0-rc.1`

---

## 🤝 Contribution Guidelines

### 1. Reporting Issues
- Use the **GitHub Issues** tab.
- **Bug Reports:** Include OS version, JazaSort version, steps to reproduce, and logs if possible.
- **Feature Requests:** Describe the use case and expected behavior.

### 2. Pull Request Process
1. **Fork** the repository.
2. Create a **feature branch**: `git checkout -b feature/your-feature-name`
3. **Write clean, documented code** (GoDoc for Go, JSDoc for TypeScript/React).
4. **Test thoroughly** — this is mandatory.
5. **Commit with clear messages**: `feat: add camera macro for photo sorting`
4. Push and open a **Pull Request** against `main`.

### ⚠️ Mandatory Testing Proof
**Every PR must include proof of testing.** PRs without verification will be **rejected**.
Acceptable proof:
- Screenshots/GIFs of manual testing (before/after)
- Unit test output (`go test ./...` or `npm test`)
- Log output showing successful execution

### Code Style
- **Go:** `gofmt` / `goimports` (run `go fmt ./...` before commit)
- **TypeScript/React:** ESLint + Prettier (`npm run lint` in `frontend/`)
- **Comments:** GoDoc for exported Go functions; JSDoc for React components/hooks

---

## 🧪 Testing Strategy

### Backend (Go)
```bash
# Run all tests
go test ./...

# Run with coverage
go test -cover ./...
```

### Frontend (React/TypeScript)
```bash
cd frontend
npm run lint       # ESLint + Prettier check
npm run test       # Vitest/Jest (if configured)
```

### Manual Testing Checklist (Pre-Release)
- [ ] App launches without console errors
- [ ] Folder selection works (native dialog)
- [ ] Scanning shows correct file counts & chart
- [ ] Sorting moves files correctly (verify target folders)
- [ ] Undo restores files to original paths
- [ ] Duplicate Cleaner finds known duplicates
- [ ] Meta-tag sorting works for MP3 (Artist/Album) and JPG (Camera)
- [ ] Settings persist after restart (AppData)
- [ ] Reset to Defaults works
- [ ] Theme/UI renders correctly on Windows 10/11

---

## 📦 Release Process (For Maintainers)

1. Update version in `wails.json` (`productVersion`) and `frontend/src/App.tsx` (UI badge).
2. Update `CHANGELOG.md` (if exists) with categorized changes.
3. Create Git tag: `git tag v1.2.0`
4. Push tag: `git push origin v1.2.0`
5. GitHub Actions (if configured) or manual `wails build` for Windows.
6. Upload `JazaSort.exe` to **GitHub Releases** with changelog.
7. Announce on relevant channels.

---

## 📝 License
By contributing, you agree that your contributions will be licensed under the **MIT License** (see [LICENSE](LICENSE)).

---

## 📞 Contact
- **Author:** NeoNetz
- **Email:** aksafadillah@gmail.com
- **Issues:** [GitHub Issues](https://github.com/yourusername/JazaSort/issues)

---

*Thank you for contributing to JazaSort! Let's build the best file organizer together.*