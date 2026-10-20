// The JSON backup file: building it and checking a file before import.
//
// A backup file comes from outside the app (it may be old, edited by hand,
// or not ours at all), so nothing in it is trusted. Every record is rebuilt
// field by field from an allowlist into a fresh object: unknown keys are
// dropped, and nothing outside the limits of §3.2 (src/domain/limits.ts)
// gets through. Pure functions: no database, no DOM.
import type { Entry, EntrySnapshot, Food, Goal, SettingRow } from "../db/types";
import { isLocalDate, type LocalDate } from "../lib/local-date";
import { GOAL_KEYS } from "./goals";
import {
  isFoodUnit,
  isInRange,
  isLengthInRange,
  isPlainObject,
  isSettingKey,
  isValidAmount,
  isValidBarcode,
  isValidFoodName,
  isValidTzOffset,
  LIMITS,
  readPer100,
  readPortions,
  SETTING_VALIDATORS,
} from "./limits";
import { isMeal } from "./meals";

export const BACKUP_APP = "ascend";
/** Version of the file layout (top-level keys). */
export const BACKUP_FORMAT = 1;
/** Database schema version the records follow; equals `db.verno`. */
export const SCHEMA_VERSION = 1;
/** Years of entries are a few MB; anything above 20 MB is not a real backup. */
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;

/** The records of a backup, one array per table. */
export interface BackupData {
  foods: Food[];
  entries: Entry[];
  goals: Goal[];
  settings: SettingRow[];
}

export type BackupTable = keyof BackupData;

/** The tables in file order, listed once. */
export const BACKUP_TABLES = [
  "foods",
  "entries",
  "goals",
  "settings",
] as const satisfies readonly BackupTable[];

/** Most records per table a file may hold (far above real use). */
export const MAX_RECORDS: Readonly<Record<BackupTable, number>> = {
  foods: 50_000,
  entries: 500_000,
  goals: 10_000,
  settings: 100,
};

/**
 * Why a file was rejected. Each code has a German message
 * (`backup.error.<code>` in i18n).
 * - tooLarge: file too big or too many records
 * - notJson: not readable as JSON
 * - notAscend: not an ascend backup (wrong `app` or `format`)
 * - newerVersion: made by a newer app version
 * - invalidFile: an ascend file, but its structure is broken
 * - invalidRecord: one record is invalid or a duplicate (`table`, `index`)
 */
export type BackupErrorCode =
  "tooLarge" | "notJson" | "notAscend" | "newerVersion" | "invalidFile" | "invalidRecord";

export interface BackupError {
  code: BackupErrorCode;
  /** For `invalidRecord`: which table … */
  table?: BackupTable;
  /** … and which position in it (0-based). */
  index?: number;
}

export type ParseResult = { ok: true; data: BackupData } | { ok: false; error: BackupError };

/** The backup as readable JSON text. `now` is the export time. */
export function buildBackup(data: BackupData, now: Date): string {
  const file = {
    app: BACKUP_APP,
    format: BACKUP_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    foods: data.foods,
    entries: data.entries,
    goals: data.goals,
    settings: data.settings,
  };
  return JSON.stringify(file, null, 2);
}

/** "ascend-backup-2026-10-20.json" for the local day `date`. */
export function backupFileName(date: LocalDate): string {
  return `ascend-backup-${date}.json`;
}

/** True if a file of `bytes` may be read at all (checked before reading). */
export function isBackupSizeOk(bytes: number): boolean {
  return bytes <= MAX_BACKUP_BYTES;
}

// Keys that could change object prototypes if some code ever copied them
// carelessly. JSON.parse itself is safe, but rejecting them is cheap
// defence in depth.
const FORBIDDEN_KEYS: readonly string[] = ["__proto__", "constructor", "prototype"];

class ForbiddenKeyError extends Error {}

