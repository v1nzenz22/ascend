# Phase 2 – App skeleton

Status: proposal, waiting for the user's decision on the open questions at the
end. Approved dependencies: `vite`, `vite-plugin-pwa`, `dexie`, `vitest`,
`@playwright/test` (security review running in parallel).

This document describes **what** Phase 2 builds and **why**. It contains type
sketches and config sketches, but no finished code: the implementer writes the
code from this plan.

## 1. Goal and scope

At the end of Phase 2 there is an app that:

- builds with Vite into static files and runs with `npm run preview`,
- can be installed on the iPhone home screen and **starts without network**,
- shows a German shell: header, four placeholder pages, a bottom tab bar on
  the phone and a side navigation on wide screens,
- has a typed i18n module, number/date/energy formatting and a parser for
  German decimal input,
- creates the local database (version 1) with a small, tested read/write
  example,
- is covered by unit tests (Vitest) and browser tests (Playwright: iPhone,
  desktop, offline).

### Out of scope (later phases or separate documents)

- Real features: logging food, goals form, charts (Phase 3).
- Open Food Facts, barcode scanning, OFF caching (Phase 4).
- Choosing HTTPS hosting for iPhone tests (ROADMAP Phase 2, separate
  decision; see §11 for what this document needs from it).
- FigCraft designs. The shell uses the existing tokens and is restyled once
  the FigCraft screens exist.
- JSON export/import (Phase 3), but the data model is prepared for it (§6.8).

## 2. Constraints that shape every decision

| Constraint                   | Consequence                                                                                                                                                                                                                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Zero telemetry, no CDN       | Everything (scripts, styles, icons) is served from our own origin. CSP enforces it (§9). Workbox's optional Google Analytics module stays off.                                                                                                                                                    |
| Requests only by user action | Phase 2 makes **no** network requests besides loading the app itself. A Playwright test asserts that every request goes to the app's own origin.                                                                                                                                                  |
| iOS Safari 16.4+             | Build target `safari16.4`. Vite only lowers **syntax**; it does not polyfill **APIs**. Keep `tsconfig` `lib` at `ES2023` so that newer APIs (`Object.groupBy`, `Promise.withResolvers`, new `Set` methods: Safari 17+) cause type errors. Do not use CSS nesting (Safari 16.5) or `popover` (17). |
| Secure context               | Service Workers and `crypto.randomUUID()` only work on `https://` or `localhost`. `vite preview --host` over plain `http://192.168…` on the iPhone will not work → hosting decision.                                                                                                              |
| Beginner-friendly            | Few files, one job per file, no clever type tricks, comments explain "why".                                                                                                                                                                                                                       |

## 3. Project structure and tooling

### D1 – Where does the Vitest configuration live?

| Option                                   | Pros                                                                     | Cons                                                                               |
| ---------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| A. `test:` block inside `vite.config.ts` | One file                                                                 | The PWA plugin and CSP plugin also run during unit tests; mixing concerns confuses |
| **B. Separate `vitest.config.ts`**       | Unit tests are isolated from build plugins; each config file has one job | One more file                                                                      |

**Recommendation: B.** Small, obvious files beat one large file.

### npm scripts

```jsonc
"dev": "vite",
"build": "tsc --noEmit && vite build", // Vite does not type-check; tsc does.
"preview": "vite preview --port 4173 --strictPort",
"test": "vitest run",                   // unit tests only
"test:watch": "vitest",
"test:e2e": "playwright test",          // builds + previews automatically (webServer)
"icons": "bash scripts/generate-icons.sh"
```

Existing `typecheck`, `lint`, `format`, `format:check`, `check` stay.

### Vite build settings

- `build.target: ['es2022', 'safari16.4']` – explicit, even if the Vite
  default already covers it, so the requirement is visible in the config.
- `build.assetsInlineLimit: 0` – never inline assets as `data:` URLs, so the
  CSP can stay at `img-src 'self'`.
- `base: '/'` for now. If the hosting decision puts the app under a sub-path
  (e.g. `/ascend/` on GitHub Pages), only `base` changes.

### Avoiding `@types/node`

`tsconfig` uses DOM types only. Configs must therefore **not** use `process`,
`__dirname` or `node:fs`:

- `playwright.config.ts`: no `process.env.CI`; set
  `reuseExistingServer: false` (always test a fresh build – deterministic).
- Tests read files through Vite instead of `node:fs`
  (`import css from '../../src/styles/tokens.css?raw'`).

If this becomes impractical, `@types/node` (MIT, type definitions only, no
runtime code, no network) can be proposed as a dev dependency.

## 4. Design tokens → CSS variables

### D2 – How do tokens get into CSS?

| Option                                                                       | Complexity | Drift risk            | Beginner readability           |
| ---------------------------------------------------------------------------- | ---------- | --------------------- | ------------------------------ |
| **A. Hand-written `tokens.css` + a unit test comparing it to `tokens.json`** | Low        | Caught by the test    | High: plain CSS                |
| B. Node script generating `tokens.css` from JSON (committed output)          | Medium     | None if script is run | Medium                         |
| C. Set variables at runtime from imported JSON                               | Medium     | None                  | Low; flash of unstyled content |

**Recommendation: A.** The test parses `design/tokens.json`, resolves
`{color.x}` references and checks that every value appears in `tokens.css`
under the expected variable name.

### Variable naming

- Primitives: `--color-paper`, `--color-ink`, `--color-teal`, … (one per
  `color.*` key, kebab-case: `ruleSoft` → `--color-rule-soft`).
- Semantic theme variables (what components use):

| CSS variable      | light (`theme.light`) | dark (`theme.dark`) |
| ----------------- | --------------------- | ------------------- |
| `--bg`            | `windowBackground`    | `windowBackground`  |
| `--nav-bg`        | `tabStrip`            | `tabStrip`          |
| `--nav-active-bg` | `tabActive`           | `tabActive`         |
| `--border`        | `border`              | `border`            |
| `--text`          | `text`                | `text`              |
| `--text-muted`    | `textMuted`           | `textMuted`         |
| `--field-bg`      | `field`               | `field`             |
| `--focus-ring`    | `focusRing`           | `focusRing`         |
| `--accent`        | `accent`              | `accent`            |

