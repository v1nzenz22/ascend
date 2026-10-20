import { describe, expect, test } from "vitest";
import { parseDecimal } from "../../src/i18n/parse-decimal";

describe("parseDecimal", () => {
  // Every row of the table in docs/design/phase-2-skeleton.md (D4).
  test.each([
    ["12", 12],
    ["12,5", 12.5],
    ["12.5", 12.5],
    [" 0,25 ", 0.25],
    [",5", 0.5],
    ["12,", 12],
    ["0", 0],
  ])("accepts %j → %d", (input, expected) => {
    expect(parseDecimal(input)).toBe(expected);
  });

  test.each(["", "abc", "1.234,5", "1,2,3", "-3", "1e3", "Infinity"])("rejects %j", (input) => {
    expect(parseDecimal(input)).toBeNull();
  });

  test("rejects a lone separator and whitespace only", () => {
    expect(parseDecimal(",")).toBeNull();
    expect(parseDecimal(".")).toBeNull();
    expect(parseDecimal("   ")).toBeNull();
  });

  test("rejects signs, inner spaces and grouping", () => {
    expect(parseDecimal("+3")).toBeNull();
    expect(parseDecimal("1 000")).toBeNull();
    expect(parseDecimal("1.000.000")).toBeNull();
  });

  test("treats a single dot as decimal separator, not grouping", () => {
    // Lenient on purpose: "1.000" is 1, never 1000 (see D4).
    expect(parseDecimal("1.000")).toBe(1);
  });

  test("rejects numbers too large to be finite", () => {
    expect(parseDecimal("9".repeat(400))).toBeNull();
  });

  test("rejects input longer than 32 characters", () => {
    expect(parseDecimal("1".repeat(32))).toBe(Number("1".repeat(32)));
    expect(parseDecimal("1".repeat(33))).toBeNull();
    // Surrounding spaces do not count.
    expect(parseDecimal(`  ${"1".repeat(32)}  `)).toBe(Number("1".repeat(32)));
  });

  test("returns quickly for very long input (no regex backtracking)", () => {
    // A pattern like /^(\d*)[.,]?(\d*)$/ needs time proportional to n² for
    // "111…1x"; pasted text must never freeze the page.
    const long = `${"1".repeat(100_000)}x`;
    const start = performance.now();
    expect(parseDecimal(long)).toBeNull();
    expect(performance.now() - start).toBeLessThan(50);
  });
});
