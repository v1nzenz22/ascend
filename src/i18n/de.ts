// German messages: the source of truth for every text in the app.
//
// Keys are flat strings with dots ("nav.today") instead of nested objects,
// so `keyof typeof de` is a simple union of all keys and TypeScript rejects
// any key that does not exist here. Future languages are typed as
// `Record<MessageKey, string>`, so a missing translation is a type error.
//
// The texts live in one file per area (./messages/*.ts), so screens built in
// parallel never edit the same file. This file only joins them. A key that
// appears in two files would silently win here; tests/unit/i18n.test.ts
// fails in that case.
//
// Placeholders look like {name} and are filled in by `t()`.
import { add } from "./messages/add";
import { common } from "./messages/common";
import { dashboard } from "./messages/dashboard";
import { goals } from "./messages/goals";
import { kit } from "./messages/kit";
import { settings } from "./messages/settings";
import { today } from "./messages/today";

/** Every message file, by name (used by the duplicate-key test). */
export const MESSAGE_FILES = { common, today, add, goals, settings, dashboard, kit } as const;

export const de = {
  ...common,
  ...today,
  ...add,
  ...goals,
  ...settings,
  ...dashboard,
  ...kit,
} as const;

/** Every valid message key. Unknown keys fail type-checking. */
export type MessageKey = keyof typeof de;
