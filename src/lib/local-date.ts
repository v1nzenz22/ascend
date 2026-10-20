// Calendar days in the user's own time zone, stored as 'YYYY-MM-DD'.
//
// Why strings: they sort correctly as text, compare with `<`, work as
// IndexedDB keys and are readable in exports. An entry keeps the day it was
// logged for, even if the user later travels to another time zone.

/** A calendar day in local time, written as 'YYYY-MM-DD'. */
export type LocalDate = string;

const LOCAL_DATE_SHAPE = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

/**
 * The local calendar day of `d`.
 * Never use `d.toISOString().slice(0, 10)`: that is the UTC day, which is
 * wrong between midnight and 01:00/02:00 in Germany.
 * Throws a RangeError for an invalid Date (e.g. `new Date("abc")`), which
 * would otherwise become the string "NaN-NaN-NaN" and be stored as a day.
 */
export function toLocalDate(d: Date): LocalDate {
  if (Number.isNaN(d.getTime())) throw new RangeError("Not a valid Date");
  return `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1, 2)}-${pad(d.getDate(), 2)}`;
}

/**
 * Year, month (1–12) and day of `s`, or `null` if `s` is not a real calendar
 * day in the shape 'YYYY-MM-DD'. Shared by `isLocalDate` and
 * `parseLocalDate`, so both always agree on what a valid day is.
 */
function matchLocalDate(s: string): [year: number, month: number, day: number] | null {
  const match = LOCAL_DATE_SHAPE.exec(s);
  if (match === null) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  // `new Date` silently rolls invalid days over (Feb 30 → Mar 2), so build
  // the date and check that nothing moved.
  const d = new Date(year, month - 1, day, 12);
  const real = d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
  return real ? [year, month, day] : null;
}

/** True if `s` has the shape 'YYYY-MM-DD' and is a real calendar day. */
export function isLocalDate(s: string): boolean {
  return matchLocalDate(s) !== null;
}

/**
 * Turns a local date into a `Date` at **noon** local time.
 * Noon (not midnight) so a daylight-saving jump can never move it to the
 * previous or next day. Never use `new Date('2026-10-20')`: that string is
 * parsed as UTC midnight.
 */
export function parseLocalDate(s: LocalDate): Date {
  const parts = matchLocalDate(s);
  if (parts === null) throw new RangeError(`Not a local date: ${s}`);
  const [year, month, day] = parts;
  return new Date(year, month - 1, day, 12);
}

/** Today's date in the user's time zone. */
export function todayLocal(): LocalDate {
  return toLocalDate(new Date());
}

/**
 * The local date `n` days after `date` (negative `n` goes back).
 * `n` must be a whole number: "half a day later" has no calendar meaning,
 * and `setDate` would silently drop the fraction.
 */
export function addDays(date: LocalDate, n: number): LocalDate {
  if (!Number.isInteger(n)) throw new RangeError(`Not a whole number of days: ${String(n)}`);
  const d = parseLocalDate(date);
  // setDate handles month and year boundaries; starting at noon keeps the
  // result on the right day across daylight-saving changes.
  d.setDate(d.getDate() + n);
  return toLocalDate(d);
}
