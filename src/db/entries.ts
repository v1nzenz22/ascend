// Logging food and reading a day's entries.
import { db } from "./db";
import type { Entry, EntrySnapshot, Food } from "./types";
import type { Nutrients } from "../domain/nutrients";
import { newId } from "../lib/id";
import { isLocalDate, type LocalDate } from "../lib/local-date";

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

/**
 * Stores that `amount` (in the food's unit) of `food` was eaten on `date`.
 * Rejects with a RangeError, without storing anything, if `date` is not a
 * real 'YYYY-MM-DD' day or `amount` is negative, NaN or infinite. The UI
 * validates input first; this guard keeps broken values out of the database
 * even if a caller forgets, because they would spoil every day total.
 */
export async function logFood(food: Food, amount: number, date: LocalDate): Promise<Entry> {
  if (!isLocalDate(date)) throw new RangeError(`Not a local date: ${date}`);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new RangeError(`Not a valid amount: ${String(amount)}`);
  }
  const now = new Date().toISOString();
  const entry: Entry = {
    id: newId(),
    date,
    loggedAt: now,
    foodId: food.id,
    snapshot: snapshotOf(food),
    amount,
    updatedAt: now,
  };
  await db.entries.add(entry);
  return entry;
}

/** All entries for `date`, oldest first. */
export async function entriesOn(date: LocalDate): Promise<Entry[]> {
  // `date` is indexed, so this reads only that day's rows.
  return db.entries.where("date").equals(date).sortBy("loggedAt");
}
