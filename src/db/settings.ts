// Typed access to the key-value `settings` table.
//
// Defaults are display preferences only. They are never written to the
// database: a row exists only once the user changes a setting. Goals are
// never settings (they have their own table and no defaults at all).
import { db } from "./db";
import type { SettingsMap } from "./types";

export const DEFAULT_SETTINGS: Readonly<SettingsMap> = { energyUnit: "kcal" };

/**
 * One check per setting: is a stored value really of the right type?
 * TypeScript only checks our own code. A row may still hold something else
 * (an old app version, a broken import, edits in the developer tools), and
 * the app should then use the default instead of misbehaving. The mapped
 * type makes a new setting without a check a type error.
 */
const IS_VALID: { [K in keyof SettingsMap]: (value: unknown) => value is SettingsMap[K] } = {
  energyUnit: (value): value is SettingsMap["energyUnit"] => value === "kcal" || value === "kJ",
};

/**
 * The stored value for `key`, or its default if the user never changed it
 * or the stored value is invalid.
 */
export async function getSetting<K extends keyof SettingsMap>(key: K): Promise<SettingsMap[K]> {
  // Read as `unknown`: the row comes from storage, not from checked code.
  const row: { value: unknown } | undefined = await db.settings.get(key);
  if (row !== undefined && IS_VALID[key](row.value)) return row.value;
  return DEFAULT_SETTINGS[key];
}

/** Stores `value` for `key` (insert or overwrite). */
export async function setSetting<K extends keyof SettingsMap>(
  key: K,
  value: SettingsMap[K],
): Promise<void> {
  await db.settings.put({ key, value });
}
