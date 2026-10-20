import { afterEach, describe, expect, test, vi } from "vitest";
import {
  addDays,
  isLocalDate,
  parseLocalDate,
  toLocalDate,
  todayLocal,
} from "../../src/lib/local-date";

// All dates are built with the local `Date` constructor. The tests run with
// TZ=Europe/Berlin (set in vitest.config.ts): the daylight-saving tests below
// only prove something in a zone that actually has DST changes, and a fixed
// zone makes the results the same on every machine.

describe("test environment", () => {
  test("runs in the Europe/Berlin time zone", () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe("Europe/Berlin");
    // Summer time (CEST, UTC+2) in July, winter time (CET, UTC+1) in January.
    expect(new Date(2026, 6, 1).getTimezoneOffset()).toBe(-120);
    expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(-60);
  });
});

describe("toLocalDate", () => {
  test("uses the local calendar day, not the UTC day", () => {
    // 00:30 local time: in Germany this is still the previous day in UTC.
    expect(toLocalDate(new Date(2026, 9, 21, 0, 30))).toBe("2026-10-21");
    expect(toLocalDate(new Date(2026, 9, 20, 23, 59))).toBe("2026-10-20");
  });

  test("pads month and day", () => {
    expect(toLocalDate(new Date(2026, 0, 5, 12))).toBe("2026-01-05");
  });

  test("throws for an invalid Date instead of returning 'NaN-NaN-NaN'", () => {
    expect(() => toLocalDate(new Date(Number.NaN))).toThrow(RangeError);
    expect(() => toLocalDate(new Date("not a date"))).toThrow(RangeError);
  });
});

describe("parseLocalDate", () => {
  test("returns noon local time on that day", () => {
    const d = parseLocalDate("2026-10-20");
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 9, 20, 12]);
  });

  test("round-trips with toLocalDate", () => {
    expect(toLocalDate(parseLocalDate("2024-02-29"))).toBe("2024-02-29");
  });

  test("throws for invalid input", () => {
    expect(() => parseLocalDate("2026-02-30")).toThrow(RangeError);
    expect(() => parseLocalDate("20.10.2026")).toThrow(RangeError);
  });
});

describe("addDays", () => {
  test("crosses the spring daylight-saving change", () => {
    expect(addDays("2026-03-28", 1)).toBe("2026-03-29");
    expect(addDays("2026-03-29", 1)).toBe("2026-03-30");
  });

  test("crosses the autumn daylight-saving change", () => {
    expect(addDays("2026-10-24", 1)).toBe("2026-10-25");
    expect(addDays("2026-10-25", 1)).toBe("2026-10-26");
  });

  test("crosses month and year boundaries, also backwards", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2024-03-01", -1)).toBe("2024-02-29");
  });

  test("returns the same day for 0", () => {
    expect(addDays("2026-10-20", 0)).toBe("2026-10-20");
  });

  test("only accepts whole days", () => {
    for (const n of [0.5, -1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => addDays("2026-10-20", n)).toThrow(RangeError);
    }
  });

  test("throws for an invalid start date", () => {
    expect(() => addDays("2026-02-30", 1)).toThrow(RangeError);
  });
});

describe("isLocalDate", () => {
  test("accepts real calendar days", () => {
    expect(isLocalDate("2026-10-20")).toBe(true);
    expect(isLocalDate("2024-02-29")).toBe(true);
  });

  test("rejects other shapes and impossible days", () => {
    for (const s of [
      "",
      "2026-1-5",
      "2026-10-20T12:00",
      "20.10.2026",
      "2026-13-01",
      "2025-02-29",
    ]) {
      expect(isLocalDate(s)).toBe(false);
    }
  });
});

describe("todayLocal", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("returns the local day of the current time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 21, 0, 30));
    expect(todayLocal()).toBe("2026-10-21");
  });
});
