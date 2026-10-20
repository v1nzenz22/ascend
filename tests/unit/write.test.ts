import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { db } from "../../src/db/db";
import type { Entry } from "../../src/db/types";
import {
  deleteRecord,
  onDataChanged,
  saveRecord,
  saveRecords,
  type TableName,
} from "../../src/db/write";
import { makeEntry, makeFood, resetDatabase, uuid } from "./data-helpers";

beforeEach(resetDatabase);

const unsubscribers: (() => void)[] = [];

/** Records every notification; unsubscribed after each test. */
function recordChanges(): (readonly TableName[])[] {
  const calls: (readonly TableName[])[] = [];
  unsubscribers.push(onDataChanged((tables) => calls.push(tables)));
  return calls;
}

afterEach(() => {
  for (const unsubscribe of unsubscribers.splice(0)) unsubscribe();
  vi.restoreAllMocks();
});

describe("saveRecord / deleteRecord", () => {
  test("insert, overwrite and delete records of every table", async () => {
    await saveRecord("foods", makeFood());
    await saveRecord("entries", makeEntry());
    await saveRecord("goals", {
      validFrom: "2026-10-20",
      kcal: 2000,
      updatedAt: "2026-10-20T08:00:00.000Z",
    });
    await saveRecord("settings", { key: "theme", value: "dark" });
    expect(await db.foods.count()).toBe(1);
    expect(await db.entries.count()).toBe(1);
    expect(await db.goals.count()).toBe(1);
    expect(await db.settings.get("theme")).toEqual({ key: "theme", value: "dark" });

    await saveRecord("foods", makeFood({ name: "Neu" }));
    expect((await db.foods.get(uuid(1)))?.name).toBe("Neu");

    await deleteRecord("foods", uuid(1));
    await deleteRecord("entries", uuid(100));
    await deleteRecord("goals", "2026-10-20");
    await deleteRecord("settings", "theme");
    await deleteRecord("foods", "does-not-exist");
    for (const table of db.tables) expect(await table.count()).toBe(0);
  });
});

describe("onDataChanged", () => {
  test("fires after the commit with the changed table", async () => {
    let seenInListener: Entry | undefined;
    unsubscribers.push(
      onDataChanged(() => {
        // Reading inside the listener must already see the new data.
        void db.entries.get(uuid(100)).then((entry) => {
          seenInListener = entry;
        });
      }),
    );
    const calls = recordChanges();
    await saveRecord("entries", makeEntry());
    await deleteRecord("foods", uuid(1));
    expect(calls).toEqual([["entries"], ["foods"]]);
    await vi.waitFor(() => {
      expect(seenInListener?.id).toBe(uuid(100));
    });
  });

  test("does not fire when a write fails", async () => {
    const calls = recordChanges();
    // A record without its primary key cannot be stored.
    const broken = { name: "x" } as unknown as ReturnType<typeof makeFood>;
    await expect(saveRecord("foods", broken)).rejects.toThrow();
    expect(calls).toEqual([]);
  });

  test("unsubscribe stops notifications", async () => {
    const calls: unknown[] = [];
    const unsubscribe = onDataChanged((tables) => calls.push(tables));
    unsubscribe();
    await saveRecord("foods", makeFood());
    expect(calls).toEqual([]);
  });

  test("a throwing listener neither fails the write nor stops other listeners", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    unsubscribers.push(
      onDataChanged(() => {
        throw new Error("broken screen");
      }),
    );
    const calls = recordChanges();
    await expect(saveRecord("foods", makeFood())).resolves.toBeUndefined();
    expect(calls).toEqual([["foods"]]);
  });
});

describe("saveRecords", () => {
  test("writes several tables in one go and notifies once", async () => {
    const calls = recordChanges();
    await saveRecords({
      foods: [makeFood(), makeFood({ id: uuid(2) })],
      entries: [makeEntry()],
      settings: [{ key: "energyUnit", value: "kJ" }],
      goals: [],
    });
    expect(await db.foods.count()).toBe(2);
    expect(await db.entries.count()).toBe(1);
    expect(await db.settings.count()).toBe(1);
    expect(calls).toHaveLength(1);
    expect([...(calls[0] ?? [])].sort()).toEqual(["entries", "foods", "settings"]);
  });

  test("an empty batch writes nothing and notifies nobody", async () => {
    const calls = recordChanges();
    await saveRecords({});
    await saveRecords({ foods: [] });
    expect(calls).toEqual([]);
  });

  test("is all-or-nothing: one bad record stores nothing", async () => {
    const calls = recordChanges();
    const broken = { name: "no id" } as unknown as Entry;
    await expect(
      saveRecords({ foods: [makeFood()], entries: [makeEntry(), broken] }),
    ).rejects.toThrow();
    expect(await db.foods.count()).toBe(0);
    expect(await db.entries.count()).toBe(0);
    expect(calls).toEqual([]);
  });
});
