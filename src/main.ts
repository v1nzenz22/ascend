// App entry point: loads the styles, opens the local database and starts
// the shell with its router.
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/layout.css";

import { mountShell, showDatabaseError } from "./app/shell";
import { startRouter } from "./app/router";
import { db } from "./db/db";
import { LANGUAGE } from "./i18n/i18n";

async function start(): Promise<void> {
  document.documentElement.lang = LANGUAGE;

  const root = document.getElementById("app");
  if (root === null) throw new Error("index.html has no #app element");

  try {
    // Opening can fail when storage is disabled, the disk is full or another
    // tab blocks an upgrade. The user then sees a message instead of an app
    // that silently loses data.
    await db.open();
  } catch (error: unknown) {
    // Only the local console, never reported anywhere (zero telemetry).
    console.error(error);
    showDatabaseError(root);
    return;
  }

  startRouter(mountShell(root));
}

void start();
