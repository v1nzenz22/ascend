// Daily goals with an effective date. Reads use `db` directly; every write
// goes through write.ts. Nothing here ever writes a goal the user did not
// set: the table is empty until the first save.
import { db } from "./db";
import type { Goal } from "./types";
import { saveRecord } from "./write";
import { GOAL_KEYS, type GoalValues } from "../domain/goals";
import { isInRange, LIMITS } from "../domain/limits";
import { isLocalDate, type LocalDate } from "../lib/local-date";

/** All goal sets, oldest `validFrom` first. */
export async function allGoals(): Promise<Goal[]> {
  // The primary key is `validFrom`, so this order comes for free.
  return db.goals.orderBy("validFrom").toArray();
}

/** The goal set that applies on `date` (newest `validFrom ≤ date`), if any. */
export async function goalsOn(date: LocalDate): Promise<Goal | undefined> {
  return db.goals.where("validFrom").belowOrEqual(date).last();
}

/**
 * Stores `values` as the goal set from `validFrom` on, replacing a set that
 * started the same day. Fields left out mean "no goal for this value"; an
 * all-empty set is stored too and means "no goals from this day on".
 * Earlier days keep their older sets. Rejects invalid days or values.
 */
export async function saveGoals(validFrom: LocalDate, values: GoalValues): Promise<Goal> {
  if (!isLocalDate(validFrom)) throw new RangeError(`Not a local date: ${validFrom}`);
  const goal: Goal = { validFrom, updatedAt: new Date().toISOString() };
  for (const key of GOAL_KEYS) {
    const value = values[key];
    if (value === undefined) continue;
    const range = key === "kcal" ? LIMITS.goalKcal : LIMITS.goalGrams;
    if (!isInRange(value, range)) throw new RangeError(`Goal ${key} out of range`);
    goal[key] = value;
  }
  await saveRecord("goals", goal);
  return goal;
}
