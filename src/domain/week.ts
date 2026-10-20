// The last seven days for the desktop dashboard: energy per day, how many
// days went over the goal, averages and the macronutrient energy split.
import type { Entry, Goal } from "../db/types";
import { addDays, type LocalDate } from "../lib/local-date";
import { MACROS, summarizeDay, type DayTotal, type Macro } from "./day-summary";
import { goalOn } from "./goals";

/** Energy per gram, as used on food labels (EU regulation 1169/2011). */
export const KCAL_PER_GRAM: Readonly<Record<Macro, number>> = { protein: 4, carbs: 4, fat: 9 };

export interface WeekDay {
  date: LocalDate;
  /** Energy eaten that day (kcal). */
  kcal: number;
  /** True if the day has at least one entry. */
  hasEntries: boolean;
  /** The kcal goal that applied on that day, if any. */
  goalKcal?: number;
  /** "none" if the day has no kcal goal; "over" only above the goal. */
  status: "none" | "under" | "over";
  isToday: boolean;
}

export interface MacroShare {
  /** Average grams per counted day. */
  grams: number;
  /** Share of the energy from the three macros, 0–1 (the three add up to 1). */
  share: number;
}

export interface WeekSummary {
  /** Seven days, oldest first: today−6 … today. */
  days: WeekDay[];
  /**
   * Days that count for averages: completed days (not today) with at least
   * one entry. An empty day is more likely "not logged" than "ate nothing".
   */
  countedDays: number;
  /** Average kcal per counted day, or `null` if no day counts. */
  averageKcal: number | null;
  /**
   * "x von y Tagen über dem Ziel": among counted days that had a kcal goal.
   * `null` if no counted day had a kcal goal.
   */
  overGoal: { over: number; of: number } | null;
  /** Macro averages over the counted days; `null` if no day counts or no macro energy. */
  macros: Record<Macro, MacroShare> | null;
  /** True if a counted day has an entry without a value for some macro. */
  macrosIncomplete: boolean;
}

/**
 * Summarises the week ending on `today`. `entries` and `goals` may contain
 * more than the seven days; other days are ignored.
 */
export function summarizeWeek(
  entries: readonly Entry[],
  goals: readonly Goal[],
  today: LocalDate,
): WeekSummary {
  const days: WeekDay[] = [];
  const macroSum: DayTotal = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  let countedDays = 0;
  let overDays = 0;
  let daysWithGoal = 0;
  let macrosIncomplete = false;

  for (let offset = -6; offset <= 0; offset++) {
    const date = addDays(today, offset);
    const dayEntries = entries.filter((entry) => entry.date === date);
    const summary = summarizeDay(dayEntries);
    const goalKcal = goalOn(goals, date)?.kcal;
    const kcal = summary.total.kcal;
    const status = goalKcal === undefined ? "none" : kcal > goalKcal ? "over" : "under";
    const day: WeekDay = {
      date,
      kcal,
      hasEntries: dayEntries.length > 0,
      status,
      isToday: offset === 0,
    };
    if (goalKcal !== undefined) day.goalKcal = goalKcal;
    days.push(day);

    // Today is still running, so it never counts for averages.
    if (day.isToday || !day.hasEntries) continue;
    countedDays++;
    macroSum.kcal += kcal;
    for (const macro of MACROS) {
      macroSum[macro] += summary.total[macro];
      if (summary.incomplete[macro]) macrosIncomplete = true;
    }
    if (goalKcal !== undefined) {
      daysWithGoal++;
      if (status === "over") overDays++;
    }
  }

  return {
    days,
    countedDays,
    averageKcal: countedDays > 0 ? macroSum.kcal / countedDays : null,
    overGoal: daysWithGoal > 0 ? { over: overDays, of: daysWithGoal } : null,
    macros: countedDays > 0 ? macroShares(macroSum, countedDays) : null,
    macrosIncomplete,
  };
}

/** Average grams and energy shares, or `null` if the macros carry no energy. */
function macroShares(sum: DayTotal, days: number): Record<Macro, MacroShare> | null {
  const energy = MACROS.reduce((acc, macro) => acc + sum[macro] * KCAL_PER_GRAM[macro], 0);
  if (energy <= 0) return null;
  const share = (macro: Macro): MacroShare => ({
    grams: sum[macro] / days,
    share: (sum[macro] * KCAL_PER_GRAM[macro]) / energy,
  });
  return { protein: share("protein"), carbs: share("carbs"), fat: share("fat") };
}
