// Reading everything for an export, and merging a checked backup into the
// database. File format and checks: src/domain/backup-format.ts.
import { db } from "./db";
import type { SettingRow } from "./types";
import { saveRecords, type TableName } from "./write";
import type { BackupData } from "../domain/backup-format";
import { SETTING_VALIDATORS } from "../domain/limits";

/** How many records of each table the import wrote (new or newer). */
export type ImportResult = Record<TableName, number>;

/** Every record of the four tables, for the JSON export. */
export async function readAllForBackup(): Promise<BackupData> {
  const [foods, entries, goals, settings] = await Promise.all([
    db.foods.toArray(),
    db.entries.toArray(),
    db.goals.toArray(),
    db.settings.toArray(),
  ]);
  return {
    foods,
    entries,
    goals,
    // A broken settings row (e.g. edited in the developer tools) would make
    // the whole file fail its import check, so only valid rows are exported.
    settings: settings.filter((row) => SETTING_VALIDATORS[row.key](row.value)),
  };
}

/** True if `incoming` should replace `existing`: it was changed later. */
function isNewer(incoming: { updatedAt: string }, existing?: { updatedAt: string }): boolean {
  // Compared as instants, not as text: "…:00Z" and "…:00.500Z" do not sort
  // correctly as strings.
  return existing === undefined || Date.parse(incoming.updatedAt) > Date.parse(existing.updatedAt);
}

/**
 * Merges checked backup `data` (from `parseBackup`) into the database:
 * - a record that does not exist yet is added;
 * - an existing record is replaced only if the file's `updatedAt` is newer;
 * - nothing is ever deleted;
 * - settings have no `updatedAt`: the file's value wins.
 * Importing the same file twice therefore changes nothing the second time.
 * All changes are written in one transaction: all or nothing.
 */
export async function importBackup(data: BackupData): Promise<ImportResult> {
  const [foods, entries, goals, settings] = await Promise.all([
    db.foods.bulkGet(data.foods.map((food) => food.id)),
    db.entries.bulkGet(data.entries.map((entry) => entry.id)),
    db.goals.bulkGet(data.goals.map((goal) => goal.validFrom)),
    db.settings.bulkGet(data.settings.map((row) => row.key)),
  ]);

  const batch = {
    foods: data.foods.filter((food, i) => isNewer(food, foods[i])),
    entries: data.entries.filter((entry, i) => isNewer(entry, entries[i])),
    goals: data.goals.filter((goal, i) => isNewer(goal, goals[i])),
    // Unchanged values are skipped so a repeated import reports 0.
    settings: data.settings.filter((row: SettingRow, i) => settings[i]?.value !== row.value),
  };
  await saveRecords(batch);
  return {
    foods: batch.foods.length,
    entries: batch.entries.length,
    goals: batch.goals.length,
    settings: batch.settings.length,
  };
}
