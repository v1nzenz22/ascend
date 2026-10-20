import { beforeEach, describe, expect, test } from "vitest";
import { importBackup, readAllForBackup } from "../../src/db/backup";
import { db } from "../../src/db/db";
import type { SettingRow } from "../../src/db/types";
import { buildBackup, parseBackup, type BackupData } from "../../src/domain/backup-format";
import { makeEntry, makeFood, resetDatabase, uuid } from "./data-helpers";

beforeEach(resetDatabase);

const OLD = "2026-10-01T08:00:00.000Z";
const NEW = "2026-10-10T08:00:00.000Z";

function data(overrides: Partial<BackupData> = {}): BackupData {
  return { foods: [], entries: [], goals: [], settings: [], ...overrides };
}

describe("readAllForBackup", () => {
  test("returns every table and skips broken settings rows", async () => {
    await db.foods.add(makeFood());
    await db.entries.add(makeEntry());
    await db.goals.add({ validFrom: "2026-10-01", kcal: 2000, updatedAt: OLD });
    await db.settings.bulkPut([
      { key: "theme", value: "dark" },
      { key: "energyUnit", value: "joule" } as unknown as SettingRow,
    ]);
    expect(await readAllForBackup()).toEqual({
      foods: [makeFood()],
      entries: [makeEntry()],
      goals: [{ validFrom: "2026-10-01", kcal: 2000, updatedAt: OLD }],
      settings: [{ key: "theme", value: "dark" }],
    });
  });

  test("an export parses back into the same data", async () => {
    await db.foods.add(makeFood());
    await db.entries.add(makeEntry({ portionLabel: "1 Becher" }));
    await db.goals.add({ validFrom: "2026-10-01", kcal: 2000, protein: 100, updatedAt: OLD });
    await db.settings.put({ key: "goalsIntroDismissed", value: true });
    const exported = await readAllForBackup();
    const parsed = parseBackup(buildBackup(exported, new Date(NEW)));
    expect(parsed).toEqual({ ok: true, data: exported });
  });
});

describe("importBackup (merge)", () => {
  test("adds records that do not exist yet", async () => {
    const result = await importBackup(
      data({
        foods: [makeFood()],
        entries: [makeEntry()],
        goals: [{ validFrom: "2026-10-01", kcal: 2000, updatedAt: OLD }],
        settings: [{ key: "energyUnit", value: "kJ" }],
      }),
    );
    expect(result).toEqual({ foods: 1, entries: 1, goals: 1, settings: 1 });
    expect(await db.foods.get(uuid(1))).toEqual(makeFood());
    expect(await db.settings.get("energyUnit")).toEqual({ key: "energyUnit", value: "kJ" });
  });

  test("the newer updatedAt wins, in both directions", async () => {
    await db.foods.bulkAdd([
      makeFood({ id: uuid(1), name: "Lokal alt", updatedAt: OLD }),
      makeFood({ id: uuid(2), name: "Lokal neu", updatedAt: NEW }),
    ]);
    const result = await importBackup(
      data({
        foods: [
          makeFood({ id: uuid(1), name: "Datei neu", updatedAt: NEW }),
          makeFood({ id: uuid(2), name: "Datei alt", updatedAt: OLD }),
        ],
      }),
    );
    expect(result.foods).toBe(1);
    expect((await db.foods.get(uuid(1)))?.name).toBe("Datei neu");
    expect((await db.foods.get(uuid(2)))?.name).toBe("Lokal neu");
  });

  test("compares timestamps as instants, not as text", async () => {
    // As text, "…00.500Z" sorts before "…00Z", although it is later.
    await db.entries.add(makeEntry({ amount: 1, updatedAt: "2026-10-10T08:00:00Z" }));
    await importBackup(
      data({ entries: [makeEntry({ amount: 2, updatedAt: "2026-10-10T08:00:00.500Z" })] }),
    );
    expect((await db.entries.get(uuid(100)))?.amount).toBe(2);
  });

  test("never deletes local records missing from the file", async () => {
    await db.foods.add(makeFood({ id: uuid(9) }));
    await db.entries.add(makeEntry({ id: uuid(99) }));
    await importBackup(data({ foods: [makeFood()] }));
    expect(await db.foods.count()).toBe(2);
    expect(await db.entries.count()).toBe(1);
  });

  test("settings: the file's value wins; unchanged values are not counted", async () => {
    await db.settings.bulkPut([
      { key: "energyUnit", value: "kcal" },
      { key: "theme", value: "dark" },
    ]);
    const result = await importBackup(
      data({
        settings: [
          { key: "energyUnit", value: "kJ" },
          { key: "theme", value: "dark" },
        ],
      }),
    );
    expect(result.settings).toBe(1);
    expect((await db.settings.get("energyUnit"))?.value).toBe("kJ");
  });

  test("importing the same file twice changes nothing the second time", async () => {
    const file = data({
      foods: [makeFood()],
      entries: [makeEntry()],
      goals: [{ validFrom: "2026-10-01", kcal: 2000, updatedAt: OLD }],
      settings: [{ key: "theme", value: "light" }],
    });
    await importBackup(file);
    const before = await readAllForBackup();
    expect(await importBackup(file)).toEqual({ foods: 0, entries: 0, goals: 0, settings: 0 });
    expect(await readAllForBackup()).toEqual(before);
  });

  test("a failed write stores nothing at all", async () => {
    const broken = { name: "no id" } as unknown as ReturnType<typeof makeEntry>;
    await expect(
      importBackup(data({ foods: [makeFood()], entries: [makeEntry(), broken] })),
    ).rejects.toThrow();
    expect(await db.foods.count()).toBe(0);
    expect(await db.entries.count()).toBe(0);
  });

  test("goals stay empty when the file has none", async () => {
    await importBackup(data({ foods: [makeFood()] }));
    expect(await db.goals.count()).toBe(0);
  });
});
