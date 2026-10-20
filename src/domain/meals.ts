// The four fixed meals of a day and which one fits the current time.
import type { Meal } from "../db/types";

/** All meals in display order (top to bottom on the Heute screen). */
export const MEALS: readonly Meal[] = ["breakfast", "lunch", "dinner", "snacks"];

/**
 * True if `value` is one of the four meal ids. Takes `unknown` because it
 * checks values from the URL (`?meal=`) and from backup files.
 */
export function isMeal(value: unknown): value is Meal {
  return typeof value === "string" && (MEALS as readonly string[]).includes(value);
}

/**
 * The meal to preselect at the local time of `d`: 4–10 h breakfast,
 * 11–14 h lunch, 17–21 h dinner, any other hour snacks. Only a suggestion;
 * the user can always pick another meal.
 */
export function defaultMealAt(d: Date): Meal {
  const hour = d.getHours();
  if (hour >= 4 && hour <= 10) return "breakfast";
  if (hour >= 11 && hour <= 14) return "lunch";
  if (hour >= 17 && hour <= 21) return "dinner";
  return "snacks";
}
