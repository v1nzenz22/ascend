// Asks the browser to keep the app's data even under storage pressure.
//
// Without this, browsers may delete IndexedDB data when the disk is full,
// and Safari in a normal tab deletes it after 7 days without use (home-screen
// apps are exempt). We ask once, right after the user saved their first own
// data in a session, so Firefox's permission prompt appears at a moment that
// makes sense (see requestPersistenceOnFirstSave).

import { onDataChanged } from "../db/write";

export type PersistResult = "persisted" | "not-persisted" | "unsupported";

/** `navigator.storage`, or undefined where the browser does not offer it. */
function storageManager(): Partial<StorageManager> | undefined {
  // `navigator.storage` is missing in old browsers and insecure contexts,
  // even though the DOM types say it always exists.
  return (navigator as Partial<Navigator>).storage;
}

/**
 * Asks for persistent storage, unless the data is already persistent (then
 * no prompt appears). Never throws: a browser that rejects the request (some
 * do in private mode) counts as "not-persisted".
 */
export async function requestPersistentStorage(): Promise<PersistResult> {
  const storage = storageManager();
  if (storage === undefined || typeof storage.persist !== "function") return "unsupported";
  try {
    if (typeof storage.persisted === "function" && (await storage.persisted())) {
      return "persisted";
    }
    return (await storage.persist()) ? "persisted" : "not-persisted";
  } catch {
    return "not-persisted";
  }
}

/**
 * The current status without asking the user (for the settings page).
 * Never throws.
 */
export async function getPersistenceStatus(): Promise<PersistResult> {
  const storage = storageManager();
  if (storage === undefined || typeof storage.persisted !== "function") return "unsupported";
  try {
    return (await storage.persisted()) ? "persisted" : "not-persisted";
  } catch {
    return "not-persisted";
  }
}

/**
 * Subscribes to "data changed" events and returns an unsubscribe function.
 * Defaults to `onDataChanged` from src/db/write.ts (fires after every
 * successful write); tests pass a simple fake instead.
 */
export type DataChangeSubscription = (listener: () => void) => () => void;

/**
 * Requests persistent storage once, after the first successful save of this
 * session. Wiring (in main.ts, after the database opened):
 * `requestPersistenceOnFirstSave()`.
 * Returns a function that cancels the wait (used by tests).
 */
export function requestPersistenceOnFirstSave(
  subscribe: DataChangeSubscription = onDataChanged,
): () => void {
  // `done` guards against a second change arriving before the listener is
  // removed, so the browser is asked at most once.
  let done = false;
  const unsubscribe = subscribe(() => {
    if (done) return;
    done = true;
    unsubscribe();
    void requestPersistentStorage();
  });
  return () => {
    done = true;
    unsubscribe();
  };
}
