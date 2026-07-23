# Agent Instructions for JazaSort

This file contains high-signal context for AI agents working on JazaSort. Read this before making changes to avoid common pitfalls.

## Architecture & Frameworks
* **App Type:** Native Windows desktop application.
* **Backend:** Rust 2021 with Tauri v2.
* **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Chart.js.
* **Entrypoints:**
  * Rust Entrypoint: `src/main.rs` (Tauri initialization, window transparency) and `src/commands.rs` (IPC bindings).
  * JS Entrypoint: `frontend/src/main.tsx` and `frontend/src/App.tsx`.

## Quirks & Gotchas
* **Mica/Translucency:** Windows-specific Mica backdrop and transparency settings are configured in `src/main.rs` and `tauri.conf.json`.
* **Environment:** GitHub Actions requires Node.js 22 and Rust 2021 (`dtolnay/rust-toolchain@stable`).

## Common Commands

### Development
* Run frontend dev server:
  ```bash
  cd frontend
  npm run dev
  ```

### Testing
```bash
# 1. Run frontend tests
cd frontend
npm ci
npm run test:run

# 2. Run Rust backend tests
cd ..
cargo test
```

### Building for Production
* `cargo build --release` or `cargo tauri build`

## Contribution Rules
* **Testing is Mandatory:** Any PR or feature addition requires proof of testing (unit test output or manual testing logs).
* **Code Style:** Run `cargo fmt` for Rust files, and `npm run test:run` inside `frontend/` for TS/React files.
