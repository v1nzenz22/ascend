// Parses amounts typed by the user, e.g. "12,5" or "12.5".
//
// Lenient on purpose: both "," and "." mean the decimal separator, and
// thousands separators are not allowed. With strict German rules "1.5" would
// mean 15 – a small typo would silently become a 10× nutrition error.
// "1.000" therefore means 1, which is visible right away and rare for food
// amounts.

// Digits, optionally followed by one separator and more digits. At least one
// digit must exist overall (",5" and "12," are fine, "," alone is not).
// The separator and the fraction digits form one optional group: after the
// whole digits the next character must be the separator, so the regex never
// has to try different splits of a long digit run (that "backtracking" made
// the old pattern /^(\d*)[.,]?(\d*)$/ take seconds for pasted long text).
const DECIMAL_SHAPE = /^(\d*)(?:[.,](\d*))?$/;

// No real amount needs more characters. Longer input is rejected before the
// regex runs at all, as a second line of defence against slow matching.
const MAX_LENGTH = 32;

/**
 * Returns the number for `input`, or `null` if it is not a valid amount.
 * No sign, no exponent, no grouping. Whether 0 is allowed is up to the
 * caller.
 */
export function parseDecimal(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed.length > MAX_LENGTH) return null;
  const match = DECIMAL_SHAPE.exec(trimmed);
  if (match === null) return null;
  const whole = match[1] ?? "";
  const fraction = match[2] ?? "";
  if (whole === "" && fraction === "") return null;
  // Rebuild with a dot, the only separator `Number()` understands.
  const value = Number(`${whole === "" ? "0" : whole}.${fraction === "" ? "0" : fraction}`);
  return Number.isFinite(value) ? value : null;
}
