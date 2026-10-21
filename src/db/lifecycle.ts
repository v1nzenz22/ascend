// Opening the database and reacting when another tab upgrades it.
//
// IndexedDB allows only one schema version at a time. When a newer app
// version opens the database in another tab, this tab must close its
// connection (or the upgrade waits forever) and ask the user to reload.
import { db } from "./db";

export type ReloadReason = "versionchange" | "blocked";

/**
 * Opens the local database. Kept here so code outside `src/db/` never
 * needs the `db` object itself (see the ESLint rule in eslint.config.js).
 */
export async function openDatabase(): Promise<void> {
  await db.open();
}

/**
 * Calls `onNeedsReload` when
 * - 'versionchange': another tab opened a newer schema. This connection is
 *   closed first so the other tab can finish its upgrade.
 * - 'blocked': our own upgrade waits because an old tab keeps the database
 *   open.
 * Returns a function that stops watching.
 */
export function watchDatabaseLifecycle(onNeedsReload: (reason: ReloadReason) => void): () => void {
  const onVersionChange = (): void => {
    // Dexie also closes on its own, but with "auto reopen" enabled: the next
    // read would quietly open the database again (and block the upgrade
    // again). Our explicit close disables that, and makes the step visible.
    db.close();
    onNeedsReload("versionchange");
  };
  const onBlocked = (): void => {
    onNeedsReload("blocked");
  };
  db.on("versionchange", onVersionChange);
  db.on("blocked", onBlocked);
  return () => {
    db.on("versionchange").unsubscribe(onVersionChange);
    db.on("blocked").unsubscribe(onBlocked);
  };
}
