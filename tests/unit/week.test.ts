import { describe, expect, test } from "vitest";
import type { Entry, Goal } from "../../src/db/types";
import { summarizeWeek } from "../../src/domain/week";
import { makeEntry } from "./data-helpers";

let counter = 0;

/** An entry of `kcal` energy on `date` (100 g of a food with that kcal per 100 g). */
function eat(
  date: string,
  kcal: number,
  macros: { protein?: number; carbs?: number; fat?: number } = {},
): Entry {
  counter++;
  return makeEntry({
    id: `e${String(counter)}`,
    date,
    amount: 100,
    snapshot: { name: "Essen", unit: "g", per100: { kcal, ...macros } },
  });
}

function goal(validFrom: string, kcal?: number): Goal {
  return { validFrom, ...(kcal !== undefined && { kcal }), updatedAt: "2026-10-01T08:00:00.000Z" };
}

describe("summarizeWeek", () => {
  test("covers today−6 … today, oldest first, across a month boundary", () => {
    const week = summarizeWeek([], [], "2026-11-02");
    expect(week.days.map((d) => d.date)).toEqual([
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ]);
    expect(week.days.map((d) => d.isToday)).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
      true,
    ]);
    expect(week.countedDays).toBe(0);
    expect(week.averageKcal).toBeNull();
    expect(week.overGoal).toBeNull();
    expect(week.macros).toBeNull();
  });

  test("has seven distinct days in the week of the daylight-saving change", () => {
    // Germany switches back to winter time on 2026-10-25 (a 25-hour day).
    const week = summarizeWeek([], [], "2026-10-27");
    expect(week.days.map((d) => d.date)).toEqual([
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
      "2026-10-25",
      "2026-10-26",
      "2026-10-27",
    ]);
  });

  test("averages exclude today and days without entries; ignores other weeks", () => {
    const entries = [
      eat("2026-10-12", 9999), // before the window
      eat("2026-10-14", 1800),
      eat("2026-10-15", 1000),
      eat("2026-10-15", 1200),
      // 2026-10-16 … 2026-10-19: nothing logged
      eat("2026-10-20", 500), // today
    ];
    const week = summarizeWeek(entries, [], "2026-10-20");
    expect(week.days.map((d) => d.kcal)).toEqual([1800, 2200, 0, 0, 0, 0, 500]);
    expect(week.days.map((d) => d.hasEntries)).toEqual([
      true,
      true,
      false,
      false,
      false,
      false,
      true,
    ]);
    expect(week.countedDays).toBe(2);
    expect(week.averageKcal).toBe(2000);
  });

  test("uses the goal of each day, also when it changes mid-week", () => {
    const goals = [goal("2026-10-01", 2000), goal("2026-10-17", 1500)];
    const entries = [
      eat("2026-10-14", 2100), // over 2000
      eat("2026-10-15", 1900), // under 2000
      eat("2026-10-17", 1600), // over 1500
      eat("2026-10-18", 1500), // exactly on 1500: not over
      eat("2026-10-20", 3000), // today: shown, never counted
    ];
    const week = summarizeWeek(entries, goals, "2026-10-20");
    expect(week.days.map((d) => d.goalKcal)).toEqual([2000, 2000, 2000, 1500, 1500, 1500, 1500]);
    expect(week.days.map((d) => d.status)).toEqual([
      "over",
      "under",
      "under",
      "over",
      "under",
      "under",
      "over",
    ]);
    expect(week.overGoal).toEqual({ over: 2, of: 4 });
  });

  test("days without a kcal goal have status 'none' and are not in 'x von y'", () => {
    const goals = [goal("2026-10-17", 1500), goal("2026-10-19")];
    const entries = [eat("2026-10-14", 2100), eat("2026-10-17", 1600), eat("2026-10-19", 900)];
    const week = summarizeWeek(entries, goals, "2026-10-20");
    expect(week.days[0]?.status).toBe("none");
    expect("goalKcal" in (week.days[0] ?? {})).toBe(false);
    expect(week.days[5]?.status).toBe("none");
    expect(week.overGoal).toEqual({ over: 1, of: 1 });
  });

  test("macro averages and energy shares with 4/4/9 kcal per gram", () => {
    const entries = [
      eat("2026-10-18", 1000, { protein: 50, carbs: 100, fat: 20 }),
      eat("2026-10-19", 1000, { protein: 50, carbs: 100, fat: 20 }),
      eat("2026-10-20", 1000, { protein: 999, carbs: 0, fat: 0 }), // today: ignored
    ];
    const week = summarizeWeek(entries, [], "2026-10-20");
    // Per day: 50 g protein (200 kcal), 100 g carbs (400 kcal), 20 g fat (180 kcal).
    expect(week.macros?.protein.grams).toBeCloseTo(50, 10);
    expect(week.macros?.carbs.grams).toBeCloseTo(100, 10);
    expect(week.macros?.fat.grams).toBeCloseTo(20, 10);
    expect(week.macros?.protein.share).toBeCloseTo(200 / 780, 10);
    expect(week.macros?.carbs.share).toBeCloseTo(400 / 780, 10);
    expect(week.macros?.fat.share).toBeCloseTo(180 / 780, 10);
    expect(week.macrosIncomplete).toBe(false);
  });

  test("macros are null without macro energy and flag unknown values", () => {
    const week = summarizeWeek([eat("2026-10-19", 500)], [], "2026-10-20");
    expect(week.macros).toBeNull();
    expect(week.macrosIncomplete).toBe(true);
  });
});