- Dark mode: `@media (prefers-color-scheme: dark) { :root { … } }` overrides
  only the semantic variables. `:root { color-scheme: light dark; }` so form
  controls and scrollbars follow.
- Type, spacing, radius, sizes: `--font-ui`, `--font-display`, `--font-mono`,
  `--space-1` … `--space-7` (in `px` → convert to `rem` by /16), `--radius-*`,
  `--size-tab-height`, `--size-side-panel`.
- No gradients, no shadows (hairlines via `--border`), no web fonts.
  `font-variant-numeric: tabular-nums` on numbers.
- `:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }`

Note on font sizes: see open question 3 (tokens are from the desktop browser
era; 13 px body text is small on an iPhone and form fields under 16 px make
iOS Safari zoom in).

## 5. i18n

### D3 – Message keys

| Option                                                                                            | Type safety                     | Readability                               |
| ------------------------------------------------------------------------------------------------- | ------------------------------- | ----------------------------------------- |
| **A. Flat object with dotted keys** (`'nav.today': 'Heute'`), `type MessageKey = keyof typeof de` | Missing/unknown keys fail `tsc` | Very high; no advanced types              |
| B. Nested object, dotted path type built with template literal types                              | Same                            | Recursive conditional types: hard to read |
| C. Library (i18next, FormatJS)                                                                    | Varies                          | New dependency, more than we need         |

**Recommendation: A.**

Design:

- `src/i18n/de.ts` is the **source of truth**:
  `export const de = { 'app.name': 'ascend', 'nav.today': 'Heute', … } as const;`
  and `export type MessageKey = keyof typeof de;`
- Future languages: `export const en: Record<MessageKey, string> = { … }` –
  a missing key is a type error.
- `t(key: MessageKey, params?: Record<string, string | number>): string`
  replaces `{name}` placeholders. Numbers in params are passed already
  formatted by the caller (keeps `t` simple). Plural rules (`Intl.PluralRules`)
  are added when the first plural text appears (Phase 3).
- Locale: one constant `LOCALE = 'de-DE'` now; `setLocale()` later.
  `main.ts` sets `document.documentElement.lang = 'de'`.
- The only text **not** going through `t()`: the `<noscript>` text in
  `index.html` and the manifest. The manifest imports its German strings from
  `de.ts` inside `vite.config.ts`, so there is still one source.
- Type safety is proven by a test: `// @ts-expect-error` on
  `t('does.not.exist')`. If the key were ever accepted, `tsc` fails because
  the directive is unused.

Initial keys (Phase 2): `app.name`, `app.description`, `nav.label`,
`nav.today`, `nav.add`, `nav.goals`, `nav.settings`, `shell.skipToContent`,
`placeholder.text`, `unit.kcal`, `unit.kJ`, `error.dbUnavailable`.

### Formatting (`src/i18n/format.ts`)

| Function                                          | Implementation                                                                                         | Example (de-DE)                |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------ |
| `formatNumber(n, maxFractionDigits = 1)`          | `Intl.NumberFormat`                                                                                    | `1234.5` → `1.234,5`           |
| `formatGrams(n)` / `formatMillilitres(n)`         | `Intl.NumberFormat` with `style: 'unit', unit: 'gram' / 'milliliter'`                                  | `25` → `25 g`                  |
| `formatEnergy(kcal, unit: 'kcal' \| 'kJ')`        | Number via `Intl.NumberFormat` (0 decimals) + non-breaking space + `t('unit.kcal')`. kJ = kcal × 4.184 | `250` → `250 kcal`, `1.046 kJ` |
| `formatDate(localDate, style: 'long' \| 'short')` | `Intl.DateTimeFormat` with `dateStyle`, on the `Date` from `parseLocalDate()`                          | `20. Oktober 2026`, `20.10.26` |

Important: **`Intl` has no `kilocalorie` / `kilojoule` unit** (not in the
ECMA-402 list of sanctioned units), so energy units come from the message
file. Formatters are created once and reused (creating `Intl` objects is slow).
Tests must expect ` ` (non-breaking space) where `Intl` emits it.

### D4 – Parsing decimal input (`src/i18n/parse-decimal.ts`)

| Option                                                                                | Behaviour for `"1.5"`               | Risk                                                                                     |
| ------------------------------------------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------- |
| **A. Lenient: one separator, `,` or `.`, both mean decimal; no thousands separators** | 1,5                                 | `"1.000"` means 1 (rejecting would be stricter; amounts this large are rare and visible) |
| B. Locale-strict (`,` decimal, `.` grouping, as German writes)                        | **15** – a typo becomes a 10× error | Silent wrong nutrition values                                                            |
| C. Library                                                                            | –                                   | Dependency for 10 lines of code                                                          |

**Recommendation: A.** Signature:
`parseDecimal(input: string): number | null` (`null` = not a valid amount).

Rules: trim whitespace; allowed shape `digits [separator digits]` with at
least one digit; no sign, no exponent, no grouping; result must be finite.

| Input      | Result | Input        | Result |
| ---------- | ------ | ------------ | ------ |
| `"12"`     | 12     | `""`         | null   |
| `"12,5"`   | 12.5   | `"abc"`      | null   |
| `"12.5"`   | 12.5   | `"1.234,5"`  | null   |
| `" 0,25 "` | 0.25   | `"1,2,3"`    | null   |
| `",5"`     | 0.5    | `"-3"`       | null   |
| `"12,"`    | 12     | `"1e3"`      | null   |
| `"0"`      | 0      | `"Infinity"` | null   |

Whether 0 is allowed is the caller's decision (validation in Phase 3). Inputs
will use `inputmode="decimal"`, which shows a comma key on a German iPhone.

