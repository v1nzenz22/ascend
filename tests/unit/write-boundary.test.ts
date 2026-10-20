// Checks the write boundary inside the data layer: apart from write.ts (and
// db.ts, which defines the schema), no module in src/db/ may call a Dexie
// write method. The ESLint rule already keeps `db` out of the rest of src/.
//
// `import.meta.glob` with `?raw` gives each file's source text at build
// time, without Node's file system API.
import { describe, expect, test } from "vitest";

const sources = import.meta.glob<string>("../../src/db/*.ts", {
  query: "?raw",
  import: "default",
  eager: true,
});

const ALLOWED = ["write.ts", "db.ts"];
const WRITE_CALL = /\.(add|put|bulkAdd|bulkPut|update|delete|bulkDelete|clear|modify)\(/;

describe("write boundary", () => {
  test("finds the data-layer modules", () => {
    const names = Object.keys(sources).map((path) => path.split("/").pop());
    expect(names).toEqual(expect.arrayContaining(["write.ts", "entries.ts", "foods.ts"]));
  });

  test("the pattern catches a write call", () => {
    expect(WRITE_CALL.test("await db.entries.put(entry)")).toBe(true);
    expect(WRITE_CALL.test("await saveRecord('entries', entry)")).toBe(false);
  });

  for (const [path, source] of Object.entries(sources)) {
    const name = path.split("/").pop() ?? path;
    if (ALLOWED.includes(name)) continue;
    test(`${name} writes only through write.ts`, () => {
      const offending = source.split("\n").filter((line) => WRITE_CALL.test(line));
      expect(offending).toEqual([]);
    });
  }
});
