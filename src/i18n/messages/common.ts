// Shared German messages: app frame, navigation, buttons and form errors
// that several screens use. Owned by the app frame; feature screens keep
// their own texts in the other files of this folder.
//
// Keys are flat strings with dots; see ../de.ts for why.

export const common = {
  "app.name": "ascend",
  "app.description": "Kalorien und Nährwerte erfassen – offline und ohne Tracking.",

  "nav.label": "Hauptnavigation",
  "nav.today": "Heute",
  "nav.add": "Hinzufügen",
  "nav.goals": "Ziele",
  "nav.settings": "Einstellungen",

  "shell.skipToContent": "Zum Inhalt springen",
  "shell.notifications": "Mitteilungen",

  // Temporary text of the pages that are built in later work packages.
  "placeholder.text": "Diese Seite entsteht gerade.",

  // Generic button labels.
  "action.cancel": "Abbrechen",
  "action.close": "Schließen",
  "action.save": "Speichern",
  "action.delete": "Löschen",
  "action.edit": "Bearbeiten",
  "action.reload": "Neu laden",

  // Shown instead of a number that is unknown or invalid (an en dash).
  "number.unknown": "–",
  "unit.kcal": "kcal",
  "unit.kJ": "kJ",
  "unit.g": "g",
  "unit.ml": "ml",

  "meal.breakfast": "Frühstück",
  "meal.lunch": "Mittagessen",
  "meal.dinner": "Abendessen",
  "meal.snacks": "Snacks",

  // Form validation. {min}/{max} arrive already formatted ("1.000").
  "field.required": "Bitte einen Wert eingeben.",
  "field.tooLong": "Bitte höchstens {max} Zeichen eingeben.",
  "field.notANumber": "Bitte eine Zahl eingeben, z. B. 12,5.",
  "field.belowMin": "Bitte eine Zahl ab {min} eingeben.",
  "field.notAboveMin": "Bitte eine Zahl größer als {min} eingeben.",
  "field.aboveMax": "Bitte eine Zahl bis {max} eingeben.",

  // A route with an id that does not exist (deleted food, old link).
  "notFound.title": "Nicht gefunden",
  "notFound.text": "Diesen Eintrag gibt es auf diesem Gerät nicht (mehr).",
  "notFound.back": "Zurück zu Heute",

  // A page whose code could not be loaded (usually: an update replaced it).
  "error.pageTitle": "Seite nicht verfügbar",
  "error.pageLoad":
    "Diese Seite konnte nicht geladen werden. Vermutlich gibt es eine neue Version – bitte lade ascend neu.",
  "error.dbUnavailable":
    "Die lokale Datenbank konnte nicht geöffnet werden. Bitte prüfe, ob dein Browser Websitedaten speichern darf, und lade die Seite neu.",

  // Service worker update prompt (src/app/update.ts) and database lifecycle
  // notices (src/db/lifecycle.ts, wired in main.ts).
  "update.available": "Neue Version verfügbar",
  "update.reload": "Neu laden",
  "lifecycle.versionchange":
    "ascend wurde in einem anderen Tab aktualisiert. Bitte lade diese Seite neu.",
  "lifecycle.blocked":
    "Bitte schließe andere ascend-Tabs, damit die Aktualisierung abgeschlossen werden kann.",
} as const;