## 6. Local database (Dexie, schema version 1)

### 6.1 Local dates (`src/lib/local-date.ts`)

A **local date** is the calendar day in the user's time zone, stored as
`'YYYY-MM-DD'` (`type LocalDate = string`, a readable alias; a validator
`isLocalDate()` checks the shape).

- `toLocalDate(d: Date): LocalDate` uses `getFullYear()/getMonth()/getDate()`.
  **Never** `toISOString().slice(0, 10)`: that is the UTC date and is wrong
  between midnight and 01:00/02:00 in Germany.
- `parseLocalDate(s): Date` returns **noon** local time
  (`new Date(y, m - 1, d, 12)`), not midnight, so daylight-saving jumps can
  never move it to another day. Never `new Date('2026-10-20')` (parsed as UTC).
- `todayLocal(): LocalDate`, `addDays(date, n): LocalDate`.

Why strings: they sort correctly, compare with `<`, work as IndexedDB keys
and are readable in JSON/CSV exports. An entry keeps the day it was logged
for, even if the user later travels to another time zone.

### D5 – Record IDs

| Option                                      | Sync/export later                                             | Simplicity |
| ------------------------------------------- | ------------------------------------------------------------- | ---------- |
| **A. UUID strings (`crypto.randomUUID()`)** | Unique across devices: merging needs no renumbering           | High       |
| B. Auto-increment numbers (`++id`)          | Collide between devices; import must remap IDs and references | Highest    |
| C. Content-derived keys                     | Fragile                                                       | Low        |

**Recommendation: A**, wrapped in `src/lib/id.ts` (`newId()`) so tests can
stub it. Exception: `goals` and `settings` use natural keys (D7, D8).

### D6 – Timestamps

| Option                                                   | Notes                                       |
| -------------------------------------------------------- | ------------------------------------------- |
| **A. ISO 8601 UTC strings** (`new Date().toISOString()`) | Readable in exports, sort correctly as text |
| B. Epoch milliseconds (numbers)                          | Compact, but unreadable in JSON/CSV         |

**Recommendation: A.** Instants (`createdAt`, `updatedAt`, `loggedAt`) are
UTC; calendar days are `LocalDate`. The two are never mixed.

### 6.2 Nutrients

```ts
/** Nutrient values. Energy in kcal, everything else in grams. */
interface Nutrients {
  kcal: number; // required: every food has an energy value
  protein?: number;
  carbs?: number;
  fat?: number;
  sugar?: number;
  fiber?: number;
  saturatedFat?: number;
  salt?: number;
}
```

- A missing field means **unknown**, not zero. Day totals in Phase 3 can then
  say "incomplete" instead of silently counting 0.
- Energy is always stored in kcal. kJ is a display setting
  (`formatEnergy`). OFF values in kJ are converted on import (Phase 4,
  kJ ÷ 4.184).
- Values are stored as entered (plain numbers); rounding only happens when
  displaying.

### 6.3 Table `foods` – the user's own foods (and later cached OFF foods)

| Field       | Type                | Notes                                                                                              |
| ----------- | ------------------- | -------------------------------------------------------------------------------------------------- |
| `id`        | `string` (UUID)     | Primary key                                                                                        |
| `name`      | `string`            | Indexed (prefix search in Phase 3)                                                                 |
| `brand`     | `string?`           |                                                                                                    |
| `barcode`   | `string?`           | EAN/UPC, indexed (not unique: a user copy and an OFF copy may share it)                            |
| `unit`      | `'g' \| 'ml'`       | Values in `per100` are per 100 g or 100 ml                                                         |
| `per100`    | `Nutrients`         |                                                                                                    |
| `portions`  | `Portion[]`         | `{ label: string; amount: number }`, e.g. `{ label: '1 Scheibe', amount: 30 }`; `amount` in `unit` |
| `source`    | `'manual' \| 'off'` | Where the values came from                                                                         |
| `createdAt` | ISO string          |                                                                                                    |
| `updatedAt` | ISO string          | Indexed (sync/export "changed since")                                                              |

Whether OFF results live in `foods` or in a separate cache table is a
Phase 4 decision; adding a table is a normal version bump (§6.7).

### D7 – Snapshot in entries

| Option                                                                                      | History safe | Edit amount later                      | Redundancy |
| ------------------------------------------------------------------------------------------- | ------------ | -------------------------------------- | ---------- |
| **A. Copy of name, unit and `per100` + eaten `amount`; totals computed by a pure function** | Yes          | Change one number                      | None       |
| B. Only the computed totals                                                                 | Yes          | Impossible without the per-100 values  | None       |
| C. Both per-100 copy and totals                                                             | Yes          | Must recompute and can get out of sync | Yes        |

**Recommendation: A.** `nutrientsForAmount(per100, amount)` in
`src/domain/nutrients.ts` scales each known field by `amount / 100` and keeps
unknown fields unknown.

### 6.4 Table `entries` – what was eaten

