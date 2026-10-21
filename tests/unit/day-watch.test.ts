import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { msUntilNextDay, watchToday, type DayWatchEnvironment } from "../../src/app/day-watch";
import { todayLocal } from "../../src/lib/local-date";

/** A fake document/window: plain EventTargets plus a settable visibility. */
function fakeEnvironment(): DayWatchEnvironment & {
  visibility: { state: DocumentVisibilityState };
  doc: EventTarget;
  win: EventTarget;
} {
  const visibility = { state: "visible" as DocumentVisibilityState };
  const doc = new EventTarget() as EventTarget & { visibilityState: DocumentVisibilityState };
  Object.defineProperty(doc, "visibilityState", { get: () => visibility.state });
  const win = new EventTarget();
  return {
    now: () => new Date(),
    today: todayLocal,
    document: doc,
    window: win,
    visibility,
    // The same objects, typed as EventTarget so tests can dispatch events.
    doc,
    win,
  };
}

describe("msUntilNextDay", () => {
  test("counts to one second after local midnight", () => {
    expect(msUntilNextDay(new Date(2026, 9, 20, 23, 59, 50))).toBe(11_000);
  });

  test("handles the 25-hour day when summer time ends (Europe/Berlin)", () => {
    // 25 Oct 2026, 00:00 → 26 Oct 00:00:01 is 25 h + 1 s.
    expect(msUntilNextDay(new Date(2026, 9, 25, 0, 0, 0))).toBe(25 * 3_600_000 + 1000);
  });
});

describe("watchToday", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 20, 23, 59, 50));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("fires once at midnight with the new day", () => {
    const onChange = vi.fn();
    const stop = watchToday(onChange, fakeEnvironment());
    vi.advanceTimersByTime(9_000);
    expect(onChange).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2_000);
    expect(onChange).toHaveBeenCalledExactlyOnceWith("2026-10-21");
    stop();
  });

  test("re-arms for the following midnight", () => {
    const onChange = vi.fn();
    const stop = watchToday(onChange, fakeEnvironment());
    vi.advanceTimersByTime(11_000 + 24 * 3_600_000);
    expect(onChange.mock.calls).toEqual([["2026-10-21"], ["2026-10-22"]]);
    stop();
  });

  test("checks when the page becomes visible again", () => {
    const env = fakeEnvironment();
    const onChange = vi.fn();
    const stop = watchToday(onChange, env);

    // The phone slept: the clock moved, no timer ran.
    vi.setSystemTime(new Date(2026, 9, 21, 8, 0, 0));
    env.visibility.state = "hidden";
    env.doc.dispatchEvent(new Event("visibilitychange"));
    expect(onChange).not.toHaveBeenCalled();

    env.visibility.state = "visible";
    env.doc.dispatchEvent(new Event("visibilitychange"));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("2026-10-21");
    stop();
  });

  test("checks on pageshow (back-forward cache)", () => {
    const env = fakeEnvironment();
    const onChange = vi.fn();
    const stop = watchToday(onChange, env);
    vi.setSystemTime(new Date(2026, 9, 22, 9, 0, 0));
    env.win.dispatchEvent(new Event("pageshow"));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("2026-10-22");
    stop();
  });

  test("does nothing when the day did not change", () => {
    const env = fakeEnvironment();
    const onChange = vi.fn();
    const stop = watchToday(onChange, env);
    env.doc.dispatchEvent(new Event("visibilitychange"));
    env.win.dispatchEvent(new Event("pageshow"));
    expect(onChange).not.toHaveBeenCalled();
    stop();
  });

  test("stop removes the timer and the listeners", () => {
    const env = fakeEnvironment();
    const onChange = vi.fn();
    watchToday(onChange, env)();
    vi.advanceTimersByTime(48 * 3_600_000);
    env.doc.dispatchEvent(new Event("visibilitychange"));
    env.win.dispatchEvent(new Event("pageshow"));
    expect(onChange).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
