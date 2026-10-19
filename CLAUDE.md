# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

ascend is a private, local-first desktop browser for **macOS arm64 only**,
built on Electron + TypeScript. See `README.md` for goals and `ROADMAP.md` for
phases. Work one phase at a time; finish each with a build, a launch and tests.

## Communication

- Talk to the user in **German**.
- Code, comments, commit messages and documentation are in **English**.
- The user is learning. Explain _why_ in comments and in chat, not just _what_.
  Prefer simple, readable code over clever code.

## Privacy rules (hard requirements – never break these)

1. **Zero telemetry.** The browser, build scripts and dependencies must not
   send usage data.
2. **No external request without explicit user consent.** This includes update
   checks, crash reports, and fonts or icons from CDNs. Bundle every asset
   locally.
3. **All data stays local.** History, bookmarks and settings are stored only on
   this machine. No cloud sync.
4. **HTTPS-only by default.**
5. **Ad and tracker blocking** uses Brave's `adblock-rust` (`adblock-rs`) with
   EasyList / EasyPrivacy (Phase 3).

If a change could cause a network request the user did not trigger, stop and
ask first.

## Architecture (target for Phase 2)

```
BaseWindow
├── UI view (WebContentsView)   – browser chrome: tabs, address bar, buttons
│     └── preload/ui.ts          – narrow contextBridge API, typed IPC only
└── Tab views (WebContentsView)  – one per tab, web content, NO preload
main process
├── TabManager                   – creates, switches, closes tab views
├── history                      – SQLite in app.getPath('userData')
└── ipc                          – validated handlers for UI requests
```

- **Main process** (`src/main/`): owns windows, tabs, storage and all
  privileged work.
- **Preload** (`src/preload/`): only for the UI view. Exposes a minimal,
  typed API via `contextBridge`. Never expose `ipcRenderer` directly.
- **Renderer** (`src/renderer/`): browser chrome in vanilla TypeScript,
  HTML and CSS. No frameworks, no CDN assets; icons are inline SVG.

## Directory layout

```
src/main/        Electron main process
src/preload/     Preload scripts (UI view only)
src/renderer/    Browser chrome (HTML/CSS/TS)
tests/e2e/       Playwright tests driving Electron
.claude/         Agents, hooks and settings for Claude Code
```

`src/` and `tests/` are created in Phase 2.

## Commands

Available after Phase 1b / Phase 2:

```
npm run build      # bundle main, preload and renderer with esbuild
npm start          # build and launch the app
npm run lint       # eslint
npm run format     # prettier --write
npm run typecheck  # tsc --noEmit
npm run test:e2e   # Playwright end-to-end tests against Electron
```

Node version is pinned in `.node-version` (use `fnm use`).

## Electron security rules

Every `WebContentsView` / `BrowserWindow` must use:

- `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`
- `webSecurity: true`, no `allowRunningInsecureContent`
- No `preload` for web content views

Also:

- Validate every IPC message in the main process (types, URL schemes).
  Accept only `http:` and `https:` navigations from the UI (`about:blank` aside).
- Handle `setWindowOpenHandler` (open as new tab or deny) and `will-navigate`.
- Deny permission requests by default (`setPermissionRequestHandler`).
- Disable the spellchecker dictionary download (it contacts Google).
- Never load remote code into the UI view.

## Coding conventions

- TypeScript `strict` mode. No `any` unless it is unavoidable and commented.
- Small modules with one job each. Name things after what they do.
- Handle errors explicitly; never swallow them silently.
- Format with Prettier, lint with ESLint. The PostToolUse hook runs both
  automatically after each edit.

## Dependencies

- **Ask the user before adding any dependency**, and state the reason and the
  license.
- Licenses must be compatible with MPL-2.0 (MIT, BSD, Apache-2.0, ISC,
  MPL-2.0 are fine). No GPL code in the app.
- Pin exact versions (`save-exact=true` in `.npmrc`) and commit
  `package-lock.json`.
- Check new packages for telemetry and postinstall network access.

## Code reuse and reverse engineering

- Copy only open-source code with a compatible license, and keep its notice.
- Never decompile closed-source browsers to copy code (German UrhG §69e allows
  decompilation only in very narrow cases).
- REA (github.com/morluto/rea, npm `rea-agents`) is used only to study app
  behavior and to audit **our own** builds. Install it only from official
  sources; a trojanized look-alike repository exists.

## Git

- Small commits using Conventional Commits (`feat:`, `fix:`, `docs:`,
  `chore:`, `test:`, `refactor:`), with a scope where useful (`feat(ui): …`).
- Run the `reviewer` subagent on the diff before committing code.
- After every commit, push it right away (`git push`; remote `origin`,
  private repo github.com/v1nzenz22/ascend). The user asked for this.
- Never force-push. Never commit databases, captures or `.env` files.

## Subagents

- `privacy-auditor` – captures traffic with TShark and inspects builds with
  REA; reports every unexpected network request.
- `ui-tester` – runs Playwright UI tests against the Electron app.
- `reviewer` – code and security review of the diff before each commit.
- `bug-hunter` – sweeps the whole codebase for reproducible bugs (after each
  phase or larger feature).
- `security-auditor` – audits the whole codebase for vulnerabilities, focused
  on untrusted web content reaching privileged code (after each phase).
