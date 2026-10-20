// Asks the browser to keep the app's data even under storage pressure.
//
// Without this, browsers may delete IndexedDB data when the disk is full,
// and Safari in a normal tab deletes it after 7 days without use (home-screen
// apps are exempt). Not called yet: it should run once after the user saves
// their first own data (Phase 3), so Firefox's permission prompt appears at a
// moment that makes sense.

export type PersistResult = "persisted" | "not-persisted" | "unsupported";

export async function requestPersistentStorage(): Promise<PersistResult> {
  // `navigator.storage` is missing in old browsers and insecure contexts,
  // even though the DOM types say it always exists.
  const storage = (navigator as Partial<Navigator>).storage;
  if (storage === undefined || typeof storage.persist !== "function") return "unsupported";
  if (typeof storage.persisted === "function" && (await storage.persisted())) return "persisted";
  return (await storage.persist()) ? "persisted" : "not-persisted";
}
