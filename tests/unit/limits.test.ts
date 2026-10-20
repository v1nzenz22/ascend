import { describe, expect, test } from "vitest";
import {
  isFoodUnit,
  isInRange,
  isSettingKey,
  isValidAmount,
  isValidBarcode,
  isValidFoodName,
  isValidTzOffset,
  LIMITS,
  readPer100,
  readPortions,
  SETTING_VALIDATORS,
} from "../../src/domain/limits";

describe("limits table", () => {
  test("matches the design (§3.2)", () => {
    expect(LIMITS.foodName).toEqual({ min: 1, max: 100 });
    expect(LIMITS.per100Kcal).toEqual({ min: 0, max: 1000 });
    expect(LIMITS.per100Grams).toEqual({ min: 0, max: 100 });
    expect(LIMITS.goalKcal).toEqual({ min: 1, max: 20_000 });
    expect(LIMITS.goalGrams).toEqual({ min: 1, max: 2_000 });
    expect(LIMITS.tzOffset).toEqual({ min: -840, max: 720 });
  });
});

describe("isInRange", () => {
  test("includes both ends, rejects non-numbers and non-finite values", () => {
    const range = { min: 1, max: 10 };
    expect(isInRange(1, range)).toBe(true);
    expect(isInRange(10, range)).toBe(true);
    expect(isInRange(0.99, range)).toBe(false);
    expect(isInRange(10.01, range)).toBe(false);
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, "5", null, undefined]) {
      expect(isInRange(value, range)).toBe(false);
    }
  });
});

describe("single checks", () => {
  test("food name: 1–100 characters after trimming", () => {
    expect(isValidFoodName("A")).toBe(true);
    expect(isValidFoodName(" ".repeat(5) + "x".repeat(100))).toBe(true);
    expect(isValidFoodName("   ")).toBe(false);
    expect(isValidFoodName("x".repeat(101))).toBe(false);
  });

  test("amount: above 0, at most 10 000", () => {
    expect(isValidAmount(0.1)).toBe(true);
    expect(isValidAmount(10_000)).toBe(true);
    expect(isValidAmount(0)).toBe(false);
    expect(isValidAmount(10_000.5)).toBe(false);
  });

  test("barcode: 8–14 digits only", () => {
    expect(isValidBarcode("40000000")).toBe(true);
    expect(isValidBarcode("12345678901234")).toBe(true);
    expect(isValidBarcode("1234567")).toBe(false);
    expect(isValidBarcode("123456789012345")).toBe(false);
    expect(isValidBarcode("1234567a")).toBe(false);
  });

  test("time-zone offset: whole minutes from −840 to 720", () => {
    expect(isValidTzOffset(-840)).toBe(true);
    expect(isValidTzOffset(720)).toBe(true);
    expect(isValidTzOffset(0)).toBe(true);
    expect(isValidTzOffset(-841)).toBe(false);
    expect(isValidTzOffset(30.5)).toBe(false);
    expect(isValidTzOffset("0")).toBe(false);
  });

  test("food unit", () => {
    expect(isFoodUnit("g")).toBe(true);
    expect(isFoodUnit("ml")).toBe(true);
    expect(isFoodUnit("kg")).toBe(false);
  });
});

describe("readPer100", () => {
  test("requires energy; other nutrients are optional", () => {
    expect(readPer100({ kcal: 0 })).toEqual({ kcal: 0 });
    expect(readPer100({ kcal: 1000, fat: 100, salt: 0 })).toEqual({
      kcal: 1000,
      fat: 100,
      salt: 0,
    });
    expect(readPer100({ protein: 3 })).toBeNull();
  });

  test("null means unknown and is left out; unknown keys are dropped", () => {
    const result = readPer100({ kcal: 50, protein: null, vitaminC: 3 });
    expect(result).toEqual({ kcal: 50 });
    expect(result !== null && "protein" in result).toBe(false);
  });

  test("rejects values out of range", () => {
    expect(readPer100({ kcal: 1001 })).toBeNull();
    expect(readPer100({ kcal: 100, carbs: 100.1 })).toBeNull();
    expect(readPer100({ kcal: 100, fat: -1 })).toBeNull();
    expect(readPer100({ kcal: "100" })).toBeNull();
    expect(readPer100(null)).toBeNull();
    expect(readPer100([100])).toBeNull();
  });
});

describe("readPortions", () => {
  test("copies valid portions with trimmed labels", () => {
    expect(readPortions([{ label: " 1 Becher ", amount: 150, extra: 1 }])).toEqual([
      { label: "1 Becher", amount: 150 },
    ]);
    expect(readPortions([])).toEqual([]);
  });

  test("rejects invalid portions and too many", () => {
    expect(readPortions([{ label: "", amount: 10 }])).toBeNull();
    expect(readPortions([{ label: "x", amount: 0 }])).toBeNull();
    expect(readPortions([{ label: "x".repeat(101), amount: 10 }])).toBeNull();
    expect(readPortions("1 Becher")).toBeNull();
    expect(readPortions(Array.from({ length: 51 }, () => ({ label: "x", amount: 1 })))).toBeNull();
  });
});

describe("settings", () => {
  test("validators accept exactly the allowed values", () => {
    expect(SETTING_VALIDATORS.energyUnit("kJ")).toBe(true);
    expect(SETTING_VALIDATORS.energyUnit("kj")).toBe(false);
    expect(SETTING_VALIDATORS.theme("system")).toBe(true);
    expect(SETTING_VALIDATORS.theme("auto")).toBe(false);
    expect(SETTING_VALIDATORS.goalsIntroDismissed(false)).toBe(true);
    expect(SETTING_VALIDATORS.goalsIntroDismissed("true")).toBe(false);
  });

  test("isSettingKey knows only real keys (not inherited ones)", () => {
    expect(isSettingKey("theme")).toBe(true);
    expect(isSettingKey("toString")).toBe(false);
    expect(isSettingKey("language")).toBe(false);
  });
});
