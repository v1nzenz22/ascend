// The user's display preferences (energy unit, appearance), kept in memory.
//
// Many functions format energy values, often several hundred times per
// screen. Reading the setting from IndexedDB each time would make all of
// them asynchronous. Instead the values are read once at start and again
// whenever the settings table changes; everything else reads them
// synchronously from here.
import type { EnergyUnit } from "../i18n/format";
import { getSetting } from "../db/settings";
import { onDataChanged, type TableName } from "../db/write";
import { applyTheme, type Theme } from "./theme";

let currentEnergyUnit: EnergyUnit = "kcal";
let currentTheme: Theme = "system";

type Listener = (tables: readonly TableName[]) => void;
const listeners = new Set<Listener>();
let unsubscribe: (() => void) | undefined;

async function read(): Promise<void> {
  const [energyUnit, theme] = await Promise.all([getSetting("energyUnit"), getSetting("theme")]);
  currentEnergyUnit = energyUnit;
  if (theme !== currentTheme) {
    currentTheme = theme;
    applyTheme(theme);
  }
}

/**
 * Reads the preferences and applies the theme. Call once, after the
 * database is open and **before** the shell is shown, so the page never
 * flashes in the wrong theme.
 */
export async function loadPreferences(): Promise<void> {
  await read();
  // Applied once even for "system": the meta theme-color tags in index.html
  // may hold an older colour.
  applyTheme(currentTheme);

  unsubscribe ??= onDataChanged((tables) => {
    // A settings write may change the unit or the theme: re-read first, so
    // pages that re-render after this already see the new values.
    const ready = tables.includes("settings") ? read() : Promise.resolve();
    void ready
      .catch((error: unknown) => {
        // Only the local console (zero telemetry). The old values stay.
        console.error(error);
      })
      .then(() => {
        for (const listener of listeners) listener(tables);
      });
  });
}

/** The energy unit the user chose ("kcal" by default). */
export function energyUnit(): EnergyUnit {
  return currentEnergyUnit;
}

/** The appearance the user chose ("system" by default). */
export function theme(): Theme {
  return currentTheme;
}

/**
 * Like `onDataChanged` from src/db/write.ts, but called only after the
 * preferences above are up to date. The router uses this to re-render pages,
 * so a page never re-renders with the old energy unit.
 */
export function onAppDataChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
