// Shapes of the records stored in the local database (schema version 1).
//
// Conventions:
// - IDs are UUID strings (see src/lib/id.ts), except goals and settings,
//   which use natural keys.
// - Instants (`createdAt`, `updatedAt`, `loggedAt`) are ISO 8601 UTC strings
//   from `new Date().toISOString()`; calendar days are `LocalDate` strings.
//   The two are never mixed.
// - Every record has `updatedAt`, so a later export/sync can ask "what
//   changed since…".
import type { Nutrients } from "../domain/nutrients";
import type { LocalDate } from "../lib/local-date";

/** Values are per 100 g or per 100 ml. */
export type FoodUnit = "g" | "ml";

/** A named serving, e.g. `{ label: '1 Scheibe', amount: 30 }` (amount in the food's unit). */
export interface Portion {
  label: string;
  amount: number;
}

/** A food the user created (or, later, one cached from Open Food Facts). */
export interface Food {
  id: string;
  name: string;
  brand?: string;
  /** EAN/UPC. Not unique: a user copy and an OFF copy may share it. */
  barcode?: string;
  unit: FoodUnit;
  per100: Nutrients;
  portions: Portion[];
  source: "manual" | "off";
  createdAt: string;
  updatedAt: string;
}

/**
 * Copy of the food's values at logging time. Editing or deleting the food
 * later never changes past entries.
 */
export interface EntrySnapshot {
  name: string;
  brand?: string;
  unit: FoodUnit;
  per100: Nutrients;
}

/** Something the user ate on a given day. */
export interface Entry {
  id: string;
  /** The day the food counts for, in the user's local calendar. */
  date: LocalDate;
  /** When it was logged; sorts entries within a day. */
  loggedAt: string;
  /** Link to the source food. Never used to read values (see `snapshot`). */
  foodId?: string;
  snapshot: EntrySnapshot;
  /** Eaten amount in `snapshot.unit`. */
  amount: number;
  /** Optional, for display ("2 × 1 Scheibe"). */
  portionLabel?: string;
  updatedAt: string;
}

/**
 * A set of goals that applies from `validFrom` until the next set.
 * Every goal is optional: the app never presets values.
 */
export interface Goal {
  validFrom: LocalDate;
  kcal?: number;
  /** grams */
  protein?: number;
  /** grams */
  carbs?: number;
  /** grams */
  fat?: number;
  updatedAt: string;
}

/** Every setting with its value type. Display preferences only, never goals. */
export interface SettingsMap {
  energyUnit: "kcal" | "kJ";
}

export type SettingKey = keyof SettingsMap;

/** One row in the `settings` table. */
export interface SettingRow {
  key: SettingKey;
  value: SettingsMap[SettingKey];
}
