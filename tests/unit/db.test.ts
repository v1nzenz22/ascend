// Database tests. They run against fake-indexeddb (an in-memory IndexedDB
// for Node, loaded via vitest.config.ts), never against a real browser.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { db, DB_NAME } from "../../src/db/db";
import {
  deleteEntry,
  entriesBetween,
  entriesOn,
  getEntry,
  logFood,
  updateEntry,
  type LogFoodInput,
} from "../../src/db/entries";
import { DEFAULT_SETTINGS, getSetting, setSetting } from "../../src/db/settings";
import type { SettingRow, SettingsMap } from "../../src/db/types";
import { makeEntry, makeFood, resetDatabase } from "./data-helpers";

const BREAKFAST: LogFoodInput = { amount: 50, date: "2026-10-20", meal: "breakfast" };

beforeEach(resetDatabase);

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
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

describe("logFood", () => {
  test("logs a food and reads it back by date", async () => {
    const food = makeFood();
    const entry = await logFood(food, BREAKFAST);

    expect(await entriesOn("2026-10-20")).toEqual([entry]);
    expect(entry.date).toBe("2026-10-20");
    expect(entry.amount).toBe(50);
    expect(entry.meal).toBe("breakfast");
    expect(entry.foodId).toBe(food.id);
    expect(entry.snapshot).toEqual({
      name: "Haferflocken",
      brand: "Mühle",
      unit: "g",
      per100: { kcal: 372, protein: 13.5, carbs: 58.7, fat: 7 },
    });
    expect(await entriesOn("2026-10-21")).toEqual([]);
  });

  test("records loggedAt and the time-zone offset of the same moment", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-20T06:30:00.000Z"));
    vi.spyOn(Date.prototype, "getTimezoneOffset").mockReturnValue(-120);

    const entry = await logFood(makeFood(), BREAKFAST);
    expect(entry.loggedAt).toBe("2026-10-20T06:30:00.000Z");
    expect(entry.updatedAt).toBe(entry.loggedAt);
    expect(entry.loggedTzOffset).toBe(-120);
    expect(await getEntry(entry.id)).toEqual(entry);
  });

  test("stores a portion label only when given", async () => {
    const without = await logFood(makeFood(), BREAKFAST);
    expect("portionLabel" in without).toBe(false);
    const withLabel = await logFood(makeFood(), { ...BREAKFAST, portionLabel: "1 Becher" });
    expect(withLabel.portionLabel).toBe("1 Becher");
  });

  test("leaves out optional fields that the food does not have", async () => {
    const food = makeFood();
    delete food.brand;
    const entry = await logFood(food, BREAKFAST);
    expect("brand" in entry.snapshot).toBe(false);
  });

  test("editing the food afterwards does not change the entry", async () => {
    const food = makeFood();
    await db.foods.add(food);
    const returned = await logFood(food, { ...BREAKFAST, amount: 100 });

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
    for (const date of ["2026-02-30", "20.10.2026", ""]) {
      await expect(logFood(makeFood(), { ...BREAKFAST, date })).rejects.toThrow(RangeError);
    }
    expect(await db.entries.count()).toBe(0);
  });

  test("rejects amounts outside > 0 … 10 000 and stores nothing", async () => {
    for (const amount of [0, -1, 10_001, Number.NaN, Number.POSITIVE_INFINITY]) {
      await expect(logFood(makeFood(), { ...BREAKFAST, amount })).rejects.toThrow(RangeError);
    }
    expect(await db.entries.count()).toBe(0);
  });

  test("accepts the largest allowed amount", async () => {
    const entry = await logFood(makeFood(), { ...BREAKFAST, amount: 10_000 });
    expect(entry.amount).toBe(10_000);
  });

  test("rejects an unknown meal and a too long portion label", async () => {
    const badMeal = { ...BREAKFAST, meal: "brunch" } as unknown as LogFoodInput;
    await expect(logFood(makeFood(), badMeal)).rejects.toThrow(RangeError);
    await expect(
      logFood(makeFood(), { ...BREAKFAST, portionLabel: "x".repeat(101) }),
    ).rejects.toThrow(RangeError);
    expect(await db.entries.count()).toBe(0);
  });
});

