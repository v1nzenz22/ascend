// App entry point: loads the styles, opens the local database, applies the
// user's preferences and starts the shell with its router.
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/components.css";

import { loadPreferences } from "./app/preferences";
import { startRouter } from "./app/router";
import { mountShell, showDatabaseError } from "./app/shell";
import { requestPersistenceOnFirstSave } from "./app/storage";
import { onUpdateAvailable, reloadToUpdate, startUpdateWatch } from "./app/update";
import { openDatabase, watchDatabaseLifecycle, type ReloadReason } from "./db/lifecycle";
import { LANGUAGE, t } from "./i18n/i18n";
import { showToast } from "./ui/toast";

async function start(): Promise<void> {
  document.documentElement.lang = LANGUAGE;

  const root = document.getElementById("app");
  if (root === null) throw new Error("index.html has no #app element");

  // Registered before opening: "blocked" fires *during* the open, while an
  // old tab still holds the database. The toast needs the shell, so a
  // notice that comes too early is kept until the shell exists.
  // One object (not two `let`s), because TypeScript cannot see that the
  // callback below changes plain variables and would call the later check
  // "always false".
  const lifecycle: { shellReady: boolean; pending: ReloadReason | undefined } = {
    shellReady: false,
    pending: undefined,
  };
  const askToReload = (reason: ReloadReason): void => {
    showToast(t(reason === "versionchange" ? "lifecycle.versionchange" : "lifecycle.blocked"), {
      // The toast stays until the user acts, because it has a button.
      action: {
        label: t("action.reload"),
        onClick: () => {
          location.reload();
        },
      },
    });
  };
  watchDatabaseLifecycle((reason) => {
    if (lifecycle.shellReady) askToReload(reason);
    else lifecycle.pending = reason;
  });

  try {
    // Opening can fail when storage is disabled, the disk is full or another
    // tab blocks an upgrade. The user then sees a message instead of an app
    // that silently loses data.
    await openDatabase();
    // Before the shell is shown, so the page never flashes in the wrong
    // theme (only the plain background was visible until now).
    await loadPreferences();
  } catch (error: unknown) {
    // Only the local console, never reported anywhere (zero telemetry).
    console.error(error);
    showDatabaseError(root);
    return;
  }

  // Firefox asks the user; doing it right after their first save explains
  // why (their data is worth keeping).
  requestPersistenceOnFirstSave();

  startRouter(mountShell(root));
  lifecycle.shellReady = true;
  if (lifecycle.pending !== undefined) askToReload(lifecycle.pending);

  // A new app version is ready: the user decides when to switch, so a
  // half-typed form is never lost (docs/design/phase-3-core.md §9.1).
  // Subscribed after the shell exists, because the toast lives there;
  // onUpdateAvailable also reports an update that was found earlier.
  onUpdateAvailable(() => {
    showToast(t("update.available"), {
      action: {
        label: t("update.reload"),
        onClick: () => {
          void reloadToUpdate();
        },
      },
    });
  });
  startUpdateWatch();
}

void start();
