// Shared test data for the data-layer tests. Not a test file itself
// (Vitest only runs *.test.ts).
import { db } from "../../src/db/db";
import type { Entry, Food } from "../../src/db/types";

/** Empties every table. Tests may use `db` directly for setup. */
export async function resetDatabase(): Promise<void> {
  await db.open();
  await Promise.all(db.tables.map((table) => table.clear()));
}

/** A fixed, valid UUID that ends in `n` (easy to read in failures). */
export function uuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

export function makeFood(overrides: Partial<Food> = {}): Food {
  return {
    id: uuid(1),
    name: "Haferflocken",
    brand: "Mühle",
    unit: "g",
    per100: { kcal: 372, protein: 13.5, carbs: 58.7, fat: 7 },
    portions: [{ label: "1 Esslöffel", amount: 10 }],
    source: "manual",
    createdAt: "2026-10-20T08:00:00.000Z",
    updatedAt: "2026-10-20T08:00:00.000Z",
    ...overrides,
  };
}

export function makeEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: uuid(100),
    date: "2026-10-20",
    loggedAt: "2026-10-20T07:00:00.000Z",
    loggedTzOffset: -120,
    foodId: uuid(1),
    snapshot: { name: "Skyr", unit: "g", per100: { kcal: 63, protein: 11, carbs: 4, fat: 0.2 } },
    amount: 100,
    meal: "breakfast",
    updatedAt: "2026-10-20T07:00:00.000Z",
    ...overrides,
  };
}
