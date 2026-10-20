import { describe, expect, test } from "vitest";
import { nutrientsForAmount, type Nutrients } from "../../src/domain/nutrients";

describe("nutrientsForAmount", () => {
  test("scales every known value by amount / 100", () => {
    const per100: Nutrients = {
      kcal: 250,
      protein: 10,
      carbs: 30,
      fat: 8,
      sugar: 5,
      fiber: 4,
      saturatedFat: 2,
      salt: 1,
    };
    expect(nutrientsForAmount(per100, 50)).toEqual({
      kcal: 125,
      protein: 5,
      carbs: 15,
      fat: 4,
      sugar: 2.5,
      fiber: 2,
      saturatedFat: 1,
      salt: 0.5,
    });
  });

  test("keeps unknown values unknown instead of 0", () => {
    const result = nutrientsForAmount({ kcal: 100, protein: 3 }, 200);
    expect(result).toEqual({ kcal: 200, protein: 6 });
    expect("fat" in result).toBe(false);
  });

  test("keeps a known 0 as 0", () => {
    expect(nutrientsForAmount({ kcal: 0, sugar: 0 }, 150)).toEqual({ kcal: 0, sugar: 0 });
  });

  test("treats null and NaN as unknown, not as a number", () => {
    // Data from IndexedDB, a JSON import or Open Food Facts is not checked by
    // TypeScript: a field can be null even though the type says number.
    // null * factor would be 0 – a silent, wrong "known zero".
    const per100 = {
      kcal: 100,
      protein: null,
      fat: Number.NaN,
      sugar: Number.POSITIVE_INFINITY,
      salt: 1,
    } as unknown as Nutrients;
    const result = nutrientsForAmount(per100, 50);
    expect(result).toEqual({ kcal: 50, salt: 0.5 });
    expect("protein" in result).toBe(false);
    expect("fat" in result).toBe(false);
    expect("sugar" in result).toBe(false);
  });

  test("does not change the input", () => {
    const per100: Nutrients = { kcal: 100, fat: 2 };
    nutrientsForAmount(per100, 30);
    expect(per100).toEqual({ kcal: 100, fat: 2 });
  });
});
