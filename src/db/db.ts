// The local database. Everything the user enters lives here, on the device
// only (IndexedDB via Dexie). No account, no sync, no server.
//
// Migration rules for every future schema change:
// 1. Never edit `version(1)` once released. Add `db.version(2).stores({…})`
//    listing only the changed tables, plus `.upgrade(tx => …)` if existing
//    data must change. Keep all old version blocks here as history.
// 2. Adding an *unindexed* field needs no new version; code must accept
//    records without it (make it optional in the type).
// 3. Write data transformations as pure functions (e.g.
//    `migrateEntryV1toV2(entry)`), called from the Dexie upgrade *and* from
//    the JSON import, so old backups can still be restored.
// 4. Every migration gets a test: create a v1 database in fake-indexeddb,
//    put v1 data in, open it with the new schema, check the data.
import { Dexie, type EntityTable } from "dexie";
import type { Entry, Food, Goal, SettingRow } from "./types";

export const DB_NAME = "ascend";

export type AscendDb = Dexie & {
  foods: EntityTable<Food, "id">;
  entries: EntityTable<Entry, "id">;
  goals: EntityTable<Goal, "validFrom">;
  settings: EntityTable<SettingRow, "key">;
};

export const db = new Dexie(DB_NAME) as AscendDb;

// Only *indexed* fields are listed; all other fields are stored anyway.
// The first name in each string is the primary key.
db.version(1).stores({
  foods: "id, name, barcode, updatedAt",
  entries: "id, date, foodId, updatedAt",
  goals: "validFrom",
  settings: "key",
});
