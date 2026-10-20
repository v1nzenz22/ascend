// Database tests. They run against fake-indexeddb (an in-memory IndexedDB
// for Node, loaded via vitest.config.ts), never against a real browser.
import { beforeEach, describe, expect, test } from "vitest";
import { db, DB_NAME } from "../../src/db/db";
import { entriesOn, logFood } from "../../src/db/entries";
import { DEFAULT_SETTINGS, getSetting, setSetting } from "../../src/db/settings";
import type { Food, SettingRow } from "../../src/db/types";

function makeFood(overrides: Partial<Food> = {}): Food {
  return {
    id: "food-1",
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

beforeEach(async () => {
  // Every test starts with empty tables.
  await db.open();
  await Promise.all(db.tables.map((table) => table.clear()));
});

describe("schema", () => {
  test("is the ascend database, version 1, with four tables", () => {
    expect(db.name).toBe(DB_NAME);
    expect(db.verno).toBe(1);
    expect(db.tables.map((table) => table.name).sort()).toEqual([
      "entries",
      "foods",
      "goals",
      "settings",
    ]);
  });

  test("goals start empty: no preset values", async () => {
    expect(await db.goals.count()).toBe(0);
  });
});

describe("entries", () => {
  test("logs a food and reads it back by date", async () => {
    const food = makeFood();
    const entry = await logFood(food, 50, "2026-10-20");

    const found = await entriesOn("2026-10-20");
    expect(found).toEqual([entry]);
    expect(entry.date).toBe("2026-10-20");
    expect(entry.amount).toBe(50);
    expect(entry.foodId).toBe(food.id);
    expect(entry.snapshot).toEqual({
      name: "Haferflocken",
      brand: "Mühle",
      unit: "g",
      per100: { kcal: 372, protein: 13.5, carbs: 58.7, fat: 7 },
    });
    expect(await entriesOn("2026-10-21")).toEqual([]);
  });

  test("leaves out optional fields that the food does not have", async () => {
    const food = makeFood();
    delete food.brand;
    const entry = await logFood(food, 30, "2026-10-20");
    expect("brand" in entry.snapshot).toBe(false);
  });

  test("editing the food afterwards does not change the entry", async () => {
    const food = makeFood();
    await db.foods.add(food);
    const returned = await logFood(food, 100, "2026-10-20");

    // Change the food object in memory *and* in the database.
    food.name = "Haferflocken (neu)";
    food.per100.kcal = 999;
    await db.foods.put({ ...food, updatedAt: "2026-10-21T08:00:00.000Z" });

    const [entry] = await entriesOn("2026-10-20");
    expect(entry?.snapshot.name).toBe("Haferflocken");
    expect(entry?.snapshot.per100.kcal).toBe(372);
    // The entry object returned by logFood is a copy too, not a view of the
    // food: the UI may keep it in memory after the food was edited.
    expect(returned.snapshot.name).toBe("Haferflocken");
    expect(returned.snapshot.per100.kcal).toBe(372);
    expect(returned.snapshot.per100).not.toBe(food.per100);
  });

  test("rejects an invalid date and stores nothing", async () => {
    const food = makeFood();
    for (const date of ["2026-02-30", "20.10.2026", ""]) {
      await expect(logFood(food, 50, date)).rejects.toThrow(RangeError);
    }
    expect(await db.entries.count()).toBe(0);
  });

  test("rejects negative and non-finite amounts and stores nothing", async () => {
    const food = makeFood();
    for (const amount of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      await expect(logFood(food, amount, "2026-10-20")).rejects.toThrow(RangeError);
    }
    expect(await db.entries.count()).toBe(0);
  });

  test("accepts an amount of 0", async () => {
    const entry = await logFood(makeFood(), 0, "2026-10-20");
    expect(entry.amount).toBe(0);
  });

  test("sorts a day's entries by loggedAt", async () => {
    await db.entries.bulkAdd([
      {
        id: "b",
        date: "2026-10-20",
        loggedAt: "2026-10-20T12:00:00.000Z",
        snapshot: { name: "Mittag", unit: "g", per100: { kcal: 100 } },
        amount: 100,
        updatedAt: "2026-10-20T12:00:00.000Z",
      },
      {
        id: "a",
        date: "2026-10-20",
        loggedAt: "2026-10-20T07:00:00.000Z",
        snapshot: { name: "Frühstück", unit: "g", per100: { kcal: 100 } },
        amount: 100,
        updatedAt: "2026-10-20T07:00:00.000Z",
      },
    ]);
    const names = (await entriesOn("2026-10-20")).map((entry) => entry.snapshot.name);
    expect(names).toEqual(["Frühstück", "Mittag"]);
  });
});

describe("settings", () => {
  test("fall back to defaults without writing them", async () => {
    expect(await getSetting("energyUnit")).toBe(DEFAULT_SETTINGS.energyUnit);
    expect(await db.settings.count()).toBe(0);
  });

  test("round-trip a changed value", async () => {
    await setSetting("energyUnit", "kJ");
    expect(await getSetting("energyUnit")).toBe("kJ");
    await setSetting("energyUnit", "kcal");
    expect(await getSetting("energyUnit")).toBe("kcal");
    expect(await db.settings.count()).toBe(1);
  });

  test("fall back to the default for an invalid stored value", async () => {
    // A row like this can come from an old version, a broken import or the
    // browser's developer tools; TypeScript cannot prevent it at runtime.
    for (const value of ["calories", "", null, 42]) {
      await db.settings.put({ key: "energyUnit", value } as unknown as SettingRow);
      expect(await getSetting("energyUnit")).toBe(DEFAULT_SETTINGS.energyUnit);
    }
  });
});
