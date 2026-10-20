# Phase 3 – Core (local)

Status: proposal, waiting for the user's decisions on the open questions (§16).
Decided earlier and not reopened here: account without email (account key,
passkeys later), account optional, backend on Cloudflare (Pages Functions + D1,
same origin), order "local first" (3 core, 4 Open Food Facts, 5 insights,
6 account and sync), Strava mainly via export file. **Phase 3 builds no
account and no server**; it only prepares for sync (`src/db/write.ts`,
`Entry.loggedTzOffset`, see `account-and-sync.md` §4.5, §5.3).

This document says **what** Phase 3 builds and **why**. It contains type and
API sketches so several implementers can work in parallel against the same
contracts (§13), but no finished code.

The screens follow the FigCraft exports in `design/figcraft/export/`
(`Heute.png`, `Heute _ ohne Ziel.png`, `Heute _ Dunkel.png`,
`Hinzufügen _ Suche.png`, `Hinzufügen _ Offline.png`,
`Hinzufügen _ Manuell.png`, `Lebensmittel _ Portion.png`, `Ziele.png`,
`Einstellungen.png`, `Sheet _ Eintrag.png`, `Dialog _ Löschen.png`,
`Desktop _ Dashboard.png`, `page-Components.png`, `page-Foundations.png`).
Where this document deviates from a screen, the deviation is listed in §2.3.

## 1. Goal and scope

At the end of Phase 3 a person can, on the iPhone (installed from Cloudflare
Pages) and on a desktop browser, fully offline:

1. see today: a calorie ring, three nutrient bars, entries grouped by meal
   (collapsible), "übrig" / "über Ziel", and empty states;
2. log food by hand (name + values per 100 g), keep it as an own food, find
   it again with a local search, pick a portion, amount and meal;
3. edit and delete entries (bottom sheet + confirmation dialog);
4. set daily goals for energy, protein, carbohydrates and fat – empty by
   default, saved with an effective date so past days keep their goals;
5. choose kcal/kJ and light/dark/system appearance, export and import a JSON
   backup, read the privacy text;
6. on a wide screen, see today next to a week bar chart and the macronutrient
   distribution.

Additionally: all writes go through `src/db/write.ts`; entries record
`loggedTzOffset`; the Phase 2 "Deferred to Phase 3" items are resolved (§9);
the app is deployed to Cloudflare Pages with security headers (§11).

### Out of scope

- Open Food Facts search, barcode scanning, kJ plausibility checks (Phase 4).
  The "Suche" and "Scannen" tabs exist, but only search **local** foods /
  show an offline placeholder.
- Statistics (streaks, logging time) – Phase 5. The "Statistiken" row on the
  Ziele screen and the desktop nav items "Statistiken", "Geräte" and "Woche"
  are not built.
- Account, sync, devices, Strava (Phases 6–9). The settings row "Konto & Sync"
  shows "Bald verfügbar" and is not interactive.
- Logging for days other than today, CSV export, `ml` foods in the manual
  form (the data model already supports `ml`), more languages.

## 2. Design reference

### 2.1 Screens → routes

| FigCraft screen                            | Route (hash)                                 | Package |
| ------------------------------------------ | -------------------------------------------- | ------- |
| Heute, Heute · ohne Ziel, Heute · Dunkel   | `#/today`                                    | P4      |
| Sheet · Eintrag, Dialog · Löschen          | overlay on `#/today`                         | P4      |
| Hinzufügen · Suche / · Offline / · Manuell | `#/add/search`, `#/add/scan`, `#/add/manual` | P5      |
| Lebensmittel · Portion                     | `#/food/<id>` (log), `#/entry/<id>` (edit)   | P5      |
| (form of Hinzufügen · Manuell, prefilled)  | `#/food/<id>/edit`                           | P5      |
| Ziele                                      | `#/goals`                                    | P6      |
| Einstellungen                              | `#/settings`, `#/settings/about`             | P7      |
| Desktop · Dashboard                        | `#/today` at ≥ 60rem                         | P8      |

Every `#/add/*`, `#/food/*` and `#/entry/*` route accepts `?meal=breakfast |
lunch | dinner | snacks` (the meal the "+" button was pressed for).

### 2.2 Components (page-Components.png) → modules

| FigCraft component                                      | Module                                            |
| ------------------------------------------------------- | ------------------------------------------------- |
| Icons                                                   | `src/ui/icons.ts`                                 |
| Kopfzeile (title + subtitle; back link + centred title) | `src/app/shell.ts` (page header)                  |
| Button (primary, secondary, text, danger; disabled)     | CSS classes in `src/styles/components.css`        |
| Textfeld, Zahlenfeld (normal, focused, error)           | `src/ui/text-field.ts`, `src/ui/number-field.ts`  |
| Suchfeld                                                | `src/ui/search-field.ts`                          |
| Eintrag (entry row, food row with chevron)              | `src/ui/list-row.ts`                              |
| Mahlzeit (open/closed)                                  | `src/features/today/meal-group.ts`                |
| Nährwertbalken (with goal / "Kein Ziel gesetzt")        | `src/features/today/nutrient-bar.ts`              |
| Tagesring (under, over, no goal)                        | `src/features/today/day-ring.ts`                  |
| Tableiste, Navigationseintrag (Desktop)                 | `src/app/shell.ts` + `layout.css`                 |
| Segmente                                                | `src/ui/segmented.ts`                             |
| Hinweis                                                 | `src/ui/notice.ts`                                |
| Schalter                                                | not used in Phase 3 (see §2.3)                    |
| Einstellungszeile                                       | `src/features/settings/setting-row.ts`            |
| Chip                                                    | `src/ui/chip-group.ts`                            |
| Quellenhinweis                                          | not shown in Phase 3 (only for OFF data, Phase 4) |
| Leerzustand                                             | `src/ui/empty-state.ts`                           |
| Tagesbalken, Tooltip (Desktop)                          | `src/features/dashboard/week-chart.ts`            |
| Toast                                                   | `src/ui/toast.ts`                                 |

### 2.3 Deviations from the FigCraft screens (to mirror back into FigCraft)

| Screen        | Design                                              | Phase 3                                                                                                       | Why                                                                                                                       |
| ------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Einstellungen | "Dunkelmodus" toggle                                | Row "Darstellung" with a three-part Segmente control: System · Hell · Dunkel                                  | A toggle has two states; the user asked for three (follow system / light / dark)                                          |
| Einstellungen | "Energieeinheit kcal >" (opens a subpage)           | Same row, Segmente control kcal · kJ inline                                                                   | Two values do not need a page; one tap instead of three                                                                   |
| Einstellungen | Konto & Sync "Synchronisiert", Online, Verbindungen | Konto & Sync "Bald verfügbar" (no chevron, not a link); Online and Verbindungen sections hidden               | Phase 4 / 6 features                                                                                                      |
| Einstellungen | –                                                   | New rows: "Speicher" status (§9.4), "Über ascend & Datenschutz" (→ `#/settings/about`)                        | Required by scope (about, privacy) and by the persist() decision                                                          |
| Ziele         | "Statistiken · Serie 12 Tage" row                   | Not shown                                                                                                     | Phase 5                                                                                                                   |
| Hinzufügen    | "Suchen" button searches Open Food Facts            | Search runs on local foods only; below the list a Hinweis: "Die Online-Suche kommt in einem späteren Update." | Phase 4                                                                                                                   |
| Hinzufügen    | Scannen tab with camera                             | Hinweis "Scannen kommt in einem späteren Update." + link to Manuell                                           | Phase 4                                                                                                                   |
| Desktop nav   | Woche, Statistiken, Geräte                          | Only Heute, Hinzufügen, Ziele, Einstellungen (the week is already on the dashboard)                           | Phases 5/6                                                                                                                |
| Desktop chart | Today's bar in mint without outline                 | Mint bar with a 1 px `--accent` outline                                                                       | WCAG 1.4.11: mint on paper is ~1.4:1; graphics need 3:1                                                                   |
| Dark theme    | `status/warning` = `#ECEAE3` (same as text)         | Kept, but "über Ziel" is never shown by colour alone (text label, table, ring caption)                        | In dark mode the warning colour equals the text colour; designer should check whether over-goal bars stay distinguishable |

## 3. Data model changes (still Dexie schema version 1)

Phase 2 (§6.7 rule 2): unindexed fields need no new schema version. The app
has never been deployed, so no real user data exists in the old shape.

### D1 – Meal of an entry

| Option                                                                        | Notes                                                                                   |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **A. Unindexed field `meal: 'breakfast' \| 'lunch' \| 'dinner' \| 'snacks'`** | Fixed list matches the design; grouping a day happens in memory (a day has ~10 entries) |
| B. User-defined meals (own table)                                             | Flexible, but a new table, names to sync, more UI                                       |
| C. Derive the meal from `loggedAt`                                            | No field, but logging lunch at 16:00 would land in snacks                               |

**Recommendation: A.** English identifiers, German labels via i18n
(`meal.breakfast` → "Frühstück").

### D2 – Required or optional new fields

| Option                                                                                                     | Notes                                                                     |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **A. `meal` and `loggedTzOffset` required in the type**; the backup validator rejects entries without them | Simple reading code; no real old data exists; no `?? 'snacks'` everywhere |
| B. Optional, with fallbacks when reading                                                                   | Needed only if old data existed                                           |

**Recommendation: A.** If a later format change needs it, the backup
migration function (Phase 2 §6.7 rule 3) fills defaults.

### 3.1 Updated types (`src/db/types.ts`)