describe("updateEntry", () => {
  test("changes amount, meal and label but keeps snapshot and log time", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-20T06:30:00.000Z"));
    const original = await logFood(makeFood(), { ...BREAKFAST, portionLabel: "1 Becher" });

    vi.setSystemTime(new Date("2026-10-20T09:00:00.000Z"));
    const updated = await updateEntry(original.id, { amount: 150, meal: "snacks" });

    expect(updated).toEqual({
      ...original,
      amount: 150,
      meal: "snacks",
      updatedAt: "2026-10-20T09:00:00.000Z",
    });
    expect(await getEntry(original.id)).toEqual(updated);
  });

  test("null removes the portion label, undefined keeps it", async () => {
    const original = await logFood(makeFood(), { ...BREAKFAST, portionLabel: "1 Becher" });
    const kept = await updateEntry(original.id, { amount: 80 });
    expect(kept.portionLabel).toBe("1 Becher");
    const removed = await updateEntry(original.id, { portionLabel: null });
    expect("portionLabel" in removed).toBe(false);
    expect(await getEntry(original.id)).toEqual(removed);
    const added = await updateEntry(original.id, { portionLabel: "2 Becher" });
    expect(added.portionLabel).toBe("2 Becher");
  });

  test("rejects invalid changes and unknown ids without writing", async () => {
    const original = await logFood(makeFood(), BREAKFAST);
    await expect(updateEntry(original.id, { amount: 0 })).rejects.toThrow(RangeError);
    await expect(
      updateEntry(original.id, { meal: "brunch" } as unknown as { meal: "lunch" }),
    ).rejects.toThrow(RangeError);
    await expect(updateEntry("missing", { amount: 10 })).rejects.toThrow();
    expect(await getEntry(original.id)).toEqual(original);
    expect(await db.entries.count()).toBe(1);
  });
});

describe("deleteEntry and reads", () => {
  test("deletes one entry; deleting a missing id is fine", async () => {
    const a = await logFood(makeFood(), BREAKFAST);
    const b = await logFood(makeFood(), BREAKFAST);
    await deleteEntry(a.id);
    await deleteEntry("missing");
    expect(await entriesOn("2026-10-20")).toEqual([b]);
    expect(await getEntry(a.id)).toBeUndefined();
  });

  test("entriesOn sorts a day's entries by loggedAt", async () => {
    await db.entries.bulkAdd([
      makeEntry({ id: "b", loggedAt: "2026-10-20T12:00:00.000Z" }),
      makeEntry({ id: "a", loggedAt: "2026-10-20T07:00:00.000Z" }),
    ]);
    const ids = (await entriesOn("2026-10-20")).map((entry) => entry.id);
    expect(ids).toEqual(["a", "b"]);
  });

  test("entriesBetween includes both ends and sorts by day, then time", async () => {
    await db.entries.bulkAdd([
      makeEntry({ id: "before", date: "2026-10-13" }),
      makeEntry({ id: "first-late", date: "2026-10-14", loggedAt: "2026-10-14T18:00:00.000Z" }),
      makeEntry({ id: "first-early", date: "2026-10-14", loggedAt: "2026-10-14T06:00:00.000Z" }),
      makeEntry({ id: "last", date: "2026-10-20" }),
      makeEntry({ id: "after", date: "2026-10-21" }),
    ]);
    const ids = (await entriesBetween("2026-10-14", "2026-10-20")).map((entry) => entry.id);
    expect(ids).toEqual(["first-early", "first-late", "last"]);
    expect(await entriesBetween("2026-10-20", "2026-10-14")).toEqual([]);
  });
});

describe("settings", () => {
  test("fall back to defaults without writing them", async () => {
    expect(await getSetting("energyUnit")).toBe("kcal");
    expect(await getSetting("theme")).toBe("system");
    expect(await getSetting("goalsIntroDismissed")).toBe(false);
    expect(DEFAULT_SETTINGS).toEqual({
      energyUnit: "kcal",
      theme: "system",
      goalsIntroDismissed: false,
    });
    expect(await db.settings.count()).toBe(0);
  });

  test("round-trip a changed value", async () => {
    await setSetting("energyUnit", "kJ");
    expect(await getSetting("energyUnit")).toBe("kJ");
    await setSetting("energyUnit", "kcal");
    expect(await getSetting("energyUnit")).toBe("kcal");
    await setSetting("theme", "dark");
    expect(await getSetting("theme")).toBe("dark");
    await setSetting("goalsIntroDismissed", true);
    expect(await getSetting("goalsIntroDismissed")).toBe(true);
    expect(await db.settings.count()).toBe(3);
  });

  test("fall back to the default for an invalid stored value", async () => {
    // A row like this can come from an old version or the browser's
    // developer tools; TypeScript cannot prevent it at runtime.
    const keys: (keyof SettingsMap)[] = ["energyUnit", "theme", "goalsIntroDismissed"];
    for (const key of keys) {
      for (const value of ["calories", "", null, 42]) {
        await db.settings.put({ key, value } as unknown as SettingRow);
        expect(await getSetting(key)).toBe(DEFAULT_SETTINGS[key]);
      }
    }
  });

  test("refuse to store an invalid value", async () => {
    await expect(setSetting("theme", "blue" as unknown as "dark")).rejects.toThrow(RangeError);
    expect(await db.settings.count()).toBe(0);
  });
});
