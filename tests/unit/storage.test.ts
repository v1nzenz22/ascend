import { afterEach, describe, expect, test, vi } from "vitest";
import { requestPersistentStorage } from "../../src/app/storage";

/** Replaces `navigator` with one whose `storage` behaves as given. */
function stubStorage(storage: Partial<StorageManager> | undefined): void {
  vi.stubGlobal("navigator", storage === undefined ? {} : { storage });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requestPersistentStorage", () => {
  test("already persisted: does not ask again", async () => {
    const persist = vi.fn(() => Promise.resolve(true));
    stubStorage({ persisted: () => Promise.resolve(true), persist });
    expect(await requestPersistentStorage()).toBe("persisted");
    expect(persist).not.toHaveBeenCalled();
  });

  test("granted", async () => {
    stubStorage({ persisted: () => Promise.resolve(false), persist: () => Promise.resolve(true) });
    expect(await requestPersistentStorage()).toBe("persisted");
  });

  test("denied", async () => {
    stubStorage({ persisted: () => Promise.resolve(false), persist: () => Promise.resolve(false) });
    expect(await requestPersistentStorage()).toBe("not-persisted");
  });

  test("unsupported: no navigator.storage", async () => {
    stubStorage(undefined);
    expect(await requestPersistentStorage()).toBe("unsupported");
  });

  test("unsupported: storage without persist()", async () => {
    stubStorage({});
    expect(await requestPersistentStorage()).toBe("unsupported");
  });
});
