// Service worker registration and the "new version available" prompt.
//
// How updates work: when we deploy, the browser finds a changed sw.js. The
// new service worker downloads the new app in the background and then
// *waits*. It does not take over by itself, because swapping the app while
// someone types a goal could lose the input or break lazy-loaded pages.
// Instead this module tells the UI "an update is ready"; the UI shows a
// toast "Neue Version verfügbar" with a "Neu laden" button that calls
// `reloadToUpdate()`.
//
// This module has no UI of its own, so it stays easy to test. Wiring (in
// main.ts):
//
//   startUpdateWatch();
//   onUpdateAvailable(() => showToast(t("update.available"), {
//     action: { label: t("update.reload"), onClick: () => void reloadToUpdate() },
//   }));
import { registerSW } from "virtual:pwa-register";

type Listener = () => void;

const listeners = new Set<Listener>();

/** True once the UI should offer a reload. */
let updateAvailable = false;

/** True when a new service worker is installed and waiting for permission. */
let workerWaiting = false;

/**
 * Tells the waiting service worker to take over; the page then reloads
 * itself. Set by `startUpdateWatch`.
 */
let activateWaitingWorker: (() => Promise<void>) | undefined;

/**
 * Registers the service worker (once) and starts watching for new versions.
 * Safe to call more than once.
 */
export function startUpdateWatch(): void {
  if (activateWaitingWorker !== undefined) return;
  const update = registerSW({
    onNeedRefresh() {
      workerWaiting = true;
      announceUpdate();
    },
    onRegisteredSW(_scriptUrl, registration) {
      if (registration !== undefined) checkWhenVisible(registration);
    },
    onRegisterError(error: unknown) {
      // Only the local console, never reported anywhere (zero telemetry).
      console.error(error);
    },
  });
  // registerSW's parameter (reloadPage) is ignored since vite-plugin-pwa
  // 0.13.2; the page reloads by itself once the new worker controls it.
  activateWaitingWorker = () => update();
}

/**
 * Home-screen apps on the iPhone are often only brought back to the front,
 * never really reloaded, so the browser rarely looks for a new sw.js. We ask
 * it to check whenever the app becomes visible. This fetches only our own
 * sw.js, never anything from another site.
 */
function checkWhenVisible(registration: ServiceWorkerRegistration): void {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    // Offline or server unreachable: nothing to do, the next check retries.
    registration.update().catch(() => undefined);
  });
}

/** Tells every listener (at most once) that a new version is ready. */
function announceUpdate(): void {
  if (updateAvailable) return;
  updateAvailable = true;
  for (const listener of listeners) listener();
}

/**
 * Calls `listener` when a new version is available. If that already
 * happened, it is called right away, so a late subscriber does not miss it.
 * Returns a function that removes the listener.
 */
export function onUpdateAvailable(listener: Listener): () => void {
  listeners.add(listener);
  if (updateAvailable) listener();
  return () => {
    listeners.delete(listener);
  };
}

/** Whether a new version is waiting (e.g. for a hint in the settings). */
export function isUpdateAvailable(): boolean {
  return updateAvailable;
}

/**
 * For the router: a lazily loaded page failed to load. Usually this means
 * the server already has a newer version and the old file is gone, so the
 * user gets the same "Neu laden" offer.
 */
export function reportStaleVersion(): void {
  announceUpdate();
}

/**
 * Switches to the new version. With a waiting service worker it takes over
 * and the page reloads itself; otherwise a plain reload fetches the newest
 * files.
 */
export async function reloadToUpdate(): Promise<void> {
  if (workerWaiting && activateWaitingWorker !== undefined) {
    await activateWaitingWorker();
  } else {
    window.location.reload();
  }
}
