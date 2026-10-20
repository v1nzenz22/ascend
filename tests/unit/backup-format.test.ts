import { describe, expect, test } from "vitest";
import { db } from "../../src/db/db";
import {
  backupFileName,
  buildBackup,
  isBackupSizeOk,
  MAX_BACKUP_BYTES,
  parseBackup,
  SCHEMA_VERSION,
  type BackupData,
  type ParseResult,
} from "../../src/domain/backup-format";
import { makeEntry, makeFood, uuid } from "./data-helpers";

const NOW = new Date("2026-10-20T18:00:00.000Z");

function sample(): BackupData {
  return {
    foods: [makeFood()],
    entries: [makeEntry({ portionLabel: "1 Becher" })],
    goals: [
      { validFrom: "2026-10-01", kcal: 2000, fat: 70, updatedAt: "2026-10-01T08:00:00.000Z" },
    ],
    settings: [
      { key: "energyUnit", value: "kJ" },
      { key: "goalsIntroDismissed", value: true },
    ],
  };
}

/** The sample as a parsed JSON object, ready to be broken by a test. */
function sampleFile(): Record<string, unknown> {
  return JSON.parse(buildBackup(sample(), NOW)) as Record<string, unknown>;
}

function parseObject(file: unknown): ParseResult {
  return parseBackup(JSON.stringify(file));
}

/** Parses `sampleFile()` with one record of `table` replaced by `record`. */
function parseWithRecord(table: keyof BackupData, record: unknown): ParseResult {
  const file = sampleFile();
  file[table] = [record];
  return parseObject(file);
}

function errorOf(result: ParseResult): unknown {
  return result.ok ? null : result.error;
}

describe("buildBackup", () => {
  test("writes the header and the four tables as readable JSON", () => {
    const text = buildBackup(sample(), NOW);
    expect(text).toContain('\n  "app": "ascend"');
    expect(JSON.parse(text)).toEqual({
      app: "ascend",
      format: 1,
      schemaVersion: 1,
      exportedAt: "2026-10-20T18:00:00.000Z",
      ...sample(),
    });
  });

  test("names the file after the local day", () => {
    expect(backupFileName("2026-10-20")).toBe("ascend-backup-2026-10-20.json");
  });

  test("the schema version matches the database", () => {
    expect(SCHEMA_VERSION).toBe(db.verno);
  });
});

