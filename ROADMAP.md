# Roadmap

Phases are done in order. Each phase ends with a verified build, a launch and
tests before the next one starts.

## Phase 0 – Key decisions ✅

- Engine: Electron + TypeScript; Rust only where it pays off (e.g. `adblock-rs`)
- Platform: macOS arm64 only
- License: MPL-2.0
- Toolchain: Node 24 LTS via fnm, npm
- UI inspiration: Vivaldi (panels, configurability)

## Phase 1 – Project foundation ✅

- Repository, license, README, roadmap, `CLAUDE.md`
- Claude Code subagents (privacy-auditor, ui-tester, reviewer), hooks and
  permissions
- TypeScript, ESLint and Prettier
- MCP server: Playwright (Context7 left out: it is a remote service)

## Phase 2 – Minimal working browser

- One window with tabs, an address bar, back / forward / reload
- Local history in SQLite
- Hardened defaults: sandboxed tabs, context isolation, no preload in web
  content, permission requests denied by default, no spellcheck dictionary
  download, no default search engine
- Local crash reports: native crashes (Crashpad minidumps) and uncaught
  JavaScript errors are saved on this machine only, never uploaded. A menu
  entry shows them in Finder and can export one to a file the user picks.
  Old reports are deleted automatically (keep the last 20, at most 30 days).
- Builds, launches and passes Playwright end-to-end tests

## Phase 3 – Blocking and HTTPS

- Ad and tracker blocking with `adblock-rs` + EasyList / EasyPrivacy
  (filter lists only downloaded after explicit consent)
- Enforced HTTPS-only mode with a per-site exception prompt
- Optional, user-chosen search engine (none by default)

## Phase 4 – Isolation

- Per-site cookie isolation (separate Electron session partitions)
- Profiles / containers
- Anti-fingerprinting (user agent, canvas, WebGL, fonts, screen metrics)

## Phase 4b – Encrypted profile data

- Encrypt history, bookmarks and settings at rest with SQLCipher
- Encryption key stored in the macOS Keychain

## Phase 5 – Look and feel

- Vivaldi-style side panels (history, bookmarks, notes)
- Themes, configurable keyboard shortcuts
- Optional vertical tabs and a minimal layout

## Phase 6 – Network audit

- Full audit of the built app with REA (binary analysis) and TShark
  (traffic capture)
- Documented result: every outgoing connection is user-initiated

## Phase 7 – Packaging and updates

- Signed `.app` / `.dmg` for macOS arm64
- Updates are manual or self-hosted; no automatic update checks

## Phase 8 – Local AI

- Optional page summaries and Q&A using a model running on this machine
  (e.g. Ollama on `localhost`)
- Off by default; no content ever leaves the device
