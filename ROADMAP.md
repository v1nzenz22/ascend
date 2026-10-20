# Roadmap

Phases are done in order. Each phase ends with a build, tests and a review
before the next one starts.

## Phase 0 – Decisions ✅

- Product: a minimal calorie and nutrition tracker for everyone
- Platform: progressive web app; iPhone first, desktop browser as dashboard
- Data: local first (IndexedDB); an optional private account without email
  for end-to-end encrypted sync is planned (see Phase 6)
- Stack: Vite, TypeScript, Dexie, vite-plugin-pwa, barcode-detector, Vitest,
  Playwright
- License: MPL-2.0
- The earlier browser project is discontinued; its design work stays in
  `design/history/`

## Phase 1 – Foundation ✅

- Remove browser-specific code and agents
- New project guide, README and roadmap
- Claude Code agents: researcher, architect, implementer, security-reviewer,
  reviewer, ui-tester, bug-hunter, docs-writer
- Hooks for formatting, linting, blocking dangerous commands and keeping
  personal data out of the repository

## Phase 2 – App skeleton ✅

- Vite + TypeScript app, installable as a PWA, starts offline
- Design tokens as CSS variables; German interface through an i18n module
- Local database schema (foods, entries, goals, settings)
- Playwright projects: iPhone (WebKit), desktop (Chromium), offline
- Hosting decided: Cloudflare Pages, set up later (see Phase 3)
- Design in FigCraft: foundations, components, iPhone screens, desktop
  dashboard

## Phase 3 – Core

- Deploy to Cloudflare Pages for testing on the iPhone (HTTPS; headers
  `frame-ancestors 'none'` and `Cache-Control: no-cache` for `sw.js`)
- Today view: totals against your goals
- Log food by hand with portions; keep your own foods
- Daily goals for calories and macronutrients, with no preset values
- Desktop dashboard: day and week views with simple charts
- JSON backup (export and import), because iOS can clear web app data in rare
  cases
- Prepare for sync: all writes go through one module; each entry records its
  time-zone offset (for the “when you log” insight)

## Phase 4 – Online food data

- Search Open Food Facts on demand (never while typing) and scan barcodes
- Convert kJ to kcal when needed; check values for plausibility
- Cache results on the device; show the Open Food Facts attribution
- A setting to keep the app fully offline

## Phase 5 – Insights (local)

- When you log (time of day), streaks, weekly averages, days within goal
- Computed on the device only; nothing is uploaded

## Phase 6 – Account and sync

> [!NOTE]
> Proposed in [`docs/design/account-and-sync.md`](docs/design/account-and-sync.md);
> details are still being decided.

- Optional account without email: a random account key created on the device
  (passkeys later)
- End-to-end encrypted sync between iPhone and computer; logging still works
  offline and syncs when a connection is back
- Server on Cloudflare (same origin as the app): stores only encrypted data,
  no IP addresses, no exact times; deleting the account deletes everything
- Device list, new account key, delete account

## Phase 7 – Activity imports

- Strava account export (`activities.csv`, FIT/GPX) and Apple Health export,
  read on the device; no server needed

## Phase 8 – Passkeys

- Sign in with a passkey; the account key stays as recovery

## Phase 9 – Strava API (optional)

- Stateless token proxy (the client secret lives only on the server), manual
  import, API data deleted after 7 days and never synced, as Strava requires

## Later

1. **Workout log:** exercises, sets, repetitions, weight.
2. **Full data export:** JSON and CSV.
3. **More languages.**
4. **App Store version** (Capacitor or Expo). Needed for Apple Health
   (HealthKit) and Android Health Connect.
5. **Fitbit through the Google Health API.** The Fitbit Web API shuts down on
   30 October 2026. Restricted scopes and Google verification are required,
   so this has low priority.