function rejectForbiddenKeys(key: string, value: unknown): unknown {
  if (FORBIDDEN_KEYS.includes(key)) throw new ForbiddenKeyError(key);
  return value;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

function isId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

/** An ISO UTC timestamp like `new Date().toISOString()` writes, on a real day. */
function isInstant(value: unknown): value is string {
  return (
    typeof value === "string" &&
    ISO_INSTANT.test(value) &&
    isLocalDate(value.slice(0, 10)) &&
    !Number.isNaN(Date.parse(value))
  );
}

function isDate(value: unknown): value is LocalDate {
  return typeof value === "string" && isLocalDate(value);
}

/**
 * An optional text: `undefined`/`null` → absent (`undefined`), a string
 * within `range` → the string, anything else → `null` (invalid).
 */
function readOptionalText(
  value: unknown,
  range: { min: number; max: number },
): string | undefined | null {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string" || !isLengthInRange(value, range)) return null;
  return value;
}

function readName(value: unknown): string | null {
  if (typeof value !== "string" || !isValidFoodName(value)) return null;
  return value.trim();
}

function readFood(raw: unknown): Food | null {
  if (!isPlainObject(raw)) return null;
  const name = readName(raw.name);
  const brand = readOptionalText(raw.brand, LIMITS.brand);
  const barcode = raw.barcode ?? undefined;
  const per100 = readPer100(raw.per100);
  const portions = readPortions(raw.portions ?? []);
  if (
    !isId(raw.id) ||
    name === null ||
    brand === null ||
    (barcode !== undefined && (typeof barcode !== "string" || !isValidBarcode(barcode))) ||
    !isFoodUnit(raw.unit) ||
    per100 === null ||
    portions === null ||
    (raw.source !== "manual" && raw.source !== "off") ||
    !isInstant(raw.createdAt) ||
    !isInstant(raw.updatedAt)
  ) {
    return null;
  }
  return {
    id: raw.id,
    name,
    ...(brand !== undefined && brand !== "" && { brand }),
    ...(barcode !== undefined && { barcode }),
    unit: raw.unit,
    per100,
    portions,
    source: raw.source,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

function readSnapshot(raw: unknown): EntrySnapshot | null {
  if (!isPlainObject(raw)) return null;
  const name = readName(raw.name);
  const brand = readOptionalText(raw.brand, LIMITS.brand);
  const per100 = readPer100(raw.per100);
  if (name === null || brand === null || !isFoodUnit(raw.unit) || per100 === null) return null;
  return {
    name,
    ...(brand !== undefined && brand !== "" && { brand }),
    unit: raw.unit,
    per100,
  };
}

function readEntry(raw: unknown): Entry | null {
  if (!isPlainObject(raw)) return null;
  const foodId = raw.foodId ?? undefined;
  const snapshot = readSnapshot(raw.snapshot);
  const portionLabel = readOptionalText(raw.portionLabel, LIMITS.portionLabel);
  if (
    !isId(raw.id) ||
    !isDate(raw.date) ||
    !isInstant(raw.loggedAt) ||
    !isValidTzOffset(raw.loggedTzOffset) ||
    (foodId !== undefined && !isId(foodId)) ||
    snapshot === null ||
    !isValidAmount(raw.amount) ||
    portionLabel === null ||
    !isMeal(raw.meal) ||
    !isInstant(raw.updatedAt)
  ) {
    return null;
  }
  return {
    id: raw.id,
    date: raw.date,
    loggedAt: raw.loggedAt,
    loggedTzOffset: raw.loggedTzOffset,
    ...(foodId !== undefined && { foodId }),
    snapshot,
    amount: raw.amount,
    ...(portionLabel !== undefined && portionLabel !== "" && { portionLabel }),
    meal: raw.meal,
    updatedAt: raw.updatedAt,
  };
}

function readGoal(raw: unknown): Goal | null {
  if (!isPlainObject(raw) || !isDate(raw.validFrom) || !isInstant(raw.updatedAt)) return null;
  const goal: Goal = { validFrom: raw.validFrom, updatedAt: raw.updatedAt };
  for (const key of GOAL_KEYS) {
    const value = raw[key];
    if (value === undefined || value === null) continue;
    const range = key === "kcal" ? LIMITS.goalKcal : LIMITS.goalGrams;
    if (!isInRange(value, range)) return null;
    goal[key] = value;
  }
  return goal;
}

/**
 * A setting row, `"unknown"` for a key this app version does not know
 * (dropped, not an error: a newer app may have more settings), or `null`
 * for an invalid value of a known key.
 */
function readSetting(raw: unknown): SettingRow | "unknown" | null {
  if (!isPlainObject(raw) || typeof raw.key !== "string") return null;
  if (!isSettingKey(raw.key)) return "unknown";
  const value = raw.value;
  return SETTING_VALIDATORS[raw.key](value) ? { key: raw.key, value } : null;
}

function invalidRecord(table: BackupTable, index: number): ParseResult {
  return { ok: false, error: { code: "invalidRecord", table, index } };
}

function fail(code: BackupErrorCode): ParseResult {
  return { ok: false, error: { code } };
}

/**
 * Reads every record of one table. Returns the clean records, or the
 * position of the first invalid or duplicate record.
 */
function readTable<T>(
  items: readonly unknown[],
  read: (raw: unknown) => T | "unknown" | null,
  keyOf: (record: T) => string,
): { ok: true; records: T[] } | { ok: false; index: number } {
  const records: T[] = [];
  const seen = new Set<string>();
  for (const [index, raw] of items.entries()) {
    const record = read(raw);
    if (record === "unknown") continue;
    if (record === null) return { ok: false, index };
    const key = keyOf(record);
    if (seen.has(key)) return { ok: false, index };
    seen.add(key);
    records.push(record);
  }
  return { ok: true, records };
}

/**
 * Checks a backup file's text and returns clean records, or the first
 * problem found. Nothing is written here; the caller imports the result.
 */
export function parseBackup(text: string): ParseResult {
  // A string's length is at most its size in bytes as UTF-8, so this never
  // rejects a file that passed the size check before reading.
  if (text.length > MAX_BACKUP_BYTES) return fail("tooLarge");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text, rejectForbiddenKeys);
  } catch (error: unknown) {
    return fail(error instanceof ForbiddenKeyError ? "invalidFile" : "notJson");
  }

  if (!isPlainObject(parsed) || parsed.app !== BACKUP_APP) return fail("notAscend");
  const { format, schemaVersion } = parsed;
  if (typeof format === "number" && Number.isInteger(format) && format > BACKUP_FORMAT) {
    return fail("newerVersion");
  }
  if (format !== BACKUP_FORMAT) return fail("notAscend");
  if (typeof schemaVersion !== "number" || !Number.isInteger(schemaVersion) || schemaVersion < 1) {
    return fail("invalidFile");
  }
  if (schemaVersion > SCHEMA_VERSION) return fail("newerVersion");

  const tables: Partial<Record<BackupTable, unknown[]>> = {};
  for (const table of BACKUP_TABLES) {
    const items: unknown = parsed[table];
    if (!Array.isArray(items)) return fail("invalidFile");
    if (items.length > MAX_RECORDS[table]) return fail("tooLarge");
    tables[table] = items;
  }

  // Schema version 1 is the only one so far. A later version adds a
  // migration step here (old records → current shape) before the checks.
  const foods = readTable(tables.foods ?? [], readFood, (food) => food.id);
  if (!foods.ok) return invalidRecord("foods", foods.index);
  const entries = readTable(tables.entries ?? [], readEntry, (entry) => entry.id);
  if (!entries.ok) return invalidRecord("entries", entries.index);
  const goals = readTable(tables.goals ?? [], readGoal, (goal) => goal.validFrom);
  if (!goals.ok) return invalidRecord("goals", goals.index);
  const settings = readTable(tables.settings ?? [], readSetting, (row) => row.key);
  if (!settings.ok) return invalidRecord("settings", settings.index);

  return {
    ok: true,
    data: {
      foods: foods.records,
      entries: entries.records,
      goals: goals.records,
      settings: settings.records,
    },
  };
}
