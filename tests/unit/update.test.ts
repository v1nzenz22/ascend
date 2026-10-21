// Tests for src/app/update.ts with a stubbed `registerSW`. A real update
// needs two different builds served one after the other, which is too heavy
// for Playwright; it is checked by hand on the iPhone (phase-end checklist).
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { RegisterSWOptions } from "vite-plugin-pwa/types";

// The options update.ts passed to registerSW, and the function it got back.
let registered: RegisterSWOptions | undefined;
const activate = vi.fn(() => Promise.resolve());
const registerSW = vi.fn((options: RegisterSWOptions) => {
  registered = options;
  return activate;
});

// `virtual:pwa-register` only exists inside a Vite build with the PWA
// plugin; here it is replaced by the stub above.
vi.mock("virtual:pwa-register", () => ({ registerSW }));

type UpdateModule = typeof import("../../src/app/update");

/** A fresh copy of the module, so state from one test cannot leak. */
async function loadModule(): Promise<UpdateModule> {
  vi.resetModules();
  return import("../../src/app/update");
}

/** The options passed to registerSW; fails if it was not called. */
function options(): RegisterSWOptions {
  if (registered === undefined) throw new Error("registerSW was not called");
  return registered;
}

/** Minimal `document` with a settable visibilityState. */
function stubDocument(): { target: EventTarget; setVisible: (visible: boolean) => void } {
  const target = new EventTarget();
  let state: DocumentVisibilityState = "visible";
  const fake = {
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    get visibilityState() {
      return state;
    },
  };
  vi.stubGlobal("document", fake);
  return {
    target,
    setVisible(visible) {
      state = visible ? "visible" : "hidden";
      target.dispatchEvent(new Event("visibilitychange"));
    },
  };
}

beforeEach(() => {
  registered = undefined;
  registerSW.mockClear();
  activate.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("startUpdateWatch", () => {
  test("registers the service worker once", async () => {
    const update = await loadModule();
    update.startUpdateWatch();
    update.startUpdateWatch();
    expect(registerSW).toHaveBeenCalledTimes(1);
  });

  test("no update announced before the worker is waiting", async () => {
    const update = await loadModule();
    const listener = vi.fn();
    update.onUpdateAvailable(listener);
    update.startUpdateWatch();
    options().onOfflineReady?.();
    expect(listener).not.toHaveBeenCalled();
    expect(update.isUpdateAvailable()).toBe(false);
  });

  test("a waiting worker is announced to every listener once", async () => {
    const update = await loadModule();
    const first = vi.fn();
    const second = vi.fn();
    update.onUpdateAvailable(first);
    update.onUpdateAvailable(second);
    update.startUpdateWatch();

    options().onNeedRefresh?.();
    options().onNeedRefresh?.();

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(update.isUpdateAvailable()).toBe(true);
  });

  test("a late listener is called right away", async () => {
    const update = await loadModule();
    update.startUpdateWatch();
    options().onNeedRefresh?.();
    const late = vi.fn();
    update.onUpdateAvailable(late);
    expect(late).toHaveBeenCalledTimes(1);
  });

  test("an unsubscribed listener is not called", async () => {
    const update = await loadModule();
    const listener = vi.fn();
    const unsubscribe = update.onUpdateAvailable(listener);
    unsubscribe();
    update.startUpdateWatch();
    options().onNeedRefresh?.();
    expect(listener).not.toHaveBeenCalled();
  });

  test("checks for a new sw.js whenever the app becomes visible", async () => {
    const page = stubDocument();
    const registration = { update: vi.fn(() => Promise.resolve()) };
    const update = await loadModule();
    update.startUpdateWatch();
    options().onRegisteredSW?.("/sw.js", registration as unknown as ServiceWorkerRegistration);

    page.setVisible(false);
    expect(registration.update).not.toHaveBeenCalled();
    page.setVisible(true);
    expect(registration.update).toHaveBeenCalledTimes(1);
  });

  test("a failed check (offline) is ignored", async () => {
    const page = stubDocument();
    const registration = { update: vi.fn(() => Promise.reject(new Error("offline"))) };
    const update = await loadModule();
    update.startUpdateWatch();
    options().onRegisteredSW?.("/sw.js", registration as unknown as ServiceWorkerRegistration);

    page.setVisible(true);
    // Let the rejected promise settle; an unhandled rejection would fail the run.
    await Promise.resolve();
    expect(registration.update).toHaveBeenCalledTimes(1);
  });

  test("a registration error goes to the local console only", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const update = await loadModule();
    update.startUpdateWatch();
    const error = new Error("no service worker");
    options().onRegisterError?.(error);
    expect(consoleError).toHaveBeenCalledWith(error);
  });
});

describe("reloadToUpdate", () => {
  test("with a waiting worker: lets it take over", async () => {
    const reload = vi.fn();
    vi.stubGlobal("window", { location: { reload } });
    const update = await loadModule();
    update.startUpdateWatch();
    options().onNeedRefresh?.();

    await update.reloadToUpdate();
    expect(activate).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
  });

  test("stale version without a waiting worker: plain reload", async () => {
    const reload = vi.fn();
    vi.stubGlobal("window", { location: { reload } });
    const update = await loadModule();
    update.startUpdateWatch();
    const listener = vi.fn();
    update.onUpdateAvailable(listener);

    update.reportStaleVersion();
    expect(listener).toHaveBeenCalledTimes(1);

    await update.reloadToUpdate();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(activate).not.toHaveBeenCalled();
  });
});
