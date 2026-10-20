// Logging food, editing and deleting entries, and reading entries by day.
// Reads use `db` directly; every write goes through write.ts.
import { db } from "./db";
import type { Entry, EntrySnapshot, Food, Meal } from "./types";
import { deleteRecord, saveRecord } from "./write";
import { isMeal } from "../domain/meals";
import { isLengthInRange, isValidAmount, LIMITS } from "../domain/limits";
import type { Nutrients } from "../domain/nutrients";
import { newId } from "../lib/id";
import { isLocalDate, type LocalDate } from "../lib/local-date";

export interface LogFoodInput {
  /** Eaten amount in the food's unit: more than 0, at most 10 000. */
  amount: number;
  date: LocalDate;
  meal: Meal;
  /** Shown next to the amount ("1 Becher"); 0–100 characters. */
  portionLabel?: string;
}

export interface EntryChanges {
  amount?: number;
  meal?: Meal;
  /** A new label, or `null` to remove the label. */
  portionLabel?: string | null;
}

/**
 * Copies the values of `food` that an entry needs. A real copy (new objects),
 * not a reference: if the food is edited later, the entry stays as it was.
 */
function snapshotOf(food: Food): EntrySnapshot {
  const per100: Nutrients = { ...food.per100 };
  return {
    name: food.name,
    // With `exactOptionalPropertyTypes` an optional field must be left out
    // rather than set to `undefined`, hence the conditional spread.
    ...(food.brand !== undefined && { brand: food.brand }),
    unit: food.unit,
    per100,
  };
}

// The guards below keep broken values out of the database even if a caller
// forgets to validate: one bad amount would spoil every day total. They
// throw a RangeError before anything is stored.

function checkAmount(amount: number): void {
  if (!isValidAmount(amount)) throw new RangeError(`Not a valid amount: ${String(amount)}`);
}

function checkMeal(meal: Meal): void {
  if (!isMeal(meal)) throw new RangeError(`Not a meal: ${String(meal)}`);
}

function checkPortionLabel(label: string): void {
  if (!isLengthInRange(label, LIMITS.portionLabel)) {
    throw new RangeError("Portion label too long");
  }
}

/**
 * Stores that `input.amount` (in the food's unit) of `food` was eaten on
 * `input.date` in `input.meal`. `loggedAt` and `loggedTzOffset` are taken
 * from the same moment and never change afterwards.
 */
export async function logFood(food: Food, input: LogFoodInput): Promise<Entry> {
  if (!isLocalDate(input.date)) throw new RangeError(`Not a local date: ${input.date}`);
  checkAmount(input.amount);
  checkMeal(input.meal);
  if (input.portionLabel !== undefined) checkPortionLabel(input.portionLabel);

  const moment = new Date();
  const now = moment.toISOString();
  const entry: Entry = {
    id: newId(),
    date: input.date,
    loggedAt: now,
    loggedTzOffset: moment.getTimezoneOffset(),
    foodId: food.id,
    snapshot: snapshotOf(food),
    amount: input.amount,
    ...(input.portionLabel !== undefined && { portionLabel: input.portionLabel }),
    meal: input.meal,
    updatedAt: now,
  };
  await saveRecord("entries", entry);
  return entry;
}

/**
 * Changes amount, meal and/or portion label of an entry. The snapshot,
 * `date`, `loggedAt` and `loggedTzOffset` never change: history stays as
 * logged. Rejects if the entry does not exist or a value is invalid.
 */
export async function updateEntry(id: string, changes: EntryChanges): Promise<Entry> {
  if (changes.amount !== undefined) checkAmount(changes.amount);
  if (changes.meal !== undefined) checkMeal(changes.meal);
  if (typeof changes.portionLabel === "string") checkPortionLabel(changes.portionLabel);

  const current = await db.entries.get(id);
  if (current === undefined) throw new Error(`No entry with id ${id}`);

  // Built field by field (not spread from `changes`), so nothing but the
  // three editable fields can ever change.
  const updated: Entry = {
    id: current.id,
    date: current.date,
    loggedAt: current.loggedAt,
    loggedTzOffset: current.loggedTzOffset,
    ...(current.foodId !== undefined && { foodId: current.foodId }),
    snapshot: current.snapshot,
    amount: changes.amount ?? current.amount,
    meal: changes.meal ?? current.meal,
    updatedAt: new Date().toISOString(),
  };
  const label = changes.portionLabel === undefined ? current.portionLabel : changes.portionLabel;
  if (label !== undefined && label !== null) updated.portionLabel = label;

  await saveRecord("entries", updated);
  return updated;
}

/** Deletes an entry (no error if it does not exist). */
export async function deleteEntry(id: string): Promise<void> {
  await deleteRecord("entries", id);
}

/** One entry, or `undefined`. */
export async function getEntry(id: string): Promise<Entry | undefined> {
  return db.entries.get(id);
}

/** All entries for `date`, oldest first. */
export async function entriesOn(date: LocalDate): Promise<Entry[]> {
  // `date` is indexed, so this reads only that day's rows.
  return db.entries.where("date").equals(date).sortBy("loggedAt");
}

/** All entries from `from` to `to` (both included), by day, then oldest first. */
export async function entriesBetween(from: LocalDate, to: LocalDate): Promise<Entry[]> {
  if (from > to) return [];
  const entries = await db.entries.where("date").between(from, to, true, true).toArray();
  return entries.sort((a, b) => compareText(a.date, b.date) || compareText(a.loggedAt, b.loggedAt));
}

/** Plain character order: right for 'YYYY-MM-DD' days and ISO timestamps. */
function compareText(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}