```ts
export type Meal = "breakfast" | "lunch" | "dinner" | "snacks";

export interface Entry {
  id: string;
  date: LocalDate;
  loggedAt: string; // ISO UTC instant
  /** Minutes from Date#getTimezoneOffset() at logging time (e.g. -120 in
   *  German summer time). For "when do you log" insights (Phase 5). */
  loggedTzOffset: number;
  foodId?: string;
  snapshot: EntrySnapshot; // unchanged: copy of name, brand, unit, per100
  amount: number;
  portionLabel?: string;
  meal: Meal; // new
  updatedAt: string;
}

export interface SettingsMap {
  energyUnit: "kcal" | "kJ";
  theme: "system" | "light" | "dark"; // new, default "system"
  goalsIntroDismissed: boolean; // new, default false ("Ohne Ziel loslegen")
}
```

`Food`, `Goal`, `Portion`, `EntrySnapshot` stay as they are. Editing an entry
changes only `amount`, `portionLabel`, `meal` and `updatedAt` – **never the
snapshot** (history stays as logged). Editing a food never touches entries.
`loggedAt` and `loggedTzOffset` are set once, at creation.

Notes:

- `loggedTzOffset` comes from `new Date().getTimezoneOffset()` at the same
  moment as `loggedAt`. Stored, never displayed in Phase 3.
- `goalsIntroDismissed` is a display preference, not a goal: it only hides
  the "Noch keine Ziele" screen.
- Goals are entered in the user's energy unit, but always stored in kcal
  (kJ ÷ 4.184), like nutrient values.

### 3.2 Validation limits (`src/domain/limits.ts`)

One table of limits, used by forms **and** by the backup import:

| Value                 | Allowed                     |
| --------------------- | --------------------------- |
| Food name             | 1–100 characters after trim |
| Brand, portion label  | 0–100 characters            |
| Barcode (import only) | 8–14 digits                 |
| `per100.kcal`         | 0–1000                      |
| `per100` grams (each) | 0–100                       |
| Entry `amount` (form) | > 0 and ≤ 10 000            |
| Goal `kcal`           | 1–20 000                    |
| Goal grams (each)     | 1–2 000                     |
| `loggedTzOffset`      | integer, −840 … 720         |

Plausibility checks (e.g. protein + carbs + fat ≤ 100 g) come with Phase 4.

## 4. Data layer

### 4.1 The write boundary (`src/db/write.ts`)

From `account-and-sync.md` §4.5 option A: one small module through which
**every** write goes. Phase 6 adds the outbox row inside the same
transaction; no feature changes then.

```ts
export type TableName = "foods" | "entries" | "goals" | "settings";
interface RecordByTable {
  foods: Food;
  entries: Entry;
  goals: Goal;
  settings: SettingRow;
}
interface KeyByTable {
  foods: string;
  entries: string;
  goals: LocalDate;
  settings: SettingKey;
}

/** Insert or overwrite one record. */
export function saveRecord<T extends TableName>(table: T, record: RecordByTable[T]): Promise<void>;
/** Delete one record by primary key (no error if it does not exist). */
export function deleteRecord<T extends TableName>(table: T, key: KeyByTable[T]): Promise<void>;
/** Save many records of several tables in ONE transaction (backup import). */
export function saveRecords(
  batch: Partial<{ [T in TableName]: RecordByTable[T][] }>,
): Promise<void>;
/** Called after every successful write (after the transaction commits). */
export function onDataChanged(listener: (tables: readonly TableName[]) => void): () => void;
```

A plain `switch (table)` inside is fine; no clever generics.

### D3 – How is the boundary enforced?

| Option                                                                                                                                                                           | Notes                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **A. ESLint `no-restricted-imports`: `src/db/db` may only be imported inside `src/db/`; plus a unit test that scans `src/db/*.ts` (except `write.ts`, `db.ts`) for write calls** | Features cannot even reach the tables; the test catches writes inside the data layer. Plain rules, easy to read |
| B. ESLint `no-restricted-syntax` on `.put/.add/.delete` calls everywhere                                                                                                         | False alarms on `Map.delete`, `Set.add`                                                                         |
| C. Dexie hooks / middleware                                                                                                                                                      | "Magic" (rejected in account-and-sync §4.5)                                                                     |

**Recommendation: A.** The scan test uses
`import.meta.glob('../../src/db/*.ts', { query: '?raw', eager: true })` (no
`node:fs`) and fails on `/\.(add|put|bulkAdd|bulkPut|update|delete|bulkDelete|clear|modify)\(/`.
Tests in `tests/` may still write to `db` directly for setup.

### D4 – How do screens notice changes?

| Option                                                                                                                    | Notes                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **A. `onDataChanged` from `write.ts`; the router re-renders the current page if it asked for it (`refreshOnDataChange`)** | Explicit, ~20 lines; one place                                                          |
| B. Dexie `liveQuery` per page                                                                                             | Also sees other tabs; but subscriptions must be cleaned up per page – easy to leak      |
| C. Every action re-renders by hand                                                                                        | Easy to forget (e.g. delete from the sheet, import in settings while dashboard is open) |

**Recommendation: A.** Other tabs: the router also re-renders such pages on
`visibilitychange` → visible, which covers "edited on the desktop in a
second tab".

### 4.2 Data modules (all reads; writes via `write.ts`)

| Module                | Functions                                                                                                                                                                                                                                                                                                                                                        |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/db/entries.ts`   | `logFood(food, { amount, date, meal, portionLabel? }): Promise<Entry>` (sets `loggedAt`, `loggedTzOffset`, snapshot copy); `updateEntry(id, { amount?, meal?, portionLabel?: string \| null }): Promise<Entry>` (`null` removes the label); `deleteEntry(id)`; `getEntry(id)`; `entriesOn(date)`; `entriesBetween(from, to)` (inclusive, `date` index `between`) |
| `src/db/foods.ts`     | `createFood(input: FoodInput): Promise<Food>`; `updateFood(id, input)`; `deleteFood(id)`; `getFood(id)`; `allFoods()` (sorted by name, `localeCompare(…, 'de')`)                                                                                                                                                                                                 |
| `src/db/goals.ts`     | `allGoals()`; `goalsOn(date)` (`where('validFrom').belowOrEqual(date).last()`); `saveGoals(validFrom, values: GoalValues)` (overwrites the row of that day; an all-empty set is stored too and means "no goals from this day on")                                                                                                                                |
| `src/db/settings.ts`  | unchanged API; `setSetting` now uses `saveRecord`; validators for the two new keys                                                                                                                                                                                                                                                                               |
| `src/db/backup.ts`    | `readAllForBackup(): Promise<BackupData>`; `importBackup(data: BackupData): Promise<ImportResult>` (§8)                                                                                                                                                                                                                                                          |
| `src/db/lifecycle.ts` | `watchDatabaseLifecycle(onNeedsReload: (reason: 'versionchange' \| 'blocked') => void)` (§9.2)                                                                                                                                                                                                                                                                   |

`FoodInput = { name; unit; per100; portions?; brand? }` – `id`, `source:
'manual'`, `createdAt`, `updatedAt` are filled in by `createFood`.

The existing `logFood(food, amount, date)` changes to the object form; its
Phase 2 tests are updated, not deleted.

### 4.3 Pure domain functions (`src/domain/`)

No database, no DOM: easy to test.

| Module             | Contents                                                                                                                                                                                                                                                                                                                                             |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `meals.ts`         | `MEALS` (display order), `isMeal()`, `defaultMealAt(d: Date): Meal` (local hour: 4–10 breakfast, 11–14 lunch, 17–21 dinner, otherwise snacks)                                                                                                                                                                                                        |
| `day-summary.ts`   | `summarizeDay(entries): DaySummary` → `{ total: Nutrients; incomplete: { protein, carbs, fat: boolean }; meals: { meal; entries; kcal }[] }` (every meal present, also empty ones); `compareToGoal(eaten, goal?): { kind: 'none' } \| { kind: 'under'; remaining; ratio } \| { kind: 'over'; over; ratio }`                                          |
| `goals.ts`         | `goalOn(goals: Goal[], day): Goal \| undefined` (newest `validFrom ≤ day`), `GoalValues` type                                                                                                                                                                                                                                                        |
| `week.ts`          | `summarizeWeek(entries, goals, today): WeekSummary` → 7 days (today−6 … today) with kcal, goal of that day, over/under; average over **completed days with ≥ 1 entry** (today excluded, matches "Ø pro Tag (6 volle Tage)"); "x von y Tagen über dem Ziel" (only days with a kcal goal); average macro grams and energy shares with 4/4/9 kcal per g |
| `energy.ts`        | `toKcal(value, unit)`, `fromKcal(kcal, unit)` (uses `KJ_PER_KCAL`)                                                                                                                                                                                                                                                                                   |
| `search.ts`        | `normalizeForSearch(s)` (`toLocaleLowerCase('de')`, NFD, remove combining marks, so "Muesli" ≠ but "müsli" = "Müsli"); `matchFoods(foods, query)` (substring in name or brand; empty query → all)                                                                                                                                                    |
| `limits.ts`        | §3.2                                                                                                                                                                                                                                                                                                                                                 |
| `backup-format.ts` | `buildBackup(data, now)`, `parseBackup(text): ParseResult` (§8)                                                                                                                                                                                                                                                                                      |

Incomplete values: totals add **known** values only; `incomplete.protein` is
true if any entry of the day has no protein value. The bar then shows the
caption "unvollständig" instead of silently pretending the sum is complete.

## 5. App frame: router, pages, shell

### D5 – Routes with parameters

| Option                                                                                                                   | Notes                                         |
| ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| **A. Extend `routes.ts` with simple patterns (`#/food/:id`) and `?query`; a pure `parseHash(hash) → { route, params }`** | ~40 lines, fully unit-testable, no dependency |
| B. A router library                                                                                                      | Dependency for very little                    |
| C. Keep IDs in memory instead of the URL                                                                                 | Back button and reload break                  |

