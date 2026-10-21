import { afterEach, describe, expect, test, vi } from "vitest";
import {
  getPersistenceStatus,
  requestPersistenceOnFirstSave,
  requestPersistentStorage,
} from "../../src/app/storage";

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

  test("persisted() rejects: not-persisted, no error", async () => {
    stubStorage({
      persisted: () => Promise.reject(new Error("private mode")),
      persist: () => Promise.resolve(true),
    });
    expect(await requestPersistentStorage()).toBe("not-persisted");
  });

  test("persist() rejects: not-persisted, no error", async () => {
    stubStorage({
      persisted: () => Promise.resolve(false),
      persist: () => Promise.reject(new Error("denied")),
    });
    expect(await requestPersistentStorage()).toBe("not-persisted");
  });
});

describe("getPersistenceStatus", () => {
  test("reports the status without asking", async () => {
    const persist = vi.fn(() => Promise.resolve(true));
    stubStorage({ persisted: () => Promise.resolve(false), persist });
    expect(await getPersistenceStatus()).toBe("not-persisted");
    expect(persist).not.toHaveBeenCalled();
  });

  test("persisted", async () => {
    stubStorage({ persisted: () => Promise.resolve(true) });
    expect(await getPersistenceStatus()).toBe("persisted");
  });

  test("rejection: not-persisted", async () => {
    stubStorage({ persisted: () => Promise.reject(new Error("nope")) });
    expect(await getPersistenceStatus()).toBe("not-persisted");
  });

  test("unsupported", async () => {
    stubStorage(undefined);
    expect(await getPersistenceStatus()).toBe("unsupported");
  });
});

/** A minimal stand-in for onDataChanged from src/db/write.ts. */
function fakeDataChanges(): {
  subscribe: (listener: () => void) => () => void;
  emit: () => void;
  listenerCount: () => number;
} {
  const listeners = new Set<() => void>();
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    emit() {
      for (const listener of listeners) listener();
    },
    listenerCount: () => listeners.size,
  };
}

describe("requestPersistenceOnFirstSave", () => {
  test("does nothing before the first save", () => {
    const persist = vi.fn(() => Promise.resolve(true));
    stubStorage({ persisted: () => Promise.resolve(false), persist });
    const changes = fakeDataChanges();
    requestPersistenceOnFirstSave(changes.subscribe);
    expect(persist).not.toHaveBeenCalled();
    expect(changes.listenerCount()).toBe(1);
  });

  test("asks once after the first save, then unsubscribes", async () => {
    const persist = vi.fn(() => Promise.resolve(true));
    stubStorage({ persisted: () => Promise.resolve(false), persist });
    const changes = fakeDataChanges();
    requestPersistenceOnFirstSave(changes.subscribe);

    changes.emit();
    changes.emit();
    await vi.waitFor(() => {
      expect(persist).toHaveBeenCalledTimes(1);
    });
    expect(changes.listenerCount()).toBe(0);
  });

  test("already persisted: no prompt", async () => {
    const persisted = vi.fn(() => Promise.resolve(true));
    const persist = vi.fn(() => Promise.resolve(true));
    stubStorage({ persisted, persist });
    const changes = fakeDataChanges();
    requestPersistenceOnFirstSave(changes.subscribe);

    changes.emit();
    await vi.waitFor(() => {
      expect(persisted).toHaveBeenCalledTimes(1);
    });
    expect(persist).not.toHaveBeenCalled();
  });

  test("cancel before the first save: never asks", () => {
    const persist = vi.fn(() => Promise.resolve(true));
    stubStorage({ persisted: () => Promise.resolve(false), persist });
    const changes = fakeDataChanges();
    const cancel = requestPersistenceOnFirstSave(changes.subscribe);
    cancel();
    changes.emit();
    expect(persist).not.toHaveBeenCalled();
    expect(changes.listenerCount()).toBe(0);
  });
});
