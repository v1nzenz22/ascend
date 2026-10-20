import { beforeEach, describe, expect, test } from "vitest";
import { db } from "../../src/db/db";
import { allGoals, goalsOn, saveGoals } from "../../src/db/goals";
import type { Goal } from "../../src/db/types";
import { goalOn } from "../../src/domain/goals";
import { resetDatabase } from "./data-helpers";

function goal(validFrom: string, kcal?: number): Goal {
  return {
    validFrom,
    ...(kcal !== undefined && { kcal }),
    updatedAt: "2026-10-01T08:00:00.000Z",
  };
}

describe("goalOn (pure)", () => {
  const goals = [goal("2026-10-15", 1800), goal("2026-10-01", 2000), goal("2026-10-20")];

  test("picks the newest set that started on or before the day", () => {
    expect(goalOn(goals, "2026-10-14")?.kcal).toBe(2000);
    expect(goalOn(goals, "2026-10-15")?.kcal).toBe(1800);
    expect(goalOn(goals, "2026-10-19")?.kcal).toBe(1800);
  });

  test("an empty set means no goals from that day on", () => {
    expect(goalOn(goals, "2026-10-25")).toEqual(goal("2026-10-20"));
  });

  test("nothing before the first set", () => {
    expect(goalOn(goals, "2026-09-30")).toBeUndefined();
    expect(goalOn([], "2026-10-20")).toBeUndefined();
  });
});

describe("goals table", () => {
  beforeEach(resetDatabase);

  test("is empty at start", async () => {
    expect(await allGoals()).toEqual([]);
    expect(await goalsOn("2026-10-20")).toBeUndefined();
    expect(await db.goals.count()).toBe(0);
  });

  test("past days keep their older goals", async () => {
    await saveGoals("2026-10-01", { kcal: 2000, protein: 100 });
    await saveGoals("2026-10-15", { kcal: 1800 });
    expect((await goalsOn("2026-10-14"))?.kcal).toBe(2000);
    expect((await goalsOn("2026-10-14"))?.protein).toBe(100);
    expect((await goalsOn("2026-10-15"))?.kcal).toBe(1800);
    expect((await goalsOn("2026-10-15"))?.protein).toBeUndefined();
    expect((await goalsOn("2026-12-31"))?.kcal).toBe(1800);
    expect(await goalsOn("2026-09-30")).toBeUndefined();
    expect((await allGoals()).map((g) => g.validFrom)).toEqual(["2026-10-01", "2026-10-15"]);
  });

  test("saving again on the same day overwrites that day's set", async () => {
    await saveGoals("2026-10-20", { kcal: 2000, fat: 70 });
    const saved = await saveGoals("2026-10-20", { kcal: 2100 });
    expect(await allGoals()).toEqual([saved]);
    expect(saved).toEqual({ validFrom: "2026-10-20", kcal: 2100, updatedAt: saved.updatedAt });
  });

  test("an all-empty set is stored and clears the goals from then on", async () => {
    await saveGoals("2026-10-01", { kcal: 2000 });
    await saveGoals("2026-10-20", {});
    expect((await goalsOn("2026-10-19"))?.kcal).toBe(2000);
    const cleared = await goalsOn("2026-10-20");
    expect(cleared?.validFrom).toBe("2026-10-20");
    expect(cleared?.kcal).toBeUndefined();
  });

  test("rejects values outside the limits and invalid days", async () => {
    await expect(saveGoals("2026-10-20", { kcal: 0 })).rejects.toThrow(RangeError);
    await expect(saveGoals("2026-10-20", { kcal: 20_001 })).rejects.toThrow(RangeError);
    await expect(saveGoals("2026-10-20", { protein: 2001 })).rejects.toThrow(RangeError);
    await expect(saveGoals("2026-10-20", { fat: Number.NaN })).rejects.toThrow(RangeError);
    await expect(saveGoals("2026-13-01", { kcal: 2000 })).rejects.toThrow(RangeError);
    expect(await db.goals.count()).toBe(0);
  });
});
