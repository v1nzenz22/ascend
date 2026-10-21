// Totals for one day and the comparison with a goal. Pure functions: the
// Heute screen and the dashboard both use them.
import type { Entry, Meal } from "../db/types";
import { MEALS } from "./meals";
import { nutrientsForAmount } from "./nutrients";

/** The nutrients a day screen shows. Energy in kcal, the rest in grams. */
export interface DayTotal {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** The three macronutrients, listed once. */
export const MACROS = ["protein", "carbs", "fat"] as const satisfies readonly (keyof DayTotal)[];
export type Macro = (typeof MACROS)[number];

export interface MealSummary {
  meal: Meal;
  /** The meal's entries in the order given (callers pass them sorted). */
  entries: Entry[];
  kcal: number;
}

export interface DaySummary {
  /** Sums of the **known** values only. */
  total: DayTotal;
  /**
   * True for a nutrient if at least one entry has no value for it. The sum
   * is then too low, and the screen says "unvollständig" instead of
   * pretending it is complete.
   */
  incomplete: Record<Macro, boolean>;
  /** All four meals in display order, also the empty ones. */
  meals: MealSummary[];
}

/** Adds up `entries` (one day) using the snapshot values of each entry. */
export function summarizeDay(entries: readonly Entry[]): DaySummary {
  const total: DayTotal = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  const incomplete: Record<Macro, boolean> = { protein: false, carbs: false, fat: false };
  const meals: MealSummary[] = MEALS.map((meal) => ({ meal, entries: [], kcal: 0 }));

  for (const entry of entries) {
    const eaten = nutrientsForAmount(entry.snapshot.per100, entry.amount);
    total.kcal += eaten.kcal;
    for (const macro of MACROS) {
      const grams = eaten[macro];
      if (grams === undefined) incomplete[macro] = true;
      else total[macro] += grams;
    }
    const group = meals.find((summary) => summary.meal === entry.meal);
    // An entry always has a valid meal (checked on write and import); if a
    // broken record slips through it still counts in the total.
    if (group !== undefined) {
      group.entries.push(entry);
      group.kcal += eaten.kcal;
    }
  }
  return { total, incomplete, meals };
}

export type GoalComparison =
  | { kind: "none" }
  | { kind: "under"; remaining: number; ratio: number }
  | { kind: "over"; over: number; ratio: number };

/**
 * How `eaten` compares with `goal`. "under" includes exactly reaching the
 * goal (remaining 0). `ratio` is eaten ÷ goal (1 = goal reached), for ring
 * and bar lengths. Without a usable goal the result is `{ kind: 'none' }`.
 */
export function compareToGoal(eaten: number, goal?: number): GoalComparison {
  if (goal === undefined || !Number.isFinite(goal) || goal <= 0) return { kind: "none" };
  const ratio = eaten / goal;
  if (eaten > goal) return { kind: "over", over: eaten - goal, ratio };
  return { kind: "under", remaining: goal - eaten, ratio };
}