**Recommendation: A.** Route table:

```ts
interface Route {
  id: "today" | "add" | "food" | "food-edit" | "entry" | "goals" | "settings" | "about";
  pattern: string; // "#/food/:id"
  navId: "today" | "add" | "goals" | "settings"; // which nav link is active
  load: () => Promise<{ default: PageLoader }>; // lazy import (smaller first load)
}
```

`#/add` redirects to `#/add/search`; unknown hashes go to `#/today` (Phase 2
behaviour). Parameters are validated by the page (`isMeal`, existing id);
an unknown id shows a small "Nicht gefunden" text with a link back.

Lazy `import()` keeps the start fast; all chunks are precached by the service
worker, so lazy pages still work offline. A chunk that fails to load after an
update triggers the update toast (§9.1).

### 5.1 Page contract (`src/app/page.ts`)

```ts
export interface PageContext {
  params: Readonly<Record<string, string>>; // from the pattern and the query
  /** Aborted when the user leaves the page: remove listeners, cancel timers. */
  signal: AbortSignal;
}
export interface Page {
  title: string; // <h1>, document.title
  subtitle?: string; // "Dienstag, 20. Oktober", "Zu Frühstück"
  back?: { href: string; label: string }; // Kopfzeile with back link ("‹ Suche")
  content: Node;
  refreshOnDataChange?: boolean; // §4.1 D4
  refreshOnDayChange?: boolean; // §9.3
}
export type PageLoader = (ctx: PageContext) => Promise<Page>;
```

A refresh re-runs the loader and swaps `content` **without** moving focus. If
the focused element disappears, the page decides where focus goes (e.g. after
a delete: the meal heading).

### 5.2 Shell (Kopfzeile, Tableiste, desktop navigation)

- Page header: **not sticky** (iOS large-title style as in the screens).
  Large title in `--font-display` (Times, Title 28), subtitle in Caption.
  With `back`: a back link (`Icon_Zurueck` + label, `--accent`) on the left
  and the title centred in Heading 15 (Kopfzeile variant 2). `<h1>` stays the
  focus target after navigation.
- Tab bar (phone): four links with icon above label (Icon_Heute, Icon_Plus,
  Icon_Ziel, Icon_Einstellungen), active = `--accent` + semibold, never colour
  alone. Fixed at the bottom with safe-area padding (as today).
- Desktop (≥ 60rem): left column with the wordmark ("a" in Times + "ascend"),
  then the navigation entries with icons (Navigationseintrag; active = chrome
  background).
- A live region for toasts (`role="status"`) lives in the shell.

### D6 – Icons

| Option                                                                                                                    | Colour follows theme               | CSP  | Readability                                |
| ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ---- | ------------------------------------------ |
| **A. `src/ui/icons.ts`: path data per icon, built with `createElementNS`, `aria-hidden="true"`, `stroke="currentColor"`** | Yes                                | Fine | High                                       |
| B. SVG files in `public/` via `<img>`                                                                                     | No (`currentColor` does not apply) | Fine | High                                       |
| C. SVG sprite + `<use href>`                                                                                              | Yes                                | Fine | Medium (Safari quirks with external `use`) |

**Recommendation: A.** The path data must come from FigCraft as **SVG**
(the current exports are PNG). Prerequisite task for the main session (P0):
export the 17 needed icons (Heute, Plus, Ziel, Einstellungen, Suche, Scan,
Stift, Zurueck, Weiter, Offline, Check, Schliessen, Info, Export, Import,
Woche, Schloss) as SVG into `design/figcraft/export/icons/`. Icon-only
buttons get an `aria-label`.

### D7 – Overlays (Sheet · Eintrag, Dialog · Löschen)

| Option                                            | Notes                                                                                       |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **A. Native `<dialog>` with `showModal()`**       | Focus trap, Escape, inert background and focus return built in; Safari 15.4+ (we need 16.4) |
| B. Own `div role="dialog"` with manual focus trap | More code, easy to get wrong                                                                |
| C. `popover` attribute                            | Safari 17+ – excluded by our target                                                         |

**Recommendation: A.** `src/ui/dialog.ts`:

```ts
openActionSheet(opts: { title: string; subtitle?: string;
  actions: { label: string; danger?: boolean; onSelect: () => void }[] }): void; // "Abbrechen" added automatically
confirmDialog(opts: { title: string; message: string; confirmLabel: string;
  danger?: boolean }): Promise<boolean>;
```

The sheet is a `<dialog>` styled at the bottom with `--radius-window` top
corners; the grab handle is decorative (`aria-hidden`). Tapping the backdrop
closes it. `aria-labelledby` → title. Animations respect
`prefers-reduced-motion` (already global).

### 5.3 Toast (`src/ui/toast.ts`)

```ts
showToast(message: string, opts?: { action?: { label: string; onClick: () => void } }): void;
```

Without action: disappears after 4 s. With action (update prompt): stays
until used or closed (close button, `aria-label="Schließen"`), because an
auto-hiding button cannot be reached reliably with a screen reader.

### 5.4 Forms

- `numberField({ id, label, unit, value?, required, min, max })` returns
  `{ element, input, read(): { ok: true; value: number | null } | { ok: false; message: string } }`.
  `<input type="text" inputmode="decimal" autocomplete="off">`, unit as
  visible suffix (inside the field, as in Zahlenfeld) and in the accessible
  name via `aria-describedby`; parsing with `parseDecimal`; errors shown under
  the field (`aria-invalid="true"`, message linked with `aria-describedby`,
  `--status-danger` border **and** text). Validation on submit and on blur,
  never while typing.
- Placeholder "–" for empty number fields (as in the design), never a
  default value.
- Chips (portion, meal) and Segmente (settings) are **radio groups**:
  `<fieldset><legend>` + visually styled `<input type="radio">` + `<label>`.
  Arrow keys work natively, screen readers announce "1 von 4".
- The Hinzufügen tabs (Suche/Scannen/Manuell) are **links** with
  `aria-current="page"` (they change the URL), styled as Segmente.

## 6. Screens

### 6.1 Heute (`#/today`, P4)

Data per render: `entriesOn(today)`, `goalsOn(today)`, settings.

States, in this order:

1. **No goals ever, intro not dismissed, no entries today** → Leerzustand
   "Noch keine Ziele" (`Heute _ ohne Ziel.png`): button "Ziele festlegen"
   (→ `#/goals`), text button "Ohne Ziel loslegen" (saves
   `goalsIntroDismissed = true`, re-renders).
2. Otherwise: **ring + bars**, then
   - entries today → meal groups;
   - no entries → Leerzustand "Noch nichts eingetragen", button
     "Lebensmittel hinzufügen" (→ `#/add/search?meal=<defaultMealAt(now)>`).

Ring (`day-ring.ts`, SVG): `circle` track + progress arc using
`pathLength="100"` and the `stroke-dasharray` **attribute** (never a `style`
attribute: the CSP blocks those; `element.style.x` from script is allowed).
Centre: Number/Large total, "von 2.000 kcal", then "1.007 übrig"
(`--accent`) or "240 über Ziel" (`--status-warning`, ring stroke warning,
full circle). Without kcal goal: grey track only, "kcal heute",
"Kein Ziel gesetzt". The SVG is `aria-hidden`; a visually hidden sentence
carries the meaning ("993 von 2.000 kcal, 1.007 übrig").

Nutrient bars (`nutrient-bar.ts`): label, "52 / 110 g" and a bar. Not
`<meter>` (hard to style consistently in Safari): a plain `div` bar
(`aria-hidden`) plus the visible text, which already says everything.
Over goal: bar full in warning colour + "über Ziel" text. No goal: "53 g" and
"Kein Ziel gesetzt". Incomplete: caption "unvollständig".

Meal groups (`meal-group.ts`): `<section>` with `<h2>` containing a
`<button aria-expanded aria-controls>` (chevron + meal name), kcal of the
meal, and an icon button "+" (`aria-label="Zu Frühstück hinzufügen"` →
`#/add/search?meal=breakfast`). All four meals always shown (Abendessen
"0 kcal" as in the design). Collapsed state is kept in memory for the
session only.

Entry row (Eintrag): name, sub line `portionLabel · amount` or `amount`,
energy on the right. The whole row is a `<button>` that opens the action
sheet "Skyr Natur · Frühstück · 150 g · 95 kcal": Bearbeiten (→
`#/entry/<id>`), Löschen (→ `confirmDialog` "Eintrag löschen?" /
„„Skyr Natur" wird aus Frühstück entfernt." → `deleteEntry`, toast
"Eintrag gelöscht", focus to the meal heading), Abbrechen.

Energy everywhere through `formatEnergy(value, energyUnit)`.

### 6.2 Hinzufügen (`#/add/*`, P5)

Header: title "Hinzufügen", subtitle "Zu Frühstück" (meal from `?meal=`,
else `defaultMealAt(now)`). Segmente links keep `?meal=`.

- **Suche** (`#/add/search`): Suchfeld (`type="search"`,
  `enterkeyhint="search"`) + button "Suchen". Local foods are filtered **as
  you type** (no network, so allowed by rule 3); the button and Enter do the
  same. Heading "Auf diesem Gerät · n Treffer"; rows: name, brand, "63 kcal /
  pro 100 g", chevron → `#/food/<id>?meal=…`. Empty query: all own foods.
  No own foods: Leerzustand "Noch keine eigenen Lebensmittel" + link to
  Manuell. Under the list: Hinweis (Info) "Die Online-Suche kommt in einem
  späteren Update." In Phase 4 the button starts the OFF request.
- **Scannen** (`#/add/scan`): Hinweis "Scannen kommt in einem späteren
  Update." and a link "Manuell eingeben".
