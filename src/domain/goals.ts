// Which goal set applies on a given day.
//
// Goals are stored as sets with a start day (`validFrom`). A set applies
// until the next set starts, so changing goals today never changes the
// goals of past days.
import type { Goal } from "../db/types";
import type { LocalDate } from "../lib/local-date";

/**
 * The goal values a user can set. Every field is optional: a missing field
 * means "no goal for this value". The app never fills in a default.
 * Energy in kcal, the rest in grams.
 */
export interface GoalValues {
  kcal?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

/** The fields of `GoalValues`, listed once so no code forgets one. */
export const GOAL_KEYS = [
  "kcal",
  "protein",
  "carbs",
  "fat",
] as const satisfies readonly (keyof GoalValues)[];

/**
 * The goal set that applies on `day`: the one with the newest
 * `validFrom ≤ day`, or `undefined` if none started yet. The list does not
 * need to be sorted. `LocalDate` strings compare correctly as text.
 */
export function goalOn(goals: readonly Goal[], day: LocalDate): Goal | undefined {
  let best: Goal | undefined;
  for (const goal of goals) {
    if (goal.validFrom <= day && (best === undefined || goal.validFrom > best.validFrom)) {
      best = goal;
    }
  }
  return best;
}
