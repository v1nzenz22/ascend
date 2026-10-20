import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { db } from "../../src/db/db";
import { logFood, entriesOn } from "../../src/db/entries";
import {
  allFoods,
  createFood,
  deleteFood,
  getFood,
  updateFood,
  type FoodInput,
} from "../../src/db/foods";
import { resetDatabase } from "./data-helpers";

const SKYR: FoodInput = {
  name: "  Skyr Natur ",
  unit: "g",
  per100: { kcal: 63, protein: 11, carbs: 4, fat: 0.2 },
};

beforeEach(resetDatabase);
afterEach(() => {
  vi.useRealTimers();
});

describe("createFood", () => {
  test("stores a manual food with id, timestamps and a trimmed name", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-20T08:00:00.000Z"));
    const food = await createFood(SKYR);
    expect(food).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/) as unknown,
      name: "Skyr Natur",
      unit: "g",
      per100: { kcal: 63, protein: 11, carbs: 4, fat: 0.2 },
      portions: [],
      source: "manual",
      createdAt: "2026-10-20T08:00:00.000Z",
      updatedAt: "2026-10-20T08:00:00.000Z",
    });
    expect(await getFood(food.id)).toEqual(food);
  });

  test("only energy is required; unknown nutrients stay unknown", async () => {
    const food = await createFood({ name: "Suppe", unit: "ml", per100: { kcal: 40 } });
    expect(food.per100).toEqual({ kcal: 40 });
  });

  test("keeps brand and portions; an empty brand counts as none", async () => {
    const withBrand = await createFood({
      ...SKYR,
      brand: " Arla ",
      portions: [{ label: "1 Becher", amount: 150 }],
    });
    expect(withBrand.brand).toBe("Arla");
    expect(withBrand.portions).toEqual([{ label: "1 Becher", amount: 150 }]);
    const noBrand = await createFood({ ...SKYR, brand: "  " });
    expect("brand" in noBrand).toBe(false);
  });

  test("rejects values outside the limits and stores nothing", async () => {
    const bad: FoodInput[] = [
      { ...SKYR, name: "   " },
      { ...SKYR, name: "x".repeat(101) },
      { ...SKYR, brand: "x".repeat(101) },
      { ...SKYR, per100: { kcal: 1001 } },
      { ...SKYR, per100: { kcal: -1 } },
      { ...SKYR, per100: { kcal: 100, fat: 101 } },
      { ...SKYR, per100: { kcal: Number.NaN } },
      { ...SKYR, portions: [{ label: "", amount: 10 }] },
      { ...SKYR, portions: [{ label: "Becher", amount: 0 }] },
      { ...SKYR, unit: "kg" as unknown as "g" },
    ];
    for (const input of bad) {
      await expect(createFood(input)).rejects.toThrow(RangeError);
    }
    expect(await db.foods.count()).toBe(0);
  });
});

describe("updateFood / deleteFood", () => {
  test("updates the editable fields and keeps id, source and createdAt", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-20T08:00:00.000Z"));
    const food = await createFood(SKYR);
    vi.setSystemTime(new Date("2026-10-21T08:00:00.000Z"));
    const updated = await updateFood(food.id, { ...SKYR, name: "Skyr", per100: { kcal: 65 } });
    expect(updated).toEqual({
      ...food,
      name: "Skyr",
      per100: { kcal: 65 },
      updatedAt: "2026-10-21T08:00:00.000Z",
    });
    expect(await getFood(food.id)).toEqual(updated);
  });

  test("rejects an unknown id", async () => {
    await expect(updateFood("missing", SKYR)).rejects.toThrow();
    expect(await db.foods.count()).toBe(0);
  });

  test("editing or deleting a food leaves its entries unchanged", async () => {
    const food = await createFood(SKYR);
    const entry = await logFood(food, { amount: 150, date: "2026-10-20", meal: "breakfast" });
    await updateFood(food.id, { ...SKYR, name: "Anders", per100: { kcal: 999 } });
    expect(await entriesOn("2026-10-20")).toEqual([entry]);
    await deleteFood(food.id);
    expect(await getFood(food.id)).toBeUndefined();
    expect(await entriesOn("2026-10-20")).toEqual([entry]);
  });
});

describe("allFoods", () => {
  test("sorts by name with German rules", async () => {
    for (const name of ["Zwieback", "Äpfel", "apfelmus", "Banane"]) {
      await createFood({ ...SKYR, name });
    }
    expect((await allFoods()).map((food) => food.name)).toEqual([
      // "Äpfel" sorts like "Apfel", before the longer "apfelmus".
      "Äpfel",
      "apfelmus",
      "Banane",
      "Zwieback",
    ]);
  });
});
