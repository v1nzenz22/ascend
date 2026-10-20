import { describe, expect, test } from "vitest";
import { compareToGoal, summarizeDay } from "../../src/domain/day-summary";
import { makeEntry, uuid } from "./data-helpers";

describe("summarizeDay", () => {
  test("an empty day has zero totals and all four meals", () => {
    const summary = summarizeDay([]);
    expect(summary.total).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
    expect(summary.incomplete).toEqual({ protein: false, carbs: false, fat: false });
    expect(summary.meals.map((m) => [m.meal, m.entries.length, m.kcal])).toEqual([
      ["breakfast", 0, 0],
      ["lunch", 0, 0],
      ["dinner", 0, 0],
      ["snacks", 0, 0],
    ]);
  });

  test("adds up the amounts and groups entries by meal", () => {
    const skyr = makeEntry({ id: uuid(1), amount: 150, meal: "breakfast" });
    const second = makeEntry({ id: uuid(2), amount: 50, meal: "breakfast" });
    const lunch = makeEntry({
      id: uuid(3),
      amount: 200,
      meal: "lunch",
      snapshot: {
        name: "Reis",
        unit: "g",
        per100: { kcal: 130, protein: 2.5, carbs: 28, fat: 0.5 },
      },
    });
    const summary = summarizeDay([skyr, second, lunch]);
    // Skyr per 100 g: 63 kcal, 11 protein, 4 carbs, 0.2 fat; 200 g in total.
    expect(summary.total.kcal).toBeCloseTo(126 + 260, 10);
    expect(summary.total.protein).toBeCloseTo(22 + 5, 10);
    expect(summary.total.carbs).toBeCloseTo(8 + 56, 10);
    expect(summary.total.fat).toBeCloseTo(0.4 + 1, 10);
    const [breakfast, lunchGroup] = summary.meals;
    expect(breakfast?.entries).toEqual([skyr, second]);
    expect(breakfast?.kcal).toBeCloseTo(126, 10);
    expect(lunchGroup?.entries).toEqual([lunch]);
    expect(summary.incomplete).toEqual({ protein: false, carbs: false, fat: false });
  });

  test("unknown values are not counted and mark the total incomplete", () => {
    const unknownMacros = makeEntry({
      id: uuid(1),
      snapshot: { name: "Suppe", unit: "ml", per100: { kcal: 40, protein: 2 } },
    });
    const known = makeEntry({ id: uuid(2) });
    const summary = summarizeDay([unknownMacros, known]);
    expect(summary.total.kcal).toBeCloseTo(103, 10);
    expect(summary.total.protein).toBeCloseTo(13, 10);
    expect(summary.total.carbs).toBeCloseTo(4, 10);
    expect(summary.incomplete).toEqual({ protein: false, carbs: true, fat: true });
  });
});

describe("compareToGoal", () => {
  test("no goal", () => {
    expect(compareToGoal(500)).toEqual({ kind: "none" });
    expect(compareToGoal(500, 0)).toEqual({ kind: "none" });
  });

  test("under the goal, including exactly on it", () => {
    expect(compareToGoal(993, 2000)).toEqual({ kind: "under", remaining: 1007, ratio: 0.4965 });
    expect(compareToGoal(2000, 2000)).toEqual({ kind: "under", remaining: 0, ratio: 1 });
  });

  test("over the goal", () => {
    expect(compareToGoal(2240, 2000)).toEqual({ kind: "over", over: 240, ratio: 1.12 });
  });
});
