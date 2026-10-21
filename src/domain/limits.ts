// Allowed ranges for every value the user can enter or import.
//
// One table, used by the forms (to show an error), by the data layer (to
// refuse broken values even if a form forgets a check) and by the backup
// import (so a file can never hold more than the app itself would store).
// Plausibility checks across fields (e.g. protein + carbs + fat ≤ 100 g)
// come in Phase 4.
import type { FoodUnit, Portion, SettingsMap } from "../db/types";
import { OPTIONAL_NUTRIENT_KEYS, type Nutrients } from "./nutrients";

/** An inclusive range. */
export interface Range {
  readonly min: number;
  readonly max: number;
}

export const LIMITS = {
  /** Characters after trimming. */
  foodName: { min: 1, max: 100 },
  /** Characters; empty means "none". */
  brand: { min: 0, max: 100 },
  portionLabel: { min: 0, max: 100 },
  /** Digits of an EAN/UPC (only in imports in Phase 3). */
  barcodeDigits: { min: 8, max: 14 },
  /** Energy per 100 g/ml. Pure fat has ~900 kcal. */
  per100Kcal: { min: 0, max: 1000 },
  /** Each nutrient in grams per 100 g/ml. */
  per100Grams: { min: 0, max: 100 },
  /** Eaten amount in g/ml. Must be above 0 (checked separately). */
  amount: { min: 0, max: 10_000 },
  goalKcal: { min: 1, max: 20_000 },
  goalGrams: { min: 1, max: 2_000 },
  /** Real time zones range from UTC−12 (+720) to UTC+14 (−840). */
  tzOffset: { min: -840, max: 720 },
  /** Named servings per food. Not in the design's table: a guard for imports. */
  portionsPerFood: { min: 0, max: 50 },
} as const satisfies Record<string, Range>;

/**
 * True if `value` is a finite number inside `range`. Takes `unknown` so it
 * can check imported data; `NaN` and `Infinity` are never valid.
 */
export function isInRange(value: unknown, range: Range): value is number {
  return (
    typeof value === "number" && Number.isFinite(value) && value >= range.min && value <= range.max
  );
}

/** True if `text` has a length inside `range` (no trimming here). */
export function isLengthInRange(text: string, range: Range): boolean {
  return text.length >= range.min && text.length <= range.max;
}

/** A food name: 1–100 characters after trimming. */
export function isValidFoodName(name: string): boolean {
  return isLengthInRange(name.trim(), LIMITS.foodName);
}

/** An eaten amount: more than 0 and at most 10 000 g/ml. */
export function isValidAmount(value: unknown): value is number {
  return isInRange(value, LIMITS.amount) && value > 0;
}

/** 8–14 digits, nothing else. */
export function isValidBarcode(value: string): boolean {
  return /^\d+$/.test(value) && isLengthInRange(value, LIMITS.barcodeDigits);
}

/** A whole number of minutes in the range of real time zones. */
export function isValidTzOffset(value: unknown): value is number {
  return Number.isInteger(value) && isInRange(value, LIMITS.tzOffset);
}

/** "g" or "ml". Takes `unknown` to check data a form or file provides. */
export function isFoodUnit(value: unknown): value is FoodUnit {
  return value === "g" || value === "ml";
}

/** True if `value` is a plain object (not null, not an array). */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * A clean copy of nutrient values per 100 g/ml, or `null` if they break the
 * limits. Energy is required (0–1000 kcal); every other nutrient is
 * optional (0–100 g). Missing or `null` means "unknown" and is left out of
 * the copy. Only known fields are copied, so unknown keys never get in.
 */
export function readPer100(value: unknown): Nutrients | null {
  if (!isPlainObject(value)) return null;
  if (!isInRange(value.kcal, LIMITS.per100Kcal)) return null;
  const result: Nutrients = { kcal: value.kcal };
  for (const key of OPTIONAL_NUTRIENT_KEYS) {
    const grams = value[key];
    if (grams === undefined || grams === null) continue;
    if (!isInRange(grams, LIMITS.per100Grams)) return null;
    result[key] = grams;
  }
  return result;
}

/**
 * A clean copy of a food's named servings, or `null` if any is invalid:
 * at most 50, each with a label of 1–100 characters (trimmed) and an
 * amount above 0 and at most 10 000.
 */
export function readPortions(value: unknown): Portion[] | null {
  if (!Array.isArray(value) || value.length > LIMITS.portionsPerFood.max) return null;
  const result: Portion[] = [];
  for (const item of value as unknown[]) {
    if (!isPlainObject(item) || typeof item.label !== "string") return null;
    const label = item.label.trim();
    if (label === "" || !isLengthInRange(label, LIMITS.portionLabel)) return null;
    if (!isValidAmount(item.amount)) return null;
    result.push({ label, amount: item.amount });
  }
  return result;
}

/**
 * One check per setting: is a value really of the right type? The mapped
 * type makes a new setting without a check a type error. Used when reading
 * settings from the database and when importing a backup.
 */
export const SETTING_VALIDATORS: {
  readonly [K in keyof SettingsMap]: (value: unknown) => value is SettingsMap[K];
} = {
  energyUnit: (value): value is SettingsMap["energyUnit"] => value === "kcal" || value === "kJ",
  theme: (value): value is SettingsMap["theme"] =>
    value === "system" || value === "light" || value === "dark",
  goalsIntroDismissed: (value): value is boolean => typeof value === "boolean",
};

/** True if `key` names a known setting. Unknown keys come only from files. */
export function isSettingKey(key: unknown): key is keyof SettingsMap {
  return typeof key === "string" && Object.hasOwn(SETTING_VALIDATORS, key);
}