- **Manuell** (`#/add/manual`): as `Hinzufügen _ Manuell.png`: Name (hint
  "Wird nur auf diesem Gerät gespeichert."), heading "Nährwerte pro 100 g",
  Energie (required), Eiweiß, Kohlenhydrate, Fett (optional, empty =
  unknown, see open question 5). The energy field's unit suffix is a small
  toggle button "kcal ⇄ kJ" (default = energy-unit setting), so the hint
  "Kein kcal-Wert auf der Packung? Gib kJ ein – ascend rechnet mit
  4,184 kJ = 1 kcal" is actionable. "Speichern" → `createFood` → navigate to
  `#/food/<newId>?meal=…` (Portion page) with focus on the amount field.
- **Lebensmittel bearbeiten** (`#/food/<id>/edit`): same form, prefilled,
  "Speichern" + danger text button "Lebensmittel löschen" (confirm dialog:
  "Frühere Einträge bleiben unverändert."). Reached from the pencil icon
  button in the Portion header (`aria-label="Lebensmittel bearbeiten"`).

### D8 – kJ input in the manual form

| Option                                             | Notes                                       |
| -------------------------------------------------- | ------------------------------------------- |
| **A. Unit toggle as the field's suffix (kcal/kJ)** | Matches the hint text; one field            |
| B. Second field "kJ"                               | Two fields that can disagree                |
| C. Parse "1046 kJ" typed into the field            | Hidden feature; `parseDecimal` stays strict |

**Recommendation: A.**

### 6.3 Portion (`#/food/<id>`, `#/entry/<id>`, P5)

As `Lebensmittel _ Portion.png`: back link ("‹ Suche" or "‹ Heute" for
edit), centred title "Portion", food name in Title style, sub line
"Marke · 63 kcal pro 100 g".

- Portion chips: "100 g" + `food.portions` ("1 Becher (150 g)"); choosing a
  chip fills Menge; typing in Menge selects the matching chip or none.
- Menge: number field with unit `g`/`ml`; required, > 0.
- Mahlzeit chips: four meals, preselected from `?meal=` / the entry.
- Live preview: Energie (large), Eiweiß, Kohlenhydrate, Fett for the amount
  (`nutrientsForAmount`), "–" for unknown values. `aria-live="polite"` only
  on the energy line (not on every keystroke for all four rows).
- Primary button "Zu Frühstück hinzufügen" (label follows the meal) →
  `logFood` → `#/today`, toast "Skyr Natur hinzugefügt".
- Edit mode (`#/entry/<id>`): values from the entry **snapshot** (not the
  food, which may have changed or been deleted); chips from the food if it
  still exists, else only "100 g"; button "Änderungen speichern" →
  `updateEntry`. No pencil icon in edit mode.
- Quellenhinweis only when `source === 'off'` (Phase 4).

### 6.4 Ziele (`#/goals`, P6)

