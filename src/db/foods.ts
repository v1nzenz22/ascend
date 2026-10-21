// The user's own foods: create, edit, delete, read. Editing or deleting a
// food never touches entries – they keep their snapshot copy.
// Reads use `db` directly; every write goes through write.ts.
import { db } from "./db";
import type { Food, FoodUnit, Portion } from "./types";
import { deleteRecord, saveRecord } from "./write";
import {
  isFoodUnit,
  isLengthInRange,
  isValidFoodName,
  LIMITS,
  readPer100,
  readPortions,
} from "../domain/limits";
import type { Nutrients } from "../domain/nutrients";
import { newId } from "../lib/id";

/** What a form provides; id, source and timestamps are filled in here. */
export interface FoodInput {
  name: string;
  unit: FoodUnit;
  /** Only `kcal` is required; a missing nutrient means "unknown". */
  per100: Nutrients;
  portions?: Portion[];
  brand?: string;
}

/** The checked, cleaned fields of `input`. Throws a RangeError if invalid. */
function cleanInput(
  input: FoodInput,
): Pick<Food, "name" | "brand" | "unit" | "per100" | "portions"> {
  const name = input.name.trim();
  if (!isValidFoodName(name)) throw new RangeError("Food name must have 1–100 characters");
  if (!isFoodUnit(input.unit)) throw new RangeError("Unit must be g or ml");
  const per100 = readPer100(input.per100);
  if (per100 === null) throw new RangeError("Nutrient values out of range");
  const portions = readPortions(input.portions ?? []);
  if (portions === null) throw new RangeError("Invalid portions");
  const brand = input.brand?.trim() ?? "";
  if (!isLengthInRange(brand, LIMITS.brand)) throw new RangeError("Brand too long");
  // An empty brand is the same as no brand, so it is left out.
  return { name, ...(brand !== "" && { brand }), unit: input.unit, per100, portions };
}

/** Stores a new own food (`source: 'manual'`). */
export async function createFood(input: FoodInput): Promise<Food> {
  const now = new Date().toISOString();
  const food: Food = {
    id: newId(),
    ...cleanInput(input),
    source: "manual",
    createdAt: now,
    updatedAt: now,
  };
  await saveRecord("foods", food);
  return food;
}

/**
 * Replaces the editable fields of a food. `id`, `source`, `barcode` and
 * `createdAt` stay. Rejects if the food does not exist or input is invalid.
 */
export async function updateFood(id: string, input: FoodInput): Promise<Food> {
  const fields = cleanInput(input);
  const current = await db.foods.get(id);
  if (current === undefined) throw new Error(`No food with id ${id}`);
  const food: Food = {
    id: current.id,
    ...fields,
    ...(current.barcode !== undefined && { barcode: current.barcode }),
    source: current.source,
    createdAt: current.createdAt,
    updatedAt: new Date().toISOString(),
  };
  await saveRecord("foods", food);
  return food;
}

/** Deletes a food (no error if it does not exist). Entries stay unchanged. */
export async function deleteFood(id: string): Promise<void> {
  await deleteRecord("foods", id);
}

/** One food, or `undefined`. */
export async function getFood(id: string): Promise<Food | undefined> {
  return db.foods.get(id);
}

// Created once: German sorting rules ("Äpfel" next to "Apfel", not after "Z").
const byGermanName = new Intl.Collator("de");

/** All foods, sorted by name (German rules). */
export async function allFoods(): Promise<Food[]> {
  const foods = await db.foods.toArray();
  return foods.sort((a, b) => byGermanName.compare(a.name, b.name));
}
