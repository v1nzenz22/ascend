// Nutrient values and the one calculation every screen needs: scaling the
// values per 100 g/ml to the amount actually eaten.

/**
 * Nutrient values. Energy in kcal, everything else in grams.
 * A missing field means **unknown**, not zero: day totals can then say
 * "incomplete" instead of silently counting 0.
 */
export interface Nutrients {
  kcal: number; // required: every food has an energy value
  protein?: number;
  carbs?: number;
  fat?: number;
  sugar?: number;
  fiber?: number;
  saturatedFat?: number;
  salt?: number;
}

// The optional fields, listed once so scaling cannot forget one.
const OPTIONAL_KEYS = [
  "protein",
  "carbs",
  "fat",
  "sugar",
  "fiber",
  "saturatedFat",
  "salt",
] as const satisfies readonly (keyof Nutrients)[];

/**
 * True if `value` is a usable number. Stored or imported data is not checked
 * by TypeScript, so a field may hold `null` or `NaN` even though its type
 * says `number`. Both mean "unknown": `null * factor` would silently become 0.
 */
function isKnown(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Nutrients for `amount` g/ml of a food whose values are given per 100 g/ml.
 * Known fields are scaled by `amount / 100`; unknown fields (missing, null,
 * NaN) stay unknown. No rounding here: values are rounded only when displayed.
 */
export function nutrientsForAmount(per100: Nutrients, amount: number): Nutrients {
  const factor = amount / 100;
  const result: Nutrients = { kcal: per100.kcal * factor };
  for (const key of OPTIONAL_KEYS) {
    const value = per100[key];
    if (isKnown(value)) result[key] = value * factor;
  }
  return result;
}
