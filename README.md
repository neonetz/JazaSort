# JazaSort

![JazaSort Logo](icons/icon.png)


[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version: Beta](https://img.shields.io/badge/Version-v1.0.0--beta.1-orange.svg)]()
[![Platform: Windows](https://img.shields.io/badge/Platform-Windows-blue.svg)]()

**JazaSort** is a blazingly fast, zero-configuration, native desktop file organizer for Windows. It acts as your personal digital butler, automatically sorting messy folders (Downloads, Desktop, etc.) into a clean, organized structure.

Built with **Rust** (Tauri v2) and **React** (Tailwind CSS), it runs as a native, blazingly fast Windows application—pure performance and memory safety.

---

## ⬇️ For Users: Quick Start (No Coding Required!)

**You do not need to install Go, Node.js, or compile anything.**

### 📥 1. Download
Go to the [**Releases Page**](https://github.com/neonetz/JazaSort/releases) and choose your preferred version:
- **`JazaSort-Installer.exe`** (Recommended) - Install JazaSort permanently on your PC with a Start Menu shortcut.
- **`JazaSort-Portable.exe`** (or `.zip`) - Run instantly without installing.

> 🛡️ **TRUST & SECURITY:** Our executables are 100% safely compiled and released directly via GitHub Actions CI/CD. No manual local builds are uploaded, ensuring completely sterile, tamper-proof, and virus-free binaries.

### ▶️ 2. Run
Double-click your downloaded file to launch or install JazaSort.

### 🧹 3. Sort Your Files
1. Click **"Choose Folder..."** and select a messy folder (e.g., `Downloads`).
2. JazaSort instantly scans and shows you a **visual breakdown** (Chart) of what it found.
3. Click **"Start Sorting"**.
4. Done! Your files are now neatly organized into `Documents`, `Pictures`, `Videos`, `Music`, etc.

### 🛡️ Safety Features
*   **Undo Button:** Made a mistake? One click restores every file to its original location.
*   **Duplicate Cleaner:** Dedicated "Cleaner" tab finds identical files (byte-for-byte) and lets you reclaim space safely.
*   **Smart Meta Sorting:** Organizes photos by Camera model and Music by Artist/Album automatically using file metadata.

---

## 🌟 Key Features at a Glance
- **Zero-Config:** Works instantly with smart defaults for Windows folders.
- **Glass UI (Mica Effect):** Fully supports Windows 11 translucent Mica and Acrylic backdrops for a stunning, native visual experience.
- **RAM Optimizer:** Features a "Hide Unsupported Files" toggle to aggressively prune cache and junk files from memory, keeping the app lightweight even when scanning millions of files.
- **Visual Analytics:** Beautiful charts showing exactly what file types you have.
- **Duplicate Cleaner:** SHA-256 deep scan finds duplicate files instantly (features 3-stage Smart Hashing for extreme performance).
- **Meta-Tag Sorting:** Organizes photos by Camera, Music by Artist/Album.
- **Undo System:** One-click rollback for any sorting operation.
- **Modern UI:** Dark mode, responsive, built with React + Tailwind CSS.

---

## 🛠️ For Developers
Interested in building from source, contributing, or extending JazaSort?  
👉 See **[CONTRIBUTING.md](CONTRIBUTING.md)** for build instructions, architecture overview, and contribution guidelines.

---

## 📝 License
This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.