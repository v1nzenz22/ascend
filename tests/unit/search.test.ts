import { describe, expect, test } from "vitest";
import { matchFoods, normalizeForSearch } from "../../src/domain/search";

describe("normalizeForSearch", () => {
  test("ignores case, accents and outer spaces", () => {
    expect(normalizeForSearch("  Müsli ")).toBe("musli");
    expect(normalizeForSearch("MÜSLI")).toBe(normalizeForSearch("müsli"));
    expect(normalizeForSearch("Crème brûlée")).toBe("creme brulee");
  });

  test("does not guess spelling variants", () => {
    expect(normalizeForSearch("Muesli")).not.toBe(normalizeForSearch("Müsli"));
  });
});

describe("matchFoods", () => {
  const foods = [
    { name: "Skyr Natur", brand: "Arla" },
    { name: "Müsli", brand: "Kölln" },
    { name: "Apfel" },
  ];

  test("an empty query returns all foods (as a new array)", () => {
    const result = matchFoods(foods, "  ");
    expect(result).toEqual(foods);
    expect(result).not.toBe(foods);
  });

  test("finds substrings in the name or the brand", () => {
    expect(matchFoods(foods, "kyr")).toEqual([foods[0]]);
    expect(matchFoods(foods, "arla")).toEqual([foods[0]]);
    expect(matchFoods(foods, "musli")).toEqual([foods[1]]);
    expect(matchFoods(foods, "KOLLN")).toEqual([foods[1]]);
    expect(matchFoods(foods, "Birne")).toEqual([]);
  });
});