describe("parseBackup", () => {
  test("round trip: an export parses back into the same data", () => {
    expect(parseBackup(buildBackup(sample(), NOW))).toEqual({ ok: true, data: sample() });
  });

  test("too large", () => {
    expect(isBackupSizeOk(MAX_BACKUP_BYTES)).toBe(true);
    expect(isBackupSizeOk(MAX_BACKUP_BYTES + 1)).toBe(false);
    expect(errorOf(parseBackup(" ".repeat(MAX_BACKUP_BYTES + 1)))).toEqual({ code: "tooLarge" });
  });

  test("too many records", () => {
    const file = sampleFile();
    file.settings = Array.from({ length: 101 }, () => ({ key: "theme", value: "dark" }));
    expect(errorOf(parseObject(file))).toEqual({ code: "tooLarge" });
  });

  test("not JSON", () => {
    for (const text of ["", "{", "ascend", "{'app': 'ascend'}"]) {
      expect(errorOf(parseBackup(text))).toEqual({ code: "notJson" });
    }
  });

  test("not an ascend file", () => {
    for (const file of [[], "ascend", null, { app: "other" }, { ...sampleFile(), format: 0 }]) {
      expect(errorOf(parseObject(file))).toEqual({ code: "notAscend" });
    }
  });

  test("newer format or schema version", () => {
    expect(errorOf(parseObject({ ...sampleFile(), format: 2 }))).toEqual({ code: "newerVersion" });
    expect(errorOf(parseObject({ ...sampleFile(), schemaVersion: 2 }))).toEqual({
      code: "newerVersion",
    });
  });

  test("broken structure", () => {
    expect(errorOf(parseObject({ ...sampleFile(), schemaVersion: "1" }))).toEqual({
      code: "invalidFile",
    });
    expect(errorOf(parseObject({ ...sampleFile(), entries: {} }))).toEqual({ code: "invalidFile" });
    const withoutGoals = sampleFile();
    delete withoutGoals.goals;
    expect(errorOf(parseObject(withoutGoals))).toEqual({ code: "invalidFile" });
  });

  test("rejects __proto__, constructor and prototype keys and leaves Object.prototype alone", () => {
    const text = buildBackup(sample(), NOW);
    const attacks = [
      text.replace(
        '"name": "Haferflocken"',
        '"__proto__": { "polluted": true }, "name": "Haferflocken"',
      ),
      text.replace(
        '"app": "ascend"',
        '"app": "ascend", "constructor": { "prototype": { "polluted": true } }',
      ),
      text.replace('"kcal": 372', '"kcal": 372, "prototype": 1'),
    ];
    for (const attack of attacks) {
      expect(attack).not.toBe(text);
      expect(errorOf(parseBackup(attack))).toEqual({ code: "invalidFile" });
    }
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  test("drops unknown fields and unknown setting keys", () => {
    const file = sampleFile();
    (file.foods as Record<string, unknown>[])[0] = { ...makeFood(), secret: "x" };
    (file.entries as Record<string, unknown>[])[0] = {
      ...makeEntry(),
      snapshot: { ...makeEntry().snapshot, extra: 1, per100: { kcal: 63, vitamin: 2 } },
    };
    file.settings = [
      { key: "language", value: "en" },
      { key: "theme", value: "dark" },
    ];
    const result = parseObject(file);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.foods[0]).toEqual(makeFood());
    expect(result.data.entries[0]?.snapshot).toEqual({
      ...makeEntry().snapshot,
      per100: { kcal: 63 },
    });
    expect(result.data.settings).toEqual([{ key: "theme", value: "dark" }]);
  });

  test("null in optional fields means unknown and is left out", () => {
    const result = parseWithRecord("goals", {
      validFrom: "2026-10-01",
      kcal: 2000,
      protein: null,
      updatedAt: "2026-10-01T08:00:00Z",
    });
    expect(result).toMatchObject({ ok: true });
    if (result.ok)
      expect(result.data.goals[0]).toEqual({
        validFrom: "2026-10-01",
        kcal: 2000,
        updatedAt: "2026-10-01T08:00:00Z",
      });
  });

  test("only energy is required in nutrient values", () => {
    const food = { ...makeFood(), per100: { kcal: 40 } };
    expect(parseWithRecord("foods", food)).toEqual({
      ok: true,
      data: { ...sample(), foods: [{ ...makeFood(), per100: { kcal: 40 } }] },
    });
  });

  const invalidFoods: [string, unknown][] = [
    ["id not a UUID", { ...makeFood(), id: "food-1" }],
    ["empty name", { ...makeFood(), name: "  " }],
    ["unknown unit", { ...makeFood(), unit: "kg" }],
    ["energy too high", { ...makeFood(), per100: { kcal: 1001 } }],
    ["missing energy", { ...makeFood(), per100: { protein: 3 } }],
    ["bad barcode", { ...makeFood(), barcode: "12ab" }],
    ["bad source", { ...makeFood(), source: "web" }],
    ["bad timestamp", { ...makeFood(), updatedAt: "2026-10-20 08:00" }],
    ["impossible day in timestamp", { ...makeFood(), createdAt: "2026-02-30T08:00:00Z" }],
    ["not an object", "Haferflocken"],
  ];
  for (const [label, food] of invalidFoods) {
    test(`invalid food: ${label}`, () => {
      expect(errorOf(parseWithRecord("foods", food))).toEqual({
        code: "invalidRecord",
        table: "foods",
        index: 0,
      });
    });
  }

  const invalidEntries: [string, unknown][] = [
    ["impossible date", { ...makeEntry(), date: "2026-02-30" }],
    ["missing meal", { ...makeEntry(), meal: undefined }],
    ["unknown meal", { ...makeEntry(), meal: "brunch" }],
    ["missing time-zone offset", { ...makeEntry(), loggedTzOffset: undefined }],
    ["time-zone offset out of range", { ...makeEntry(), loggedTzOffset: 900 }],
    ["amount 0", { ...makeEntry(), amount: 0 }],
    ["amount as text", { ...makeEntry(), amount: "100" }],
    ["foodId not a UUID", { ...makeEntry(), foodId: "food-1" }],
    ["snapshot without name", { ...makeEntry(), snapshot: { unit: "g", per100: { kcal: 1 } } }],
    ["label too long", { ...makeEntry(), portionLabel: "x".repeat(101) }],
  ];
  for (const [label, entry] of invalidEntries) {
    test(`invalid entry: ${label}`, () => {
      expect(errorOf(parseWithRecord("entries", entry))).toEqual({
        code: "invalidRecord",
        table: "entries",
        index: 0,
      });
    });
  }

  test("invalid goals and settings", () => {
    const goal = { validFrom: "2026-10-01", updatedAt: "2026-10-01T08:00:00Z" };
    expect(errorOf(parseWithRecord("goals", { ...goal, kcal: 0 }))).toMatchObject({
      table: "goals",
    });
    expect(errorOf(parseWithRecord("goals", { ...goal, fat: 2001 }))).toMatchObject({
      table: "goals",
    });
    expect(errorOf(parseWithRecord("goals", { ...goal, validFrom: "20.10.2026" }))).toMatchObject({
      table: "goals",
    });
    expect(errorOf(parseWithRecord("settings", { key: "theme", value: "blue" }))).toEqual({
      code: "invalidRecord",
      table: "settings",
      index: 0,
    });
  });

  test("duplicate primary keys are an error with the position of the second", () => {
    const file = sampleFile();
    file.entries = [makeEntry(), makeEntry({ id: uuid(101) }), makeEntry()];
    expect(errorOf(parseObject(file))).toEqual({
      code: "invalidRecord",
      table: "entries",
      index: 2,
    });
    const goals = sampleFile();
    const goal = { validFrom: "2026-10-01", updatedAt: "2026-10-01T08:00:00Z" };
    goals.goals = [goal, goal];
    expect(errorOf(parseObject(goals))).toEqual({
      code: "invalidRecord",
      table: "goals",
      index: 1,
    });
  });
});
