import { describe, expect, test } from "vitest";
import { defaultMealAt, isMeal, MEALS } from "../../src/domain/meals";

describe("meals", () => {
  test("MEALS lists all four in display order", () => {
    expect(MEALS).toEqual(["breakfast", "lunch", "dinner", "snacks"]);
  });

  test("isMeal accepts only the four ids", () => {
    for (const meal of MEALS) expect(isMeal(meal)).toBe(true);
    for (const value of ["Breakfast", "brunch", "", null, undefined, 1, {}]) {
      expect(isMeal(value)).toBe(false);
    }
  });

  test("defaultMealAt follows the local hour", () => {
    const at = (hour: number, minute = 0): string =>
      defaultMealAt(new Date(2026, 9, 20, hour, minute));
    expect(at(3, 59)).toBe("snacks");
    expect(at(4)).toBe("breakfast");
    expect(at(10, 59)).toBe("breakfast");
    expect(at(11)).toBe("lunch");
    expect(at(14, 59)).toBe("lunch");
    expect(at(15)).toBe("snacks");
    expect(at(16, 59)).toBe("snacks");
    expect(at(17)).toBe("dinner");
    expect(at(21, 59)).toBe("dinner");
    expect(at(22)).toBe("snacks");
    expect(at(0)).toBe("snacks");
  });
});
