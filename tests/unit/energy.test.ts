import { describe, expect, test } from "vitest";
import { fromKcal, toKcal } from "../../src/domain/energy";

describe("energy conversion", () => {
  test("kcal stays kcal", () => {
    expect(toKcal(250, "kcal")).toBe(250);
    expect(fromKcal(250, "kcal")).toBe(250);
  });

  test("kJ ÷ 4.184 = kcal and back", () => {
    expect(toKcal(4184, "kJ")).toBeCloseTo(1000, 10);
    expect(fromKcal(1000, "kJ")).toBeCloseTo(4184, 10);
    expect(fromKcal(toKcal(1046, "kJ"), "kJ")).toBeCloseTo(1046, 10);
  });

  test("0 stays 0", () => {
    expect(toKcal(0, "kJ")).toBe(0);
    expect(fromKcal(0, "kJ")).toBe(0);
  });
});
