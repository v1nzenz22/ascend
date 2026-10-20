# Roadmap

Phases are done in order. Each phase ends with a build, tests and a review
before the next one starts.

## Phase 0 – Decisions ✅

- Product: a minimal calorie and nutrition tracker for everyone
- Platform: progressive web app; iPhone first, desktop browser as dashboard
- Data: local only (IndexedDB), no account; each device keeps its own data
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

## Phase 4 – Online food data

- Search Open Food Facts on demand (never while typing) and scan barcodes
- Convert kJ to kcal when needed; check values for plausibility
- Cache results on the device; show the Open Food Facts attribution
- A setting to keep the app fully offline

## Later

1. **Workout log:** exercises, sets, repetitions, weight.
2. **Import activities, locally and without a server:** Strava account export
   (`activities.csv`, FIT/GPX files) and the Apple Health export. The Strava
   API stays optional: it needs a small server for the client secret, allows
   caching for at most 7 days, forbids AI use, and limits new apps to one
   athlete.
3. **Full data export:** JSON and CSV.
4. **More languages.**
5. **App Store version** (Capacitor or Expo). Needed for Apple Health
   (HealthKit) and Android Health Connect.
6. **Fitbit through the Google Health API.** The Fitbit Web API shuts down on
   30 October 2026. Restricted scopes, Google verification and a server are
   required, so this has low priority.
7. **Optional sync** between devices, end-to-end encrypted.
