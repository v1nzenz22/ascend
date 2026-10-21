// Locale-aware formatting of numbers, amounts, energy and dates.
//
// All formatters are created once and reused: building `Intl` objects is
// comparatively slow, and the app formats many numbers per screen.
// German output uses a decimal comma, a thousands dot and a non-breaking
// space (U+00A0) between number and unit, so the two never wrap apart.
//
// Two rules for every formatter:
// - signDisplay "negative": -0 (and values like -0.04 that round to 0)
//   show as "0", never as "-0". Real negative numbers keep their minus.
// - NaN and ±Infinity are not real amounts (e.g. an unknown value that slipped
//   through). They show a clear placeholder instead of "NaN" or "∞".
import { LOCALE, t } from "./i18n";
import { parseLocalDate, type LocalDate } from "../lib/local-date";

/** kJ per kcal (thermochemical calorie, as used on food labels). */
export const KJ_PER_KCAL = 4.184;

export type EnergyUnit = "kcal" | "kJ";

// Written as an escape: the character itself looks exactly like a space.
const NBSP = "\u00A0";

// One formatter per "maximum fraction digits" value, created on first use.
const numberFormats = new Map<number, Intl.NumberFormat>();

function numberFormat(maxFractionDigits: number): Intl.NumberFormat {
  let format = numberFormats.get(maxFractionDigits);
  if (format === undefined) {
    format = new Intl.NumberFormat(LOCALE, {
      maximumFractionDigits: maxFractionDigits,
      signDisplay: "negative",
    });
    numberFormats.set(maxFractionDigits, format);
  }
  return format;
}

const gramFormat = new Intl.NumberFormat(LOCALE, {
  style: "unit",
  unit: "gram",
  maximumFractionDigits: 1,
  signDisplay: "negative",
});

const millilitreFormat = new Intl.NumberFormat(LOCALE, {
  style: "unit",
  unit: "milliliter",
  maximumFractionDigits: 1,
  signDisplay: "negative",
});

// For values put into an <input>: no thousands dot, because parseDecimal
// reads "1.000" as 1 (see D4). Three decimals keep values like 0,025 g salt.
const inputFormat = new Intl.NumberFormat(LOCALE, {
  useGrouping: false,
  maximumFractionDigits: 3,
  signDisplay: "negative",
});

const dateFormats = {
  long: new Intl.DateTimeFormat(LOCALE, { dateStyle: "long" }),
  short: new Intl.DateTimeFormat(LOCALE, { dateStyle: "short" }),
} as const;

// "Dienstag, 20. Oktober": the subtitle of the today page.
const weekdayFormat = new Intl.DateTimeFormat(LOCALE, {
  weekday: "long",
  day: "numeric",
  month: "long",
});

// "Mi., 14." in German; formatDayShort turns the parts into "Mi 14.".
const dayShortFormat = new Intl.DateTimeFormat(LOCALE, { weekday: "short", day: "numeric" });

/** The placeholder shown instead of a number that is not finite. */
function unknownNumber(): string {
  return t("number.unknown");
}

/** `1234.5` → `"1.234,5"`. Rounds to at most `maxFractionDigits` decimals. */
export function formatNumber(n: number, maxFractionDigits = 1): string {
  if (!Number.isFinite(n)) return unknownNumber();
  return numberFormat(maxFractionDigits).format(n);
}

/**
 * `1234.5` → `"1234,5"`: a number to pre-fill an input field with. Unlike
 * `formatNumber` there is no thousands dot, so `parseDecimal` reads the text
 * back as the same number (for up to three decimals). Not-finite values give
 * an empty field.
 */
export function formatForInput(n: number): string {
  if (!Number.isFinite(n)) return "";
  return inputFormat.format(n);
}

/**
 * Intl's German data uses a normal space before "g" but a non-breaking one
 * before "ml". Normalise to non-breaking, so an amount never wraps between
 * number and unit.
 */
function keepTogether(text: string): string {
  // The first argument is a normal space (U+0020).
  return text.replaceAll(" ", NBSP);
}

/** `25` → `"25 g"`. */
export function formatGrams(n: number): string {
  if (!Number.isFinite(n)) return unknownNumber();
  return keepTogether(gramFormat.format(n));
}

/** `250` → `"250 ml"`. */
export function formatMillilitres(n: number): string {
  if (!Number.isFinite(n)) return unknownNumber();
  return keepTogether(millilitreFormat.format(n));
}

/**
 * Formats an energy value that is stored in kcal, in the unit the user
 * prefers. `Intl` has no kilocalorie/kilojoule unit, so the unit text comes
 * from the message file.
 */
export function formatEnergy(kcal: number, unit: EnergyUnit): string {
  // Without a number the unit alone ("– kcal") would only add noise.
  if (!Number.isFinite(kcal)) return unknownNumber();
  if (unit === "kJ") {
    return formatNumber(kcal * KJ_PER_KCAL, 0) + NBSP + t("unit.kJ");
  }
  return formatNumber(kcal, 0) + NBSP + t("unit.kcal");
}

/** `'2026-10-20'` → `"20. Oktober 2026"` (long) or `"20.10.26"` (short). */
export function formatDate(date: LocalDate, style: "long" | "short"): string {
  return dateFormats[style].format(parseLocalDate(date));
}

/** `'2026-10-20'` → `"Dienstag, 20. Oktober"` (no year: it is about this week). */
export function formatWeekday(date: LocalDate): string {
  return weekdayFormat.format(parseLocalDate(date));
}

/**
 * `'2026-10-14'` → `"Mi 14."`: the short label under a bar of the week chart.
 *
 * German Intl writes "Mi., 14." – the dot and comma take room under narrow
 * bars, and the design drops them. The parts come from Intl (so the weekday
 * names stay correct); only the dots of the abbreviation and the separator
 * are left out.
 */
export function formatDayShort(date: LocalDate): string {
  const parts = dayShortFormat.formatToParts(parseLocalDate(date));
  const weekday = parts.find((part) => part.type === "weekday")?.value.replace(/\.$/, "") ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  return `${weekday} ${day}.`;
}