As `Ziele.png`: subtitle "Noch nicht festgelegt" or "Gilt seit 20. Oktober"
(`validFrom` of the current set). Intro text from the design. Energie
(in the user's unit) with −500 / −50 / +50 / +500 buttons; Eiweiß,
Kohlenhydrate, Fett with − / + (step 5 g).

### D9 – Step buttons when the field is empty

| Option                                   | Notes                                                          |
| ---------------------------------------- | -------------------------------------------------------------- |
| **A. Disabled while the field is empty** | No value is ever invented; the "no presets" rule stays obvious |
| B. Start from 0                          | +50 → 50 kcal: technically not a preset, but suggests one      |

**Recommendation: A.** Steps never go below the minimum (§3.2).

Saving: "Ziele speichern" is disabled until something changed. It stores one
row with `validFrom = today` (overwrites today's row). Emptying a field and
saving means "no goal for this value from today on". Hint text below:
"Du kannst Ziele jederzeit ändern. Frühere Tage behalten ihre Werte."
After saving: toast "Ziele gespeichert", stay on the page.

### 6.5 Einstellungen (`#/settings`, `#/settings/about`, P7)

Subtitle "ascend 0.1" (version from `package.json`, injected at build time
with Vite `define: { __APP_VERSION__ }`; `package.json` version becomes
`0.1.0`). Sections:

| Section   | Row                                                                         | Behaviour                                     |
| --------- | --------------------------------------------------------------------------- | --------------------------------------------- |
| Konto     | Konto & Sync – "Bald verfügbar"                                             | Plain text row, no link, no chevron           |
| Allgemein | Sprache – "Deutsch"                                                         | Plain text row (only language)                |
|           | Energieeinheit – Segmente kcal · kJ                                         | `setSetting('energyUnit')`                    |
|           | Darstellung – Segmente System · Hell · Dunkel                               | `setSetting('theme')`, applied at once (§9.5) |
| Daten     | Daten exportieren (JSON)                                                    | §8.1                                          |
|           | Daten importieren                                                           | §8.2                                          |
|           | Speicher – "Dauerhaft" / "Kann vom Browser gelöscht werden"                 | §9.4; read-only status                        |
|           | Hint "Alle Daten bleiben auf diesem Gerät. Ein Export ist deine Sicherung." |                                               |
| Info      | Über ascend & Datenschutz →                                                 | `#/settings/about`                            |

About page (German UI text, drafts; final wording by `docs-writer`), aligned
with the updated privacy rules (`account-and-sync.md` §9):

- "ascend speichert alles nur auf diesem Gerät. Es gibt keine Analyse, keine
  Werbung und keine Absturzberichte."
- "ascend stellt Verbindungen nur her, wenn du es auslöst. In dieser Version
  gibt es keine Online-Funktionen."
- "Ein Konto wird später optional sein – ohne E-Mail, mit Ende-zu-Ende-
  Verschlüsselung. ascend funktioniert immer auch ohne Konto."
- "Deine Sicherung ist die JSON-Datei aus „Daten exportieren“. Bewahre sie
  an einem sicheren Ort auf."
- Version, licence "Open Source (MPL-2.0)". No external links in Phase 3
  (a link to the repository only once it is public).

### 6.6 Desktop dashboard (`#/today` ≥ 60rem, P8)

As `Desktop _ Dashboard.png`. The Heute page renders its content into a
two-column layout; the right column is `renderWeekPanel(ctx)` from
`src/features/dashboard/week-panel.ts`, rendered only when
`matchMedia('(min-width: 60rem)')` matches (listener re-renders on change).
Between 60rem and 75rem the week panel goes **below** today (not enough room
for three columns at 960 px); from 75rem it sits on the right.

- Title "Diese Woche", subtitle "Mittwoch, 14. – Dienstag, 20. Oktober ·
  Energie in kcal" (unit follows the setting).
- Bar chart (`week-chart.ts`, SVG): 7 bars; y-axis to a rounded maximum of
  max(values, goal) × 1.1 with 2–3 gridlines (0, 1.000, 2.000); dashed goal
  line "Ziel 2.000" for **today's** goal; bar colours: normal `--accent`,
  over that day's goal `--status-warning`, today `--accent-soft` with
  outline; value labels in or above the bars; x labels "Mi 14." (today in
  semibold). Each bar has a `<title>` (Tooltip on hover).
- Accessibility: the SVG is `role="img"` with an `aria-label` summary; the
  same data is in a visually hidden `<table>` (Tag, Energie, Ziel,
  Status "über Ziel" / "im Ziel" / "kein Ziel").
- Key figures: "1.958 kcal / Ø pro Tag (6 volle Tage)", "3 von 6 / Tagen
  über dem Ziel" (hidden if no kcal goal), "2.000 kcal / Tagesziel, selbst
  gesetzt" (or "Kein Ziel gesetzt"). Plurals through `Intl.PluralRules`
  (§10).
- Macro distribution: one horizontal stacked bar (Eiweiß teal, Kohlenhydrate
  mint, Fett graphite) with legend "Eiweiß 98 g · 20 %"; footnote "Anteil an
  der Energie: Eiweiß und Kohlenhydrate 4 kcal/g, Fett 9 kcal/g." Legend text
  carries the values; colour is not the only cue.
- No completed days yet: "Noch keine vollständigen Tage diese Woche."
- Data: `entriesBetween(today−6, today)`, `allGoals()`; computed with
  `summarizeWeek`. Only local data.

## 7. Theme and typography

### 7.1 Theme variables (from page-Foundations.png)

The FigCraft "Theme" collection defines more semantic variables than
`tokens.json` has today, and `bg/app` is **paper** (`#F6F5F0`), while the
current CSS uses surface (`#FBFAF7`) as page background. Phase 3 switches the
CSS to the FigCraft names (one vocabulary for designer and code):

| CSS variable               | Light     | Dark      |
| -------------------------- | --------- | --------- |
| `--bg-app`                 | `#F6F5F0` | `#141818` |
| `--bg-surface`             | `#FBFAF7` | `#1B2020` |
| `--bg-chrome`              | `#EFEDE6` | `#0F1212` |
| `--bg-field`               | `#FFFFFF` | `#0F1212` |
| `--line-rule`              | `#DEDCD3` | `#2C3333` |
| `--line-soft`              | `#EAE8E1` | `#2C3333` |
| `--text`                   | `#151A1B` | `#ECEAE3` |
| `--text-muted`             | `#5A6264` | `#A3ABAB` |
| `--text-disabled`          | `#B9B7AE` | `#5A6264` |
| `--text-inverse`           | `#F6F5F0` | `#141818` |
| `--accent`                 | `#1E5C5E` | `#A8DCD2` |
| `--accent-on`              | `#FBFAF7` | `#151A1B` |
| `--accent-soft`            | `#A8DCD2` | `#1E5C5E` |
| `--status-warning`         | `#8A5A12` | `#ECEAE3` |
| `--status-danger`          | `#A33A35` | `#ECEAE3` |
| `--button-primary`         | `#151A1B` | `#ECEAE3` |
| `--button-primary-pressed` | `#5A6264` | `#A3ABAB` |
| `--focus-ring`             | = accent  | = accent  |

(`camera` is Phase 4.) The old names (`--bg`, `--nav-bg`, …) are removed in
the same commit; `tokens.test.ts` follows the new `tokens.json` keys (§15).

### D10 – Applying light/dark/system

| Option                                                                                                                                                                                        | Notes                                                                           |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **A. `data-theme="light" \| "dark"` on `<html>` only when the user chose one; CSS: `:root[data-theme="dark"]` and `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }`** | Pure CSS for "system"; one attribute for overrides; `color-scheme` set to match |
| B. JavaScript always decides and sets the attribute                                                                                                                                           | Needs a `matchMedia` listener for "system"                                      |
| C. Two stylesheets                                                                                                                                                                            | Duplication                                                                     |

**Recommendation: A.** `src/app/theme.ts` sets the attribute and updates the
two `<meta name="theme-color">` tags. The setting is read after `db.open()`
and **before** the shell is mounted, so there is no visible flash (only
`body` background is shown earlier; it uses `--bg-app` of the system theme).
No `localStorage` copy (second storage system, rejected in Phase 2 D9).

### 7.2 Typography

FigCraft text styles (page-Foundations.png): Display 48 Times, Title 28
Times, Heading 15 SF Semibold, **Mobile/Body 15**, **Mobile/Label 13
Medium**, Body 13 (desktop), Caption 12, Mono 12 Menlo, Number/Large,
Number/Medium (SF, tabular). CSS (`tokens.css`) uses them like this:

| CSS variable            | Phone                         | ≥ 60rem |
| ----------------------- | ----------------------------- | ------- |
| `--font-size-display`   | 48                            | 48      |
| `--font-size-title`     | 28                            | 28      |
| `--font-size-heading`   | 15                            | 15      |
| `--font-size-body`      | 15                            | 13      |
| `--font-size-label`     | 13                            | 13      |
| `--font-size-caption`   | 12                            | 12      |
| `--font-size-number-lg` | from FigCraft (Number/Large)  |         |
| `--font-size-number-md` | from FigCraft (Number/Medium) |         |
| `--font-size-input`     | **16** (see open question 1)  | 16      |

All in `rem` (px / 16) so the iOS text-size setting still scales. The exact
Number/Large and Number/Medium sizes are read from the FigCraft file by the
main session (FigCraft MCP), not guessed from PNGs (visual estimate: ring
number ≈ 32, list values ≈ 15–17).

## 8. JSON backup

### 8.1 Export

Format (Phase 2 §6.8, unchanged idea):

```json
{
  "app": "ascend",
  "format": 1,
  "schemaVersion": 1,
  "exportedAt": "2026-10-20T18:00:00.000Z",
  "foods": [],
  "entries": [],
  "goals": [],
  "settings": []
}
```

`JSON.stringify(data, null, 2)` (readable), file name
`ascend-backup-2026-10-20.json` (local date). Never contains anything else
(no `syncState`/`outbox` later, account-and-sync §5.4).

### D11 – How the file reaches the user

| Option                                                                                   | Notes                                                                                                                       |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| A. `<a download>` with a `blob:` URL                                                     | Works on desktop; in the iPhone **home-screen app** downloads have been unreliable **(verify on device)**                   |
| **B. `navigator.share({ files })` when `navigator.canShare({ files })` is true, else A** | iOS share sheet: "In Dateien sichern", AirDrop, mail – all chosen by the user. Desktop Chrome/Firefox fall back to download |
| C. Show the JSON in a text area to copy                                                  | Works everywhere, but clumsy for large files                                                                                |

**Recommendation: B.** Both paths create the file locally; nothing is sent
unless the user picks a target in the share sheet. A cancelled share
(`AbortError`) is not an error.

### 8.2 Import

Flow: "Daten importieren" → hidden `<input type="file" accept=".json,application/json">`
→ checks → confirm dialog with counts ("12 Lebensmittel, 340 Einträge,
2 Zielsätze, 2 Einstellungen werden übernommen.") → `importBackup` → toast
"Import abgeschlossen".

Checks, in order (all in `src/domain/backup-format.ts`, pure):

1. **Size**: `file.size ≤ 20 MB` before reading (years of entries are a
   few MB).
2. `JSON.parse` in `try/catch`, with a reviver that **rejects** the keys
   `__proto__`, `constructor`, `prototype` anywhere (defence in depth).
3. Top level: plain object, `app === 'ascend'`, `format === 1`,
   `schemaVersion` integer ≤ current; arrays for the four tables.
4. **Counts**: ≤ 50 000 foods, ≤ 500 000 entries, ≤ 10 000 goals,
   ≤ 100 settings.
5. **Every record rebuilt field by field** from an allowlist into a fresh
   object literal (unknown keys dropped, never `Object.assign`/spread of
   input objects): types, `isLocalDate`, ISO timestamps
   (`/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/` + `Date.parse`),
   UUID shape for ids, enums (`unit`, `source`, `meal`, setting values),
   number limits (§3.2), string lengths. `NaN`/`Infinity` cannot come from
   JSON; `null` for optional numbers is treated as "unknown" (field left
   out).
6. Duplicate primary keys inside the file → error.
7. Unknown setting keys are dropped (not an error); invalid values of known
   keys → error.

Any failure: nothing is written; a German message per error code
(`backup.error.tooLarge`, `.notJson`, `.notAscend`, `.newerVersion`,
`.invalidRecord` with table name and position). Then
`saveRecords(...)` writes everything in **one transaction**
(all-or-nothing).

### D12 – Import mode

| Option                                                                                      | Notes                                                                                                           |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **A. Merge by primary key; the record with the newer `updatedAt` wins; nothing is deleted** | Never loses data; importing the same file twice changes nothing; same rule as the later sync (last writer wins) |
| B. Replace everything (after confirmation)                                                  | Predictable "restore", but one wrong file wipes the current data                                                |
| C. Ask each time                                                                            | Extra choice the user may not understand                                                                        |

**Recommendation: A** (open question 2). For the main use case – iOS
cleared the data, restore from a backup – A and B give the same result.
Settings rows have no `updatedAt`: the file's value wins.

## 9. Phase 2 deferred items

### 9.1 Service worker updates

| Option                                                                                  | Notes                                                                                           |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| A. Keep `autoUpdate` (+ skipWaiting)                                                    | A new version can take over while the user types a goal; lazy chunks of the old version may 404 |
| **B. `registerType: 'prompt'`: toast "Neue Version verfügbar" with button "Neu laden"** | User decides; standard pattern; ~30 lines                                                       |
| C. `autoUpdate`, but reload only when no form is dirty                                  | Needs "dirty" tracking in every form                                                            |

**Recommendation: B.**

- `vite.config.ts`: `registerType: 'prompt'`, `injectRegister: false`
  (we register ourselves), remove `skipWaiting`/`clientsClaim` from
  `workbox`.
- `src/app/update.ts`: `registerSW` from `virtual:pwa-register`
  (uses `workbox-window`; move it from `devDependencies` to `dependencies`,
  no new package; MIT, no network besides the app's own `sw.js`).
  `onNeedRefresh` → `showToast(t('update.available'), { action: { label:
t('update.reload'), onClick: () => updateSW(true) } })`. On
  `visibilitychange` → visible, call `registration.update()` (fetches only
  our own `sw.js`; home-screen apps otherwise check rarely).
- A failed lazy `import()` of a page shows the same toast.
- The registration code is an external module, so the CSP stays without
  inline scripts.

### 9.2 Dexie `versionchange` / `blocked`

`src/db/lifecycle.ts`, called from `main.ts` after `db.open()`:

- `db.on('versionchange', …)`: another tab opened a newer schema. Close this
  connection (`db.close()`) and show a persistent notice "ascend wurde in
  einem anderen Tab aktualisiert. Bitte lade diese Seite neu." with a reload
  button. (Dexie 4 closes automatically by default – **verify** and keep the
  explicit close for readability.)
- `db.on('blocked', …)`: our upgrade waits for an old tab. Notice "Bitte
  schließe andere ascend-Tabs, damit die Aktualisierung abgeschlossen werden
  kann."
- Test with fake-indexeddb: open a second `Dexie('ascend')` with version 2;
  the first instance reports `versionchange`.

Phase 3 itself does not bump the schema, but Phase 4/6 will.

### 9.3 "Today" after midnight

`src/app/day-watch.ts`:
`watchToday(onChange: (today: LocalDate) => void): () => void`

- Remembers `todayLocal()`; checks again on `visibilitychange` (visible),
  `pageshow` (back-forward cache) and with one `setTimeout` to the next local
  midnight (+1 s), re-armed after each check (covers the desktop dashboard
  left open overnight).
- The router re-renders pages with `refreshOnDayChange` (Heute, dashboard).
  Forms are never re-rendered (no lost input).
- Tests: Vitest fake timers + a stubbed `document.visibilityState`;
  Playwright `page.clock` at 23:59:50 → after 15 s the subtitle shows the
  next day.

### 9.4 `persist()`

- `requestPersistentStorage()` gets `try/catch` around `persisted()` and
  `persist()`; any rejection → `'not-persisted'`.
- `src/app/storage.ts` adds `requestPersistenceOnFirstSave()`: subscribes to
  `onDataChanged` once; on the first change in the session calls
  `requestPersistentStorage()` and unsubscribes. Already persisted → no
  prompt (cheap `persisted()` check). Firefox therefore asks once, right
  after the user saved something.
- Settings shows the status (`persisted()` result).

### 9.5 HTTP headers

See §11.3.

## 10. i18n

### D13 – Avoiding conflicts in `de.ts` while packages run in parallel

| Option                                                                                                                                                                        | Notes                                                                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **A. One message file per area in `src/i18n/messages/` (`common.ts`, `today.ts`, `add.ts`, `goals.ts`, `settings.ts`, `dashboard.ts`); `de.ts` spreads them into one object** | Each package owns one file; `MessageKey` stays `keyof typeof de`; duplicate keys are caught by a unit test |
| B. Everyone edits `de.ts`                                                                                                                                                     | Merge conflicts in every package                                                                           |

**Recommendation: A.** P2 creates all files (feature files as `{} as const`
with a comment), so later packages only edit their own file.

Plurals: `plural(count, { one: MessageKey; other: MessageKey })` in
`src/i18n/i18n.ts` using a cached `Intl.PluralRules('de-DE')`
(e.g. "1 voller Tag" / "6 volle Tage").

Dates: `formatWeekday(date)` → "Dienstag, 20. Oktober" (Heute subtitle) and
`formatDayShort(date)` → "Mi 14." (chart) are added to `format.ts`
(`Intl.DateTimeFormat` with `weekday`/`day`/`month`, created once).

`app.description` drops "ohne Konto": "Kalorien und Nährwerte erfassen –
offline und ohne Tracking." (account-and-sync §9.3).

## 11. Deployment to Cloudflare Pages

### D14 – How the app gets to Cloudflare

| Option                                                                                                       | Complexity                                          | Privacy / telemetry                                                                                                         | Notes                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **A. Git integration**: Cloudflare's GitHub app builds every push to `main` (`npm run build`, output `dist`) | Lowest: no tool, no token on the Mac                | No wrangler, so no CLI metrics. Cloudflare gets **read access to the private repo** (limit the GitHub app to this one repo) | Automatic deploy after every push (the user pushes every commit anyway). Works with Pages Functions + D1 later (Phase 6) |
| B. `wrangler pages deploy dist` from the Mac                                                                 | Medium: new dev dependency (large), login/API token | wrangler sends usage metrics **by default** → `send_metrics = false` in config + `WRANGLER_SEND_METRICS=false` + hook check | Cloudflare never sees the source, only the build. Deploys only when run by hand                                          |
| C. GitHub Actions + wrangler                                                                                 | Highest: workflow + API token as GitHub secret      | Same metrics issue as B                                                                                                     | Lets tests gate the deploy, but more moving parts                                                                        |

**Recommendation: A** (open question 3). It needs no new dependency, no
token, and no telemetry setting that could be forgotten. Settings in the
Pages project:

- Production branch `main`; **preview deployments: none** (otherwise every
  branch gets a public URL).
- Build command `npm run build`, output directory `dist`, root `/`.
- Node: `NODE_VERSION=24` environment variable (build image v3 also reads
  `.node-version` – **verify** that 24 is available).
- `base` stays `'/'`: the app is served at the root of
  `<project>.pages.dev`. Project name without personal data (e.g.
  `ascend-app`; the user chooses).

### 11.1 Cloudflare features that must stay off

| Feature                                                                          | Why                                                               | Where                          |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------ |
| Web Analytics (Pages "Metrics → Web Analytics")                                  | Injects a beacon script → telemetry, CSP violation                | Pages project → Metrics        |
| Zaraz                                                                            | Third-party tag manager                                           | Zone (only with custom domain) |
| Rocket Loader, Email Obfuscation, Speed Brain / prefetch hints, Cloudflare Fonts | Rewrite HTML or inject scripts → breaks the CSP, may add requests | Zone (only with custom domain) |
| Bot Fight Mode / JS challenges                                                   | Inject challenge scripts                                          | Zone                           |
| Preview deployments                                                              | Public URLs for every branch                                      | Pages → Settings → Builds      |
| Pages Functions logs / Logpush                                                   | Not used in Phase 3; stays off in Phase 6                         | –                              |

With only `*.pages.dev` (recommended for Phase 3) most zone features do not
apply. Honest limit for the README: Cloudflare, as host, sees IP addresses
and request metadata of page loads; this cannot be switched off. The app
makes no other requests.

### 11.2 Manual steps for the user (main session guides in German)

1. Create a Cloudflare account (free plan) – with an email of the user's
   choice; 2FA recommended.
2. Workers & Pages → Create → Pages → "Connect to Git" → authorise the
   Cloudflare GitHub app **for the `ascend` repository only**.
3. Project name (no real name), production branch `main`, build command,
   output directory, `NODE_VERSION` (as above).
4. Settings → Builds: preview deployments "None".
5. Metrics: confirm Web Analytics is **off**.
6. After the first deploy: open the URL on the iPhone in Safari → "Zum
   Home-Bildschirm" → flight mode → app starts.
7. Optional later: custom domain (then re-check the zone features in §11.1).

### 11.3 HTTP headers (`_headers`)

### D15 – Single source for the CSP

| Option                                                                                                                                                                                | Notes                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| A. Hand-written `public/_headers` + test comparing it with the meta CSP                                                                                                               | Two copies of the policy                                               |
| **B. `security.config.ts` (repo root) exports the CSP parts and a `headersFile()` function; `vite.config.ts` uses it for the meta tag and emits `_headers` into `dist` during build** | One source; unit-testable; root `*.config.ts` is already in `tsconfig` |

**Recommendation: B.** Generated `_headers`:

```
/*
  Content-Security-Policy: <same policy as the meta tag>; frame-ancestors 'none'
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()
  Cross-Origin-Opener-Policy: same-origin
  X-Frame-Options: DENY
/sw.js
  Cache-Control: no-cache
/manifest.webmanifest
  Cache-Control: no-cache
/index.html
  Cache-Control: no-cache
/assets/*
  Cache-Control: public, max-age=31536000, immutable
```

- `frame-ancestors` works only as a header; the meta CSP stays for
  `vite preview` and Playwright. `X-Frame-Options` covers old browsers.
- `camera=()` now; Phase 4 changes it to `camera=(self)` for the scanner.
- HSTS: `*.pages.dev` is on the browsers' HSTS preload list; add HSTS only
  with a custom domain.
- `check-dist-urls.sh` already runs on `dist`; it should ignore `_headers`
  or accept it (no URLs inside).
- After the first deploy, verify with `curl -I` (a developer-triggered
  request) that the headers arrive.

## 12. Tests

### 12.1 Unit (Vitest)

| File                                                                  | Covers                                                                                                                                                                                                         |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `write.test.ts`                                                       | each function writes; `onDataChanged` fires after commit, not on failure; `saveRecords` is all-or-nothing                                                                                                      |
| `write-boundary.test.ts`                                              | scan of `src/db/*.ts` (§4.1 D3)                                                                                                                                                                                |
| `db.test.ts` _(update)_                                               | new `logFood` form; `meal`, `loggedTzOffset` set (with `vi.spyOn(Date.prototype, 'getTimezoneOffset')`); `updateEntry` keeps snapshot and `loggedAt`; delete                                                   |
| `foods.test.ts`                                                       | create/update/delete; editing a food leaves entries unchanged                                                                                                                                                  |
| `goals.test.ts`                                                       | `goalOn` picks newest `validFrom ≤ day`; past days keep older goals; same-day save overwrites; empty set clears; table empty at start                                                                          |
| `day-summary.test.ts`                                                 | totals, unknown values → `incomplete`, all four meals present, under/over/none                                                                                                                                 |
| `week.test.ts`                                                        | 7 days incl. month boundary and DST week; averages exclude today and empty days; goal changes mid-week; macro shares                                                                                           |
| `meals.test.ts`, `search.test.ts`, `energy.test.ts`, `limits.test.ts` | as named                                                                                                                                                                                                       |
| `backup-format.test.ts`                                               | round trip; too large; not JSON; wrong `app`/`format`; newer schema; `__proto__`/`constructor` keys rejected and `Object.prototype` untouched; unknown fields dropped; invalid numbers, dates, ids; duplicates |
| `backup.test.ts`                                                      | merge rules (newer `updatedAt` wins, nothing deleted, re-import idempotent); failed import writes nothing                                                                                                      |
| `lifecycle.test.ts`                                                   | versionchange callback (§9.2)                                                                                                                                                                                  |
| `day-watch.test.ts`                                                   | midnight timer, visibilitychange, pageshow                                                                                                                                                                     |
| `storage.test.ts` _(update)_                                          | rejections → `'not-persisted'`; called once after the first write                                                                                                                                              |
| `route-parse.test.ts`                                                 | patterns, query, unknown hash                                                                                                                                                                                  |
| `i18n.test.ts` _(update)_                                             | no duplicate keys across message files; `plural`                                                                                                                                                               |
| `tokens.test.ts` _(update)_                                           | new theme keys, typography                                                                                                                                                                                     |
| `security-headers.test.ts`                                            | `_headers` contains the meta CSP + `frame-ancestors 'none'`; `sw.js` no-cache                                                                                                                                  |

### 12.2 Browser (Playwright: `iphone`, `desktop`, `offline`)

Seeding: a fixture `tests/fixtures/backup-week.json` (dates around a fixed
clock, `page.clock.setFixedTime('2026-10-20T12:00:00')`) imported through the
real Settings import – tests the import too.

| Spec                         | Projects        | Checks                                                                                                                                                                                                                                         |
| ---------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `today.spec.ts`              | iphone, desktop | intro empty state; "Ohne Ziel loslegen"; "Noch nichts eingetragen"; ring text "übrig"/"über Ziel"; collapse a meal (`aria-expanded`); "+" opens Hinzufügen with meal                                                                           |
| `log-food.spec.ts`           | iphone, desktop | Manuell (decimal comma "4,5"), kJ toggle, Speichern → Portion → add → toast → entry on Heute; local search finds it; validation errors announced                                                                                               |
| `entry.spec.ts`              | iphone, desktop | sheet opens from row, Escape closes, focus returns; Bearbeiten changes amount + meal; Löschen → dialog → gone; snapshot survives food edit                                                                                                     |
| `goals.spec.ts`              | iphone, desktop | empty fields, steppers disabled while empty; save; next day (clock) keeps old goals for yesterday                                                                                                                                              |
| `settings.spec.ts`           | iphone, desktop | kJ shows kJ everywhere; theme Dunkel/Hell/System changes `--bg-app`; export (download event on desktop) round-trips through import; bad file → message, no data change                                                                         |
| `dashboard.spec.ts`          | desktop         | 7 bars, hidden table rows match, over-goal row says "über Ziel", averages; at 1000 px width the panel is below today                                                                                                                           |
| `a11y.spec.ts`               | iphone, desktop | keyboard-only walk through every flow (Tab order, visible focus ring, no trap outside dialogs); every button has an accessible name; contrast of text tokens ≥ 4.5:1 in both themes (computed colours); axe scan if approved (open question 4) |
| `day-change.spec.ts`         | desktop         | clock 23:59:50 → subtitle changes after midnight                                                                                                                                                                                               |
| `offline.spec.ts` _(extend)_ | offline         | offline: log a food, reload, still there; lazy pages load offline                                                                                                                                                                              |
| (no `update.spec.ts`)        | –               | Serving two builds in one Playwright run is too heavy; `update.ts` is unit-tested with a stubbed `registerSW`, and the real update is checked manually on the iPhone (§18)                                                                     |
| existing specs               | all             | still green; the fixture's "no external request" rule applies to every new spec                                                                                                                                                                |

### Dependency proposal (dev only, needs approval)

| Package                               | Purpose                                                      | License | Size                                                 | Network / telemetry                                                    |
| ------------------------------------- | ------------------------------------------------------------ | ------- | ---------------------------------------------------- | ---------------------------------------------------------------------- |
| `@axe-core/playwright` (+ `axe-core`) | Automated WCAG checks (contrast, names, roles) in Playwright | MPL-2.0 | axe-core ~ 0.5 MB unpacked, test-only, never shipped | None known; runs inside the test page – `security-reviewer` to confirm |

Without it: the manual checks in `a11y.spec.ts` plus the `accesslint` MCP
audit by `ui-tester` at phase end.

No other new dependency. Not needed: chart library, router, date library,
dialog/toast library, wrangler (with D14-A).

## 13. Work packages for parallel implementers

Rules: each package owns the listed files; nobody edits another package's
files. Shared contracts are the signatures in §4, §5 and §5.3. If a package
needs a change in someone else's file, it reports it instead of editing.

### P0 – Prerequisites (main session, before any package)

- User answers to §16.
- Export icons as SVG from FigCraft to `design/figcraft/export/icons/`;
  read Number/Large, Number/Medium (and field/button height) from FigCraft.
- Apply the `tokens.json` changes (§15).

### Wave 1 (parallel, after P0)

**P1 – Data layer** (`implementer`)
Files: `src/db/types.ts`, `src/db/write.ts`, `src/db/entries.ts`,
`src/db/foods.ts`, `src/db/goals.ts`, `src/db/settings.ts`,
`src/db/backup.ts`, `src/db/lifecycle.ts`, `src/domain/meals.ts`,
`src/domain/day-summary.ts`, `src/domain/goals.ts`, `src/domain/week.ts`,
`src/domain/energy.ts`, `src/domain/search.ts`, `src/domain/limits.ts`,
`src/domain/backup-format.ts`, `eslint.config.js` (restricted import),
unit tests for all of them.
Acceptance: §4 signatures exist exactly; no import of `src/db/db` outside
`src/db/`; boundary test green; all §12.1 data/domain tests green; new
entries have `meal` and `loggedTzOffset`; goals table still empty after any
test that does not set goals.

**P2 – Frame and UI kit** (`implementer`)
Files: `src/app/routes.ts`, `src/app/route-parse.ts`, `src/app/router.ts`,
`src/app/page.ts`, `src/app/shell.ts`, `src/app/theme.ts`,
`src/app/preferences.ts` (in-memory energy unit/theme, loaded at start,
updated on `onDataChanged`), `src/app/day-watch.ts`, `src/main.ts`,
`src/ui/*` (dom `svg()` helper, icons, toast, dialog, number-field,
text-field, search-field, chip-group, segmented, list-row, notice,
empty-state), `src/styles/tokens.css`, `base.css`, `layout.css`,
`components.css`, `src/i18n/de.ts`, `src/i18n/i18n.ts` (plural),
`src/i18n/format.ts` (weekday formats), `src/i18n/messages/*.ts` (creates
all files; fills `common.ts`), stub pages
`src/features/<area>/<area>-page.ts` for every route (placeholder, replaced
in wave 2), stub `src/features/dashboard/week-panel.ts`, removes
`src/ui/placeholder-page.ts`, unit tests for these.
P2 may develop against a temporary local mock of `onDataChanged`/`getSetting`;
final wiring uses P1's modules (merge order: P1 before P2).
Acceptance: all routes reachable incl. params; nav icons and active state;
large title + back variant; dark/light/system via attribute; toast and both
dialogs keyboard-usable; tokens test green; existing e2e specs green.

**P3 – Platform and deploy** (`implementer`)
Files: `security.config.ts`, `vite.config.ts`, `src/app/update.ts`,
`src/app/storage.ts`, `package.json` (version 0.1.0, `workbox-window` to
dependencies, `__APP_VERSION__`), `src/vite-env.d.ts` (types for
`virtual:pwa-register`, `__APP_VERSION__`), `scripts/check-dist-urls.sh` if
needed, tests `security-headers.test.ts`, `storage.test.ts`, `update.test.ts`.
Uses `showToast` and `onDataChanged` by signature only.
Acceptance: `dist/_headers` generated and matches §11.3; meta CSP unchanged
in content; SW registers with prompt behaviour; persist called once after
first write; `npm run verify` green.

### Wave 2 (parallel, after wave 1 is merged)

**P4 – Heute** – `src/features/today/*` (page, day-ring, nutrient-bar,
meal-group, entry-sheet), `src/i18n/messages/today.ts`,
`src/styles/today.css` (imported by the page), `tests/e2e/today.spec.ts`,
`tests/e2e/entry.spec.ts` (delete part), `tests/e2e/day-change.spec.ts`.
Acceptance: §6.1 states match `Heute.png`, `Heute _ ohne Ziel.png`,
`Heute _ Dunkel.png`; sheet and dialog as designed; refresh after data and
day changes; no `style` attributes; specs green on iphone + desktop.

**P5 – Hinzufügen and Portion** – `src/features/add/*`
(search/scan/manual tabs, food form, portion page, entry edit),
`src/i18n/messages/add.ts`, `src/styles/add.css`,
`tests/e2e/log-food.spec.ts`, `tests/e2e/entry.spec.ts` (edit part – P4
creates the file, P5 adds a separate `entry-edit.spec.ts` instead to avoid
conflict).
Acceptance: §6.2–6.3; decimal comma input; kJ toggle stores kcal; no network
request while typing or on "Suchen"; Portion preview correct; edit keeps
snapshot.

**P6 – Ziele** – `src/features/goals/*`, `src/i18n/messages/goals.ts`,
`src/styles/goals.css`, `tests/e2e/goals.spec.ts`.
Acceptance: §6.4; never writes a value the user did not type; kJ input
stored as kcal; past days keep their goals.

**P7 – Einstellungen and backup UI** – `src/features/settings/*`
(settings page, about page, setting-row, backup-ui with share/download and
file import), `src/i18n/messages/settings.ts`, `src/styles/settings.css`,
`tests/e2e/settings.spec.ts`, `tests/fixtures/backup-week.json`.
Acceptance: §6.5, §8; bad files change nothing; export → import round trip
equal; account row not interactive.

**P8 – Desktop dashboard** – `src/features/dashboard/*` (week-panel,
week-chart, macro-split), `src/i18n/messages/dashboard.ts`,
`src/styles/dashboard.css`, `tests/e2e/dashboard.spec.ts`.
Contract with P4: `renderWeekPanel(ctx: PageContext): Promise<HTMLElement>`;
P4 calls it, P8 implements it (stub exists from P2).
Acceptance: §6.6 matches `Desktop _ Dashboard.png`; hidden table equals the
bars; over-goal not by colour alone.

### Wave 3

**P9 – Cross-cutting tests** (`ui-tester`): `tests/e2e/a11y.spec.ts`,
`tests/e2e/offline.spec.ts` (extend), accesslint audit, real-iPhone checklist.
**P10 – Docs** (`docs-writer`): README (privacy table from account-and-sync
§9.2 adapted to "account coming", deploy note), ROADMAP Phase 3 ✅.
Then `reviewer`, `security-reviewer`, `bug-hunter`.

### Dependency order

```
P0 ──▶ P1 ─┬─▶ P2 (merge after P1) ─┬─▶ P4 ─┐
           └─▶ P3 ──────────────────┤   P5  │
                                    ├─▶ P6  ├─▶ P9, P10 ─▶ reviews
                                    ├─▶ P7  │
                                    └─▶ P8 ─┘
```

P1, P2, P3 start together; P2 and P3 code against the signatures and are
merged after P1. P4–P8 start together after wave 1.

## 14. File list

New unless marked _(modify)_ / _(delete)_.

| Path                                                                                                                                                                                                                                                                                          | Package                                |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `design/tokens.json` _(modify, main session)_                                                                                                                                                                                                                                                 | P0                                     |
| `design/figcraft/export/icons/*.svg`                                                                                                                                                                                                                                                          | P0                                     |
| `src/db/types.ts`, `entries.ts`, `settings.ts` _(modify)_                                                                                                                                                                                                                                     | P1                                     |
| `src/db/write.ts`, `foods.ts`, `goals.ts`, `backup.ts`, `lifecycle.ts`                                                                                                                                                                                                                        | P1                                     |
| `src/domain/meals.ts`, `day-summary.ts`, `goals.ts`, `week.ts`, `energy.ts`, `search.ts`, `limits.ts`, `backup-format.ts`                                                                                                                                                                     | P1                                     |
| `eslint.config.js` _(modify)_                                                                                                                                                                                                                                                                 | P1                                     |
| `tests/unit/write.test.ts`, `write-boundary.test.ts`, `foods.test.ts`, `goals.test.ts`, `day-summary.test.ts`, `week.test.ts`, `meals.test.ts`, `search.test.ts`, `energy.test.ts`, `limits.test.ts`, `backup-format.test.ts`, `backup.test.ts`, `lifecycle.test.ts`; `db.test.ts` _(modify)_ | P1                                     |
| `src/app/routes.ts`, `router.ts`, `shell.ts`, `main.ts` _(modify)_                                                                                                                                                                                                                            | P2                                     |
| `src/app/route-parse.ts`, `page.ts`, `theme.ts`, `preferences.ts`, `day-watch.ts`                                                                                                                                                                                                             | P2                                     |
| `src/ui/dom.ts` _(modify)_; `src/ui/icons.ts`, `toast.ts`, `dialog.ts`, `number-field.ts`, `text-field.ts`, `search-field.ts`, `chip-group.ts`, `segmented.ts`, `list-row.ts`, `notice.ts`, `empty-state.ts`                                                                                  | P2                                     |
| `src/ui/placeholder-page.ts` _(delete)_                                                                                                                                                                                                                                                       | P2                                     |
| `src/styles/tokens.css`, `base.css`, `layout.css` _(modify)_; `components.css`                                                                                                                                                                                                                | P2                                     |
| `src/i18n/de.ts`, `i18n.ts`, `format.ts` _(modify)_; `src/i18n/messages/common.ts`, `today.ts`, `add.ts`, `goals.ts`, `settings.ts`, `dashboard.ts`                                                                                                                                           | P2 (feature files then owned by P4–P8) |
| stub pages `src/features/{today,add,goals,settings,dashboard}/…`                                                                                                                                                                                                                              | P2 (then owned by P4–P8)               |
| `tests/unit/route-parse.test.ts`, `day-watch.test.ts`; `i18n.test.ts`, `tokens.test.ts`, `format.test.ts`, `routes.test.ts` _(modify)_; `tests/e2e/shell.spec.ts`, `layout.spec.ts` _(modify)_                                                                                                | P2                                     |
| `security.config.ts`, `vite.config.ts` _(modify)_, `package.json` _(modify)_, `src/vite-env.d.ts` _(modify)_                                                                                                                                                                                  | P3                                     |
| `src/app/update.ts`, `src/app/storage.ts` _(modify)_                                                                                                                                                                                                                                          | P3                                     |
| `tests/unit/security-headers.test.ts`, `update.test.ts`, `storage.test.ts` _(modify)_                                                                                                                                                                                                         | P3                                     |
| `src/features/today/today-page.ts`, `day-ring.ts`, `nutrient-bar.ts`, `meal-group.ts`, `entry-sheet.ts`; `src/styles/today.css`                                                                                                                                                               | P4                                     |
| `tests/e2e/today.spec.ts`, `entry.spec.ts`, `day-change.spec.ts`                                                                                                                                                                                                                              | P4                                     |
| `src/features/add/add-page.ts`, `search-tab.ts`, `scan-tab.ts`, `food-form.ts`, `portion-page.ts`, `food-edit-page.ts`; `src/styles/add.css`                                                                                                                                                  | P5                                     |
| `tests/e2e/log-food.spec.ts`, `entry-edit.spec.ts`                                                                                                                                                                                                                                            | P5                                     |
| `src/features/goals/goals-page.ts`; `src/styles/goals.css`; `tests/e2e/goals.spec.ts`                                                                                                                                                                                                         | P6                                     |
| `src/features/settings/settings-page.ts`, `about-page.ts`, `setting-row.ts`, `backup-ui.ts`; `src/styles/settings.css`; `tests/e2e/settings.spec.ts`; `tests/fixtures/backup-week.json`                                                                                                       | P7                                     |
| `src/features/dashboard/week-panel.ts`, `week-chart.ts`, `macro-split.ts`; `src/styles/dashboard.css`; `tests/e2e/dashboard.spec.ts`                                                                                                                                                          | P8                                     |
| `tests/e2e/a11y.spec.ts`, `offline.spec.ts` _(modify)_                                                                                                                                                                                                                                        | P9                                     |
| `README.md`, `ROADMAP.md` _(modify)_                                                                                                                                                                                                                                                          | P10                                    |

## 15. Proposed `design/tokens.json` changes (applied by the main session)

1. `$description`: "ascend design tokens v0.4 …".
2. Replace `theme.light` / `theme.dark` with the FigCraft theme variables
   (values in §7.1): keys `bgApp`, `bgSurface`, `bgChrome`, `bgField`,
   `lineRule`, `lineSoft`, `textPrimary`, `textMuted`, `textDisabled`,
   `textInverse`, `accent`, `accentOn`, `accentSoft`, `statusWarning`,
   `statusDanger`, `buttonPrimary`, `buttonPrimaryPressed`, `focusRing`
   (light `{color.teal}`, dark `{color.mint}`). Remove `windowBackground`,
   `tabStrip`, `tabActive`, `border`, `text`, `field`. Light `bgApp` becomes
   `{color.paper}` (was surface). Manifest `theme_color`/`background_color`
   and the `<meta name="theme-color">` light value follow `bgApp`
   (`#F6F5F0`).
3. `font.size`: add `mobileBody: 15`, `mobileLabel: 13`, `mono: 12`,
   `input: 16`, `numberLarge: <FigCraft>`, `numberMedium: <FigCraft>`; keep
   `caption 12`, `body 13` (desktop), `heading 15`, `title 28`,
   `display 48`.
4. Optional, for clarity: `font.styles` mapping each FigCraft text style
   (`Display`, `Title`, `Heading`, `Mobile/Body`, `Mobile/Label`, `Body`,
   `Caption`, `Mono`, `Number/Large`, `Number/Medium`) to
   `{ family, size, weight }`.
5. `size`: add `fieldHeight`, `buttonHeight`, `chipHeight` from FigCraft
   (visual estimate 44 / 44 / 36; read exact values).
6. `contrast`: add `"accent/accentOn"`, `"textMuted/bgApp dark"` after
   checking (the test can compute them).

## 16. Open questions for the user

1. **Font size in input fields:** FigCraft uses Mobile/Body 15 for fields.
   iOS Safari zooms into any field below 16 px. Use 16 px only for input
   fields (everything else 15 as designed)? _Recommended: yes._
2. **Backup import:** merge with existing data (newer change wins, nothing
   is deleted) or replace everything? _Recommended: merge (D12-A)._
3. **Deployment:** Cloudflare builds from the private GitHub repo (no tool,
   no token, no telemetry setting; Cloudflare gets read access to this one
   repo) or uploads from the Mac with `wrangler` (new tool, metrics must be
   switched off)? _Recommended: Git integration (D14-A)._
4. **New dev dependency `@axe-core/playwright`** (MPL-2.0, tests only, never
   shipped, no network) for automatic accessibility checks? _Recommended:
   yes._
5. **Manual form:** Energie required, Eiweiß/Kohlenhydrate/Fett optional
   (empty = unknown, shown as "unvollständig")? _Recommended: yes – forcing
   "0" would make totals look complete when they are not._

## 17. Commit plan

Each commit passes `npm run verify`; from commit 5 on also
`npx playwright test`. Feature commits include their unit and e2e tests.

1. `feat(db): route all writes through write.ts and add meals and time-zone offsets` – P1
2. `feat(ui): restyle the shell to the FigCraft design with icons and ui components` – P2 (+ tokens.json/tokens.css)
3. `feat(app): add update prompt, theme setting, day watcher and database lifecycle` – P2/P3 app parts
4. `chore(deploy): generate cloudflare pages security headers` – P3 (+ README deploy note)
5. `feat(today): show day totals, ring, nutrient bars and meals` – P4
6. `feat(add): log food by hand, keep own foods and edit entries` – P5
7. `feat(goals): set daily goals with effective dates` – P6
8. `feat(settings): add energy unit, appearance, json backup and privacy page` – P7
9. `feat(dashboard): add week chart and macro distribution on desktop` – P8
10. `test(e2e): add accessibility and offline checks; docs: finish phase 3` – P9/P10 (split into `test:` and `docs:` if preferred)

## 18. Phase-end checklist

- [ ] `npm run verify`, `npx playwright test` green
- [ ] No feature imports `src/db/db`; every new entry has `meal` and `loggedTzOffset`
- [ ] Goals table empty on a fresh install; no code writes default goals
- [ ] Deployed on `*.pages.dev`; `curl -I` shows CSP with `frame-ancestors 'none'`, `sw.js` no-cache; Web Analytics off; preview deployments off
- [ ] iPhone: install, flight mode, log a food, kill the app, reopen → entry there; export via share sheet → "In Dateien sichern"; import it again
- [ ] iPhone: new deploy → "Neue Version verfügbar" appears, reload works
- [ ] App open across midnight → Heute shows the new day
- [ ] Dark mode on the device: over-goal state readable (text, not colour alone)
- [ ] `security-reviewer`, `reviewer`, `bug-hunter` pass
