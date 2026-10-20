// Converting energy between the user's display unit and kcal.
//
// The database always stores kcal. A user who prefers kJ types and reads kJ,
// and these two functions convert at the edge (forms in, display out).
import { KJ_PER_KCAL, type EnergyUnit } from "../i18n/format";

/** `value` in `unit` → kcal. No rounding: values are rounded only when shown. */
export function toKcal(value: number, unit: EnergyUnit): number {
  return unit === "kJ" ? value / KJ_PER_KCAL : value;
}

/** `kcal` → the same energy in `unit`. */
export function fromKcal(kcal: number, unit: EnergyUnit): number {
  return unit === "kJ" ? kcal * KJ_PER_KCAL : kcal;
}
