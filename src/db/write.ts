// The single place where the app writes to the database.
//
// Why one module: in a later phase (sync), every change must also be noted
// in an "outbox" table inside the same transaction. If all writes go through
// here, that change touches only this file. Screens also learn about changes
// from here (`onDataChanged`) instead of every action re-rendering by hand.
//
// Enforced by an ESLint rule (only `src/db/` may import `db`) and by
// tests/unit/write-boundary.test.ts (no other `src/db/` module writes).
import type { Table } from "dexie";
import { db } from "./db";
import type { Entry, Food, Goal, SettingKey, SettingRow } from "./types";
import type { LocalDate } from "../lib/local-date";

export type TableName = "foods" | "entries" | "goals" | "settings";

interface RecordByTable {
  foods: Food;
  entries: Entry;
  goals: Goal;
  settings: SettingRow;
}

interface KeyByTable {
  foods: string;
  entries: string;
  goals: LocalDate;
  settings: SettingKey;
}

export type RecordBatch = Partial<{ [T in TableName]: RecordByTable[T][] }>;

type Listener = (tables: readonly TableName[]) => void;

const listeners = new Set<Listener>();

/** The typed Dexie table for `table`. */
function tableOf<T extends TableName>(table: T): Table<RecordByTable[T], KeyByTable[T]> {
  return db.table<RecordByTable[T], KeyByTable[T]>(table);
}

/** Tells every listener which tables changed. Runs after the commit. */
function notify(tables: readonly TableName[]): void {
  for (const listener of listeners) {
    try {
      listener(tables);
    } catch (error: unknown) {
      // A broken listener (e.g. a screen that fails to re-render) must not
      // turn a successful save into an error, nor stop the other listeners.
      // Logged to the local console only, never reported (zero telemetry).
      console.error(error);
    }
  }
}

/** Inserts or overwrites one record. */
export async function saveRecord<T extends TableName>(
  table: T,
  record: RecordByTable[T],
): Promise<void> {
  const target = tableOf(table);
  // An explicit transaction, although one write would not need it: the
  // sync phase adds the outbox row inside this same transaction.
  await db.transaction("rw", target, async () => {
    await target.put(record);
  });
  notify([table]);
}

/** Deletes one record by primary key (no error if it does not exist). */
export async function deleteRecord<T extends TableName>(
  table: T,
  key: KeyByTable[T],
): Promise<void> {
  const target = tableOf(table);
  await db.transaction("rw", target, async () => {
    await target.delete(key);
  });
  notify([table]);
}

/**
 * Saves many records of several tables in ONE transaction (backup import):
 * either everything is stored or, if anything fails, nothing is.
 * An empty batch writes nothing and notifies nobody.
 */
export async function saveRecords(batch: RecordBatch): Promise<void> {
  // `Object.keys` loses the key type; the batch type only allows table names.
  const tables = (Object.keys(batch) as TableName[]).filter(
    (table) => (batch[table]?.length ?? 0) > 0,
  );
  if (tables.length === 0) return;
  await db.transaction(
    "rw",
    tables.map((table) => db.table(table)),
    async () => {
      // One call per table, written out so the types stay exact.
      if (batch.foods?.length) await tableOf("foods").bulkPut(batch.foods);
      if (batch.entries?.length) await tableOf("entries").bulkPut(batch.entries);
      if (batch.goals?.length) await tableOf("goals").bulkPut(batch.goals);
      if (batch.settings?.length) await tableOf("settings").bulkPut(batch.settings);
    },
  );
  notify(tables);
}

/**
 * Calls `listener` after every successful write, with the changed tables.
 * Not called when a write fails. Returns a function that unsubscribes.
 */
export function onDataChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
