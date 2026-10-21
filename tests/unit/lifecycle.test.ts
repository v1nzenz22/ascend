import { Dexie } from "dexie";
import { afterEach, describe, expect, test, vi } from "vitest";
import { db, DB_NAME } from "../../src/db/db";
import { openDatabase, watchDatabaseLifecycle } from "../../src/db/lifecycle";

describe("watchDatabaseLifecycle", () => {
  let other: Dexie | undefined;
  let stop: (() => void) | undefined;

  afterEach(async () => {
    stop?.();
    other?.close();
    // Remove the upgraded database so later test files start from version 1.
    await Dexie.delete(DB_NAME);
    vi.restoreAllMocks();
  });

  test("reports 'versionchange' and closes this connection when another tab upgrades", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await openDatabase();
    const reasons: string[] = [];
    stop = watchDatabaseLifecycle((reason) => reasons.push(reason));

    // A "newer app version" in another tab: same database, schema version 2.
    other = new Dexie(DB_NAME);
    other.version(2).stores({ foods: "id, name, barcode, updatedAt, source" });
    await other.open();

    expect(reasons).toEqual(["versionchange"]);
    expect(db.isOpen()).toBe(false);
  });

  test("reports 'blocked' when our upgrade waits for another tab", async () => {
    await openDatabase();
    const reasons: string[] = [];
    stop = watchDatabaseLifecycle((reason) => reasons.push(reason));
    // Our own schema is still version 1, so a real "blocked" upgrade cannot
    // happen in this test. Fire the event the way Dexie does on `onblocked`.
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    db.on("blocked").fire(new Event("blocked"));
    expect(reasons).toEqual(["blocked"]);
    expect(db.isOpen()).toBe(true);
  });

  test("stops reporting after unsubscribing", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await openDatabase();
    const reasons: string[] = [];
    watchDatabaseLifecycle((reason) => reasons.push(reason))();

    other = new Dexie(DB_NAME);
    other.version(2).stores({ foods: "id, name, barcode, updatedAt, source" });
    await other.open();
    expect(reasons).toEqual([]);
  });
});