| Field          | Type                                                                     | Notes                                                                                                               |
| -------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `id`           | `string` (UUID)                                                          | Primary key                                                                                                         |
| `date`         | `LocalDate`                                                              | Indexed. The day the food counts for (user's local calendar)                                                        |
| `loggedAt`     | ISO string                                                               | When it was logged; sorts entries within a day                                                                      |
| `foodId`       | `string?`                                                                | Indexed. Link to the source food; the food may be edited or deleted later — the entry never reads values through it |
| `snapshot`     | `{ name: string; brand?: string; unit: 'g' \| 'ml'; per100: Nutrients }` | Copy made at logging time                                                                                           |
| `amount`       | `number`                                                                 | Eaten amount in `snapshot.unit`                                                                                     |
| `portionLabel` | `string?`                                                                | Optional, for display ("2 × 1 Scheibe")                                                                             |
| `updatedAt`    | ISO string                                                               | Indexed                                                                                                             |

A "quick entry" without a food (only kcal) can later be stored with
`foodId` absent, `unit: 'g'`, `amount: 100` and `per100` = the typed values.
A meal field (breakfast, …) is not part of Phase 2/3 scope; adding an
unindexed field needs no schema change.

### D8 – Goals with an effective date

| Option                                                           | History correct                                        | Simplicity                                      |
| ---------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------- |
| **A. One row per goal set, primary key `validFrom` (LocalDate)** | Yes: a day uses the newest set with `validFrom <= day` | High: saving twice on one day simply overwrites |
| B. UUID key + `validFrom` index                                  | Yes                                                    | Needs rules for duplicates on the same day      |
| C. A single "current goals" row                                  | No: past days would be judged against today's goals    | Highest                                         |

**Recommendation: A.**

| Field       | Type        | Notes                                        |
| ----------- | ----------- | -------------------------------------------- |
| `validFrom` | `LocalDate` | Primary key                                  |
| `kcal`      | `number?`   | Every goal is optional: **no preset values** |
| `protein`   | `number?`   | grams                                        |
| `carbs`     | `number?`   | grams                                        |
| `fat`       | `number?`   | grams                                        |
| `updatedAt` | ISO string  |                                              |

The table starts **empty**. No code may insert default goals. Lookup:
`goals.where('validFrom').belowOrEqual(day).last()` (newest set that applies).

### D9 – Settings

| Option                                                               | Notes                                                                    |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **A. Key-value table `settings` (`{ key, value }`) + typed helpers** | One row per setting; adding a setting needs no migration; easy to export |
| B. One row containing an object with all settings                    | Every change rewrites the whole object                                   |
| C. `localStorage`                                                    | Second storage system, not in the JSON backup, synchronous               |

**Recommendation: A.** A TypeScript map gives each key its value type:

```ts
interface SettingsMap {
  energyUnit: "kcal" | "kJ";
}
const DEFAULT_SETTINGS: SettingsMap = { energyUnit: "kcal" };
// getSetting<K extends keyof SettingsMap>(key: K): Promise<SettingsMap[K]>
// setSetting<K extends keyof SettingsMap>(key: K, value: SettingsMap[K]): Promise<void>
```

Defaults are **display preferences only** and are never written to the
database until the user changes them. Goals are never settings.

### D10 – Deletion and future sync

| Option                                               | Notes                                                                                                        |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **A. Hard delete now; every record has `updatedAt`** | Simple queries. Tombstones can be added with a migration when sync exists (sync is the last item in "Later") |
| B. Soft delete (`deletedAt`) from day one            | Every query must filter deleted rows: easy to forget                                                         |

**Recommendation: A.**

### 6.5 Schema v1

```ts
db.version(1).stores({
  foods: "id, name, barcode, updatedAt",
  entries: "id, date, foodId, updatedAt",
  goals: "validFrom",
  settings: "key",
});
```

- Database name: `ascend`. Only **indexed** fields appear in the schema
  string; all other fields are stored anyway.
- Typed with Dexie 4's `EntityTable`:
  `new Dexie('ascend') as Dexie & { foods: EntityTable<Food, 'id'>; … }`.
- Booleans cannot be indexed in IndexedDB; none are.
- `main.ts` opens the database with `await db.open()`. If that fails
  (storage disabled, quota, blocked upgrade in another tab), the shell shows
  `t('error.dbUnavailable')` instead of the pages. Only `console.error`,
  never a report anywhere.

### 6.6 Minimal read/write example (no UI)

- `src/db/settings.ts`: `getSetting` / `setSetting` (D9).
- `src/db/entries.ts`:
  - `logFood(food: Food, amount: number, date: LocalDate): Promise<Entry>` –
    builds the snapshot by copying (not referencing) `name`, `brand`, `unit`,
    `per100`.
  - `entriesOn(date: LocalDate): Promise<Entry[]>` – indexed query, sorted by
    `loggedAt`.
- Tests prove: an entry can be written and read by date; **changing the food
  afterwards does not change the entry**; settings fall back to defaults.

With `exactOptionalPropertyTypes`, copy optional fields with conditional
spreads (`...(food.brand !== undefined && { brand: food.brand })`) instead of
assigning `undefined`.

### 6.7 Migrations

Rules for every future schema change:

1. **Never edit `version(1)`** once released. Add `db.version(2).stores({…})`
   listing only changed tables, plus `.upgrade(tx => …)` if existing data
   must change. Keep all old version blocks in the file as history.
2. Adding an **unindexed** field needs no new version; code must accept
   records without it (it is optional in the type).
3. Write data transformations as **pure functions**
   (`migrateEntryV1toV2(entry)`), called from the Dexie upgrade **and** from
   the JSON import, so old backups can be restored.
4. Every migration gets a test: create a v1 database in fake-indexeddb, put
   v1 data in, open with the new schema, check the data.

### 6.8 Prepared for export (Phase 3+)

Backup format sketch: `{ app: 'ascend', format: 1, schemaVersion: 1,
exportedAt, foods, entries, goals, settings }`. Because records already
contain snapshots, ISO strings and UUIDs, export is a plain dump and CSV
needs no lookups.

### 6.9 Persistent storage (`navigator.storage.persist()`)

Browsers may delete IndexedDB data under storage pressure; Safari in a normal
tab deletes script-written data after 7 days without use (apps added to the
home screen are exempt and have their **own** storage, separate from Safari).

### D11 – When to call `persist()`

| Option                                                | Notes                                                                                                      |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| A. On every app start                                 | Firefox shows a permission prompt before the user has done anything: confusing                             |
| **B. Once after the user saves their first own data** | The request has a visible reason; Chromium and Safari decide silently, Firefox asks at a meaningful moment |
| C. Only from a button in Settings                     | Most users never press it                                                                                  |

**Recommendation: B** (plus a status line in Settings in Phase 3). Phase 2
builds and tests the helper `requestPersistentStorage(): Promise<'persisted'
| 'not-persisted' | 'unsupported'>` in `src/app/storage.ts` (checks
`persisted()` first, then calls `persist()`), but nothing calls it yet,
because Phase 2 has no user data.

### D12 – Testing Dexie in Vitest (new dev dependency proposal)

Vitest runs in Node, which has no IndexedDB.

| Option                                                                                 | New dependency                     | Notes                                       |
| -------------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------- |
| **A. `fake-indexeddb`** (in-memory IndexedDB for Node, `import 'fake-indexeddb/auto'`) | Yes, dev only                      | Fast, simple, the approach Dexie's docs use |
| B. Vitest browser mode                                                                 | Yes (`@vitest/browser` + provider) | Real browser, more setup                    |
| C. Test the database only through Playwright                                           | No                                 | Needs a test hook in the app; slow; awkward |

**Recommendation: A**, pending user approval and security review:

- Purpose: IndexedDB implementation for unit tests (dev dependency only,
  never shipped to users).
- License: Apache-2.0 (MPL-2.0 compatible).
- Size: small pure-JavaScript package with no runtime dependencies (exact
  version and size to be confirmed by `security-reviewer`).
- Network/telemetry: none known; to be confirmed by `security-reviewer`.

If the user declines: option C (Playwright-only database test via
`page.evaluate`).

## 7. App shell (UI)

### D13 – Building DOM without a framework

| Option                                                                                            | Security                             | Type-safe i18n                   | Readability      |
| ------------------------------------------------------------------------------------------------- | ------------------------------------ | -------------------------------- | ---------------- |
| A. Static HTML in `index.html`, texts filled from `data-i18n="nav.today"` attributes              | Safe                                 | **No**: keys are strings in HTML | High             |
| **B. Tiny helper `el(tag, props, children)` in TypeScript using `createElement` + `textContent`** | Safe by design                       | Yes                              | High             |
| C. Template strings + `innerHTML`                                                                 | XSS risk; forbidden by project rules | Partly                           | High, but unsafe |

**Recommendation: B.** `src/ui/dom.ts` exports `el()`; text children are
always set with `textContent`. `index.html` contains only `<div id="app">`
and a `<noscript>` message.

### D14 – Navigation / routing

| Option                                                           | Hosting needs                                                       | Back button / deep links | Code      |
| ---------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------ | --------- |
| **A. Hash routes (`#/today`, `#/add`, `#/goals`, `#/settings`)** | None: works on every static host and offline                        | Yes                      | ~30 lines |
| B. History API (`/today`)                                        | Server must rewrite all paths to `index.html` (GitHub Pages cannot) | Yes                      | More      |
| C. No URL, only in-memory state                                  | None                                                                | No                       | Least     |

**Recommendation: A.** `src/app/routes.ts` is a plain list
(`{ id, hash, titleKey }`), `src/app/router.ts` listens to `hashchange`,
renders the page into `<main>`, updates `aria-current="page"` on the active
link, `document.title` and the `<h1>`, and moves focus to the `<h1>`
(`tabindex="-1"`) after a navigation (not on first load), so screen readers
announce the new page. Unknown or empty hash → `location.replace('#/today')`.
Hash names are English (identifiers); visible labels come from i18n.

### D15 – Responsive navigation

| Option                                                    | Notes                                                    |
| --------------------------------------------------------- | -------------------------------------------------------- |
| **A. One `<nav>` element, restyled by a CSS media query** | One landmark, one set of links, no JS for layout         |
| B. Two navs (tab bar + sidebar), one hidden               | Duplicate links; must hide correctly from screen readers |
| C. JavaScript switches layout on `resize`                 | More code, flicker                                       |

**Recommendation: A.** Structure (DOM order):

```
<a class="skip-link" href="#main">Zum Inhalt springen</a>
<header>  <h1 tabindex="-1">Heute</h1>  </header>
<nav aria-label="Hauptnavigation">  <a href="#/today" aria-current="page">Heute</a> …  </nav>
<main id="main">  placeholder page  </main>
```

- Links, not ARIA tabs: this is navigation between pages, and links give the
  right semantics for free.
- **Phone (default):** header `position: sticky; top: 0`; nav
  `position: fixed; bottom: 0`, four equal columns, min height
  `--size-tab-height` (44 px) plus `padding-bottom: env(safe-area-inset-bottom)`;
  `main` gets matching bottom padding. Text labels only in Phase 2; icons
  follow the FigCraft design.
- **Wide (`min-width: 60rem`, 960 px):** CSS grid with columns
  `var(--size-side-panel) 1fr` (264 px); nav becomes a vertical list on the
  left (`position: sticky; top: 0; height: 100dvh`), separated by a hairline.
  This is the base for the desktop dashboard.
- Active link: `--nav-active-bg` background and `--accent` text indicator;
  never colour alone (also `font-weight: 600`).
- Viewport meta: `width=device-width, initial-scale=1, viewport-fit=cover`.
  Zoom stays allowed.
- Placeholder pages: one generic module `src/ui/placeholder-page.ts` renders
  `t('placeholder.text')`. Real `src/features/*` folders start in Phase 3.

## 8. PWA

### Manifest (generated by vite-plugin-pwa)

| Field                      | Value                                                                                                      |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `name` / `short_name`      | `ascend`                                                                                                   |
| `description`              | from `de['app.description']`, e.g. "Kalorien und Nährwerte erfassen – offline, ohne Konto, ohne Tracking." |
| `lang` / `dir`             | `de` / `ltr`                                                                                               |
| `id`, `start_url`, `scope` | `/` (follows `base`)                                                                                       |
| `display`                  | `standalone`                                                                                               |
| `orientation`              | not set (desktop and landscape allowed)                                                                    |
| `theme_color`              | `#FBFAF7` (`theme.light.windowBackground`)                                                                 |
| `background_color`         | `#FBFAF7`                                                                                                  |
| `icons`                    | `icons/icon-192.png` (any), `icons/icon-512.png` (any), `icons/icon-maskable-512.png` (maskable)           |

`index.html` additionally has:

- `<meta name="theme-color" content="#FBFAF7" media="(prefers-color-scheme: light)">`
  and `content="#141818"` for dark (the manifest allows only one colour).
- `<meta name="color-scheme" content="light dark">`
- `<link rel="apple-touch-icon" href="/icons/apple-touch-icon-180.png">`
- `<meta name="apple-mobile-web-app-title" content="ascend">`
- `<meta name="referrer" content="no-referrer">` (privacy for later OFF
  requests).
- iOS splash images (`apple-touch-startup-image`) are out of scope.

Theme colour alternative: teal `#1E5C5E` would brand the browser bar but
clash with the light header. Recommendation: surface colour (calm, matches
the header).

### Icons

The existing `design/export/ascend-icon-1024.png` is a **macOS** icon: an
824 px rounded tile on a 1024 px transparent canvas with a drop shadow. It
cannot be used as is:

- iOS fills transparent pixels of `apple-touch-icon` with black and rounds
  the corners itself → black frame around a small tile.
- Maskable icons must fill the whole square; the platform cuts the shape
  (safe zone: a centred circle with 80 % of the width).

### D16 – Producing web icons

| Option                                                                                                                                                                                                                                                                                                                    | Quality                                                                                            | Dependencies                            | Changes design files                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------ |
| **A. Add a "full-bleed" variant to `design/scripts/render-icon.swift`** (square mint tile, no margin, no rounding, no drop shadow, same "a", inner shadow and grain) writing `design/export/ascend-icon-web-1024.png`; then `scripts/generate-icons.sh` scales it with `sips` into `public/icons/`; outputs are committed | Exact design                                                                                       | None (macOS built-ins)                  | Adds a function + one new export; existing outputs unchanged |
| B. Crop/pad the existing PNG with `sips` only                                                                                                                                                                                                                                                                             | Rounded corners stay transparent (sips cannot fill them); cropping further changes the composition | None                                    | No                                                           |
| C. `@vite-pwa/assets-generator` at build time                                                                                                                                                                                                                                                                             | Needs a full-bleed source anyway                                                                   | New dependency (sharp, native binaries) | No                                                           |

**Recommendation: A** (needs user approval, open question 1).

- The same full-bleed image is used for `any` and `maskable`: the "a" is
  already an abstract, cropped composition, so a circular mask keeps the arch
  and bowl readable. Check in Chrome DevTools → Application → Manifest
  ("show only the minimum safe area for maskable icons"), offline, without
  uploading the icon anywhere.
- `scripts/generate-icons.sh` (macOS only, run manually via `npm run icons`,
  **never** part of `npm run build`, so building works anywhere):

  ```sh
  SRC=design/export/ascend-icon-web-1024.png
  sips -z 192 192 "$SRC" --out public/icons/icon-192.png
  sips -z 512 512 "$SRC" --out public/icons/icon-512.png
  sips -z 512 512 "$SRC" --out public/icons/icon-maskable-512.png
  sips -z 180 180 "$SRC" --out public/icons/apple-touch-icon-180.png
  ```

- The four PNGs are committed (a few tens of kB each).

### D17 – Service worker update strategy

| Option                                                                        | Code                                        | Risk                                                                                                         |
| ----------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **A. `generateSW`, `registerType: 'autoUpdate'`, `injectRegister: 'script'`** | Zero app code (plugin adds `registerSW.js`) | New version activates in the background; the open page keeps running and the next start uses the new version |
| B. `registerType: 'prompt'` with a "Neue Version – neu laden" banner          | Banner UI + i18n                            | Safest when forms exist                                                                                      |
| C. Own service worker (`injectManifest`)                                      | Most code                                   | Full control, easy to get wrong                                                                              |

**Recommendation: A for Phase 2**, revisit B in Phase 3 when users type into
forms. `injectRegister: 'script'` loads an external file, so no inline script
is needed (CSP).

Workbox settings:

- `globPatterns: ['**/*.{html,js,css,png,svg,webmanifest}']` – precache the
  whole app shell (it is small).
- `navigateFallback: 'index.html'`, `cleanupOutdatedCaches: true`.
- `runtimeCaching`: **none**. Open Food Facts caching comes in Phase 4.
- Google Analytics offline module: **off** (default; never enable).
- `devOptions.enabled: false`: no service worker in `npm run dev` (avoids
  stale-cache confusion while developing). The SW exists only in
  `build`/`preview`.
- `includeAssets: ['icons/apple-touch-icon-180.png']` so the iOS icon is
  precached too (manifest icons are included automatically).

## 9. Security: Content Security Policy

### D18 – How the CSP is delivered

| Option                                                                                                                                                                                | Notes                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. `<meta http-equiv="Content-Security-Policy">` injected only into the production build** by a ~10-line inline plugin in `vite.config.ts` (`apply: 'build'`, `transformIndexHtml`) | Works on every static host and in `vite preview` (so Playwright tests it). Dev server unaffected (Vite dev injects inline styles that a strict CSP would block) |
| B. Same meta tag always (also in dev), with `'unsafe-inline'` for styles                                                                                                              | Weaker policy in production too                                                                                                                                 |
| C. HTTP header from the host                                                                                                                                                          | Strongest (allows `frame-ancestors`), but hosting is not chosen yet                                                                                             |

**Recommendation: A now; add C when hosting is chosen** (same policy plus
`frame-ancestors 'none'`).

Policy (one line in the build output):

```
default-src 'self';
script-src 'self';
style-src 'self';
img-src 'self';
font-src 'self';
connect-src 'self';
manifest-src 'self';
worker-src 'self';
object-src 'none';
base-uri 'self';
form-action 'self'
```

Consequences for code: no inline `<script>`, no `style="…"` attributes in
HTML (setting `element.style.x` from TypeScript is allowed), no `data:` images
(hence `assetsInlineLimit: 0`), no external fonts. Phase 4 adds the Open Food
Facts host to `connect-src` (and `img-src` if product images are shown).

## 10. Tests

### Unit tests (Vitest, Node environment, `tests/unit/**/*.test.ts`)

| File                    | Covers                                                                                                                                                                                                                                  |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `i18n.test.ts`          | `t()` returns German texts, replaces `{params}`; `@ts-expect-error` for an unknown key                                                                                                                                                  |
| `format.test.ts`        | numbers with decimal comma and thousands dot, `g`, `kcal`/`kJ` conversion, long/short dates                                                                                                                                             |
| `parse-decimal.test.ts` | every row of the table in D4                                                                                                                                                                                                            |
| `local-date.test.ts`    | `toLocalDate(new Date(2026, 9, 21, 0, 30))` is `'2026-10-21'`; `addDays` across the DST change (`'2026-03-28'` + 1 = `'2026-03-29'`); `isLocalDate`. Built with the local `Date` constructor so results are the same in every time zone |
| `nutrients.test.ts`     | scaling by amount; unknown fields stay unknown                                                                                                                                                                                          |
| `db.test.ts`            | (fake-indexeddb) log a food and read it by date; editing the food leaves the entry unchanged; goals table starts empty; settings default and round-trip                                                                                 |
| `storage.test.ts`       | `requestPersistentStorage()` with stubbed `navigator.storage` (`vi.stubGlobal`): already persisted, granted, denied, unsupported                                                                                                        |
| `tokens.test.ts`        | every colour and theme value in `design/tokens.json` appears in `tokens.css` (`?raw` import)                                                                                                                                            |

### Browser tests (Playwright, against `vite preview`)

`playwright.config.ts`:

- `webServer: { command: 'npm run build && npm run preview', url: 'http://localhost:4173', reuseExistingServer: false }`
- `use.baseURL: 'http://localhost:4173'`
- Projects:
  - `iphone`: `devices['iPhone 15']` (WebKit), ignores `offline.spec.ts`
  - `desktop`: `devices['Desktop Chrome']` with viewport 1440×900, ignores
    `offline.spec.ts`
  - `offline`: `devices['Desktop Chrome']`, runs only `offline.spec.ts`

### D19 – Which browser runs the offline test?

| Option                                                       | Notes                                                                                                 |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| **A. Chromium only, plus a manual check on the real iPhone** | Service-worker support in Playwright is most complete in Chromium; reliable                           |
| B. Chromium and WebKit                                       | Playwright's WebKit build is not iOS Safari; risk of flaky failures that say nothing about the iPhone |

**Recommendation: A.** The phase-end checklist includes: install on the
iPhone, flight mode, start the app.

| Spec              | Checks                                                                                                                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shell.spec.ts`   | `<html lang="de">`; heading "Heute"; clicking each nav link changes heading, URL hash and `aria-current`; skip link works; **no console errors** (catches CSP violations); **every request goes to the app's own origin** |
| `layout.spec.ts`  | iPhone: nav is at the bottom of the viewport and horizontal; desktop: nav is on the left, full height. Dark mode via `page.emulateMedia({ colorScheme: 'dark' })` changes the background colour                           |
| `pwa.spec.ts`     | manifest is linked, valid JSON, has the four icon entries and they load (HTTP 200); CSP meta tag present                                                                                                                  |
| `offline.spec.ts` | load `/`, wait until `navigator.serviceWorker.controller` is set, `context.setOffline(true)`, reload → heading "Heute" visible; navigate to `#/goals` offline                                                             |

Browsers are installed once with `npx playwright install chromium webkit`
(a developer-triggered download, not part of the app).

## 11. Dependency on the hosting decision

This plan works without hosting. Hosting only changes: `base` (if a sub-path
is used), the CSP header option (D18-C), and enables testing on the real
iPhone over HTTPS.

## 12. File list (in implementation order)

New files unless marked _(modify)_.

| #   | Path                                          | Purpose                                                                                                       |
| --- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 1   | `package.json` _(modify)_                     | Approved dependencies (exact versions), scripts from §3                                                       |
| 2   | `vite.config.ts`                              | Build target, `assetsInlineLimit`, PWA plugin + manifest, build-only CSP plugin                               |
| 3   | `vitest.config.ts`                            | Unit tests: Node environment, `tests/unit/**/*.test.ts`                                                       |
| 4   | `index.html`                                  | Root page: `lang="de"`, viewport, theme-color, apple-touch-icon, referrer, `#app`, `<noscript>`, entry script |
| 5   | `src/vite-env.d.ts`                           | `/// <reference types="vite/client" />` (types for `?raw` and CSS imports)                                    |
| 6   | `src/main.ts`                                 | Entry: import styles, set `lang`, open DB, mount shell, start router                                          |
| 7   | `src/i18n/de.ts`                              | German messages, source of truth; exports `MessageKey`                                                        |
| 8   | `src/i18n/i18n.ts`                            | `LOCALE`, `t()` with `{param}` replacement                                                                    |
| 9   | `src/i18n/format.ts`                          | `formatNumber`, `formatGrams`, `formatMillilitres`, `formatEnergy`, `formatDate`                              |
| 10  | `src/i18n/parse-decimal.ts`                   | `parseDecimal()` for German/English decimal input                                                             |
| 11  | `src/lib/local-date.ts`                       | `LocalDate` type, `toLocalDate`, `parseLocalDate`, `todayLocal`, `addDays`, `isLocalDate`                     |
| 12  | `src/lib/id.ts`                               | `newId()` → `crypto.randomUUID()`                                                                             |
| 13  | `src/domain/nutrients.ts`                     | `Nutrients` type, `nutrientsForAmount()`                                                                      |
| 14  | `src/db/types.ts`                             | `Food`, `Portion`, `Entry`, `EntrySnapshot`, `Goal`, `SettingsMap`, `SettingRow`                              |
| 15  | `src/db/db.ts`                                | Dexie instance `ascend`, schema version 1, migration rules as comments                                        |
| 16  | `src/db/settings.ts`                          | `getSetting` / `setSetting` with defaults                                                                     |
| 17  | `src/db/entries.ts`                           | `logFood()` (snapshot copy), `entriesOn()`                                                                    |
| 18  | `src/app/storage.ts`                          | `requestPersistentStorage()` (not called yet, see D11)                                                        |
| 19  | `src/styles/tokens.css`                       | CSS variables from `design/tokens.json`, light + dark                                                         |
| 20  | `src/styles/base.css`                         | Minimal reset, system fonts, colours, `:focus-visible`, skip link, tabular numbers                            |
| 21  | `src/styles/layout.css`                       | Header, bottom tab bar, side navigation at ≥ 60rem, safe areas                                                |
| 22  | `src/ui/dom.ts`                               | `el()` helper (createElement + textContent, no innerHTML)                                                     |
| 23  | `src/ui/placeholder-page.ts`                  | Generic placeholder page content                                                                              |
| 24  | `src/app/routes.ts`                           | Route list: id, hash, title key                                                                               |
| 25  | `src/app/router.ts`                           | Hash router: render page, `aria-current`, title, focus                                                        |
| 26  | `src/app/shell.ts`                            | Builds skip link, header, nav, main; shows DB error message                                                   |
| 27  | `design/scripts/render-icon.swift` _(modify)_ | Add full-bleed web icon render (open question 1)                                                              |
| 28  | `design/export/ascend-icon-web-1024.png`      | Rendered full-bleed source icon                                                                               |
| 29  | `scripts/generate-icons.sh`                   | `sips` resize into `public/icons/` (macOS, run manually)                                                      |
| 30  | `public/icons/icon-192.png`                   | Manifest icon                                                                                                 |
| 31  | `public/icons/icon-512.png`                   | Manifest icon                                                                                                 |
| 32  | `public/icons/icon-maskable-512.png`          | Manifest maskable icon                                                                                        |
| 33  | `public/icons/apple-touch-icon-180.png`       | iOS home-screen icon                                                                                          |
| 34  | `playwright.config.ts`                        | webServer on preview, projects `iphone`, `desktop`, `offline`                                                 |
| 35  | `tests/unit/i18n.test.ts`                     | see §10                                                                                                       |
| 36  | `tests/unit/format.test.ts`                   | see §10                                                                                                       |
| 37  | `tests/unit/parse-decimal.test.ts`            | see §10                                                                                                       |
| 38  | `tests/unit/local-date.test.ts`               | see §10                                                                                                       |
| 39  | `tests/unit/nutrients.test.ts`                | see §10                                                                                                       |
| 40  | `tests/unit/db.test.ts`                       | see §10 (needs fake-indexeddb, D12)                                                                           |
| 41  | `tests/unit/storage.test.ts`                  | see §10                                                                                                       |
| 42  | `tests/unit/tokens.test.ts`                   | see §10                                                                                                       |
| 43  | `tests/e2e/shell.spec.ts`                     | see §10                                                                                                       |
| 44  | `tests/e2e/layout.spec.ts`                    | see §10                                                                                                       |
| 45  | `tests/e2e/pwa.spec.ts`                       | see §10                                                                                                       |
| 46  | `tests/e2e/offline.spec.ts`                   | see §10                                                                                                       |
| 47  | `design/README.md` _(modify)_                 | Mention the web icon export and `npm run icons`                                                               |

No changes needed to `tsconfig.json` (its `include` already covers `src`,
`tests` and `*.config.ts`), `eslint.config.js` (already ignores `dist/` and
`dev-dist/`) or `.gitignore`. README/ROADMAP updates go to `docs-writer`.

## 13. Commit plan

Each commit must pass `npm run check` and `npm test`; the last two also
`npx playwright test`.

1. **`chore: set up vite, vitest and app entry`** – files 1–6 (with
   `vite.config.ts` still without PWA and CSP; `main.ts` renders only the
   app name). `npm run dev/build/preview/test` work.
2. **`feat(i18n): add typed german messages, formatting and decimal parsing`**
   – files 7–11 and tests 35–38.
3. **`feat(db): add dexie schema v1 with nutrient snapshots`** – files 12–18
   and tests 39–41 (plus `fake-indexeddb` if approved).
4. **`feat(ui): add design tokens and responsive app shell`** – files 19–26
   and test 42; `main.ts` mounts the shell.
5. **`feat(pwa): add icons, manifest, service worker and csp`** – files 27–33
   and 47; PWA + CSP sections of `vite.config.ts`; `index.html` meta tags.
6. **`test(e2e): add playwright projects for iphone, desktop and offline`** –
   files 34, 43–46.

## 14. Phase-end checklist

- [ ] `npm run check`, `npm test`, `npx playwright test` green
- [ ] `npm run build` output: no request to any other origin (Playwright check),
      CSP meta present
- [ ] Lighthouse/DevTools: manifest valid, installable, maskable icon looks right
- [ ] On the iPhone (once HTTPS hosting exists): add to home screen, icon has
      no black frame, flight mode → app starts
- [ ] `security-reviewer` and `reviewer` pass

## 15. Open questions for the user

1. **Web icon:** may `design/scripts/render-icon.swift` get an additional
   full-bleed render (`ascend-icon-web-1024.png`) for iPhone/PWA icons?
   Existing outputs stay unchanged. (Recommended: yes – D16-A.)
2. **New dev dependency `fake-indexeddb`** (Apache-2.0, tests only, never
   shipped) to test the database in Vitest? (Recommended: yes – D12-A;
   otherwise database tests only in Playwright.)
3. **Font sizes on the iPhone:** `tokens.json` has 13 px body text from the
   desktop-browser era. iOS uses 17 px and zooms into fields under 16 px.
   Recommended: add a mobile type scale to `tokens.json` (e.g. caption 13,
   body 17, heading 20, title 28, display 48; form fields ≥ 16 px) and use
   the current sizes only for the desktop layout; final values follow the
   FigCraft design.
