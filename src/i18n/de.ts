// German messages: the source of truth for every text in the app.
//
// Keys are flat strings with dots ("nav.today") instead of nested objects,
// so `keyof typeof de` is a simple union of all keys and TypeScript rejects
// any key that does not exist here. Future languages are typed as
// `Record<MessageKey, string>`, so a missing translation is a type error.
//
// Placeholders look like {name} and are filled in by `t()`.

export const de = {
  "app.name": "ascend",
  "app.description": "Kalorien und Nährwerte erfassen – offline, ohne Konto, ohne Tracking.",
  "nav.label": "Hauptnavigation",
  "nav.today": "Heute",
  "nav.add": "Hinzufügen",
  "nav.goals": "Ziele",
  "nav.settings": "Einstellungen",
  "shell.skipToContent": "Zum Inhalt springen",
  "placeholder.text": "Diese Seite entsteht gerade.",
  // Shown instead of a number that is unknown or invalid (an en dash).
  "number.unknown": "–",
  "unit.kcal": "kcal",
  "unit.kJ": "kJ",
  "error.dbUnavailable":
    "Die lokale Datenbank konnte nicht geöffnet werden. Bitte prüfe, ob dein Browser Websitedaten speichern darf, und lade die Seite neu.",
} as const;

/** Every valid message key. Unknown keys fail type-checking. */
export type MessageKey = keyof typeof de;
