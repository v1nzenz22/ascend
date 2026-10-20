// Typed access to the key-value `settings` table.
//
// Defaults are display preferences only. They are never written to the
// database: a row exists only once the user changes a setting. Goals are
// never settings (they have their own table and no defaults at all).
import { db } from "./db";
import type { SettingsMap } from "./types";
import { saveRecord } from "./write";
import { SETTING_VALIDATORS } from "../domain/limits";

export const DEFAULT_SETTINGS: Readonly<SettingsMap> = {
  energyUnit: "kcal",
  theme: "system",
  goalsIntroDismissed: false,
};

/**
 * The stored value for `key`, or its default if the user never changed it
 * or the stored value is invalid. Why check at all: TypeScript only checks
 * our own code. A row may still hold something else (an old app version,
 * edits in the developer tools), and the app should then use the default
 * instead of misbehaving.
 */
export async function getSetting<K extends keyof SettingsMap>(key: K): Promise<SettingsMap[K]> {
  // Read as `unknown`: the row comes from storage, not from checked code.
  const row: { value: unknown } | undefined = await db.settings.get(key);
  if (row !== undefined && SETTING_VALIDATORS[key](row.value)) return row.value;
  return DEFAULT_SETTINGS[key];
}

/** Stores `value` for `key` (insert or overwrite). */
export async function setSetting<K extends keyof SettingsMap>(
  key: K,
  value: SettingsMap[K],
): Promise<void> {
  if (!SETTING_VALIDATORS[key](value)) throw new RangeError(`Invalid value for setting ${key}`);
  await saveRecord("settings", { key, value });
}
