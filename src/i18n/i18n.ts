// Tiny translation helper. German is the only language for now; the
// structure allows adding more later without changing callers.
import { de, type MessageKey } from "./de";

/** Locale used for all `Intl` formatting (numbers, dates, units). */
export const LOCALE = "de-DE";

/** Language code for `<html lang>`. */
export const LANGUAGE = "de";

// Matches {name} placeholders. Only letters, digits and underscores, so a
// stray "{" in a text is left alone.
const PLACEHOLDER = /\{(\w+)\}/g;

/**
 * Replaces `{param}` placeholders in `text`. A placeholder without a matching
 * param is left visible, which makes the mistake easy to spot instead of
 * silently printing an empty string.
 */
export function interpolate(text: string, params: Record<string, string | number>): string {
  return text.replace(PLACEHOLDER, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

/**
 * Returns the text for `key`, with `{param}` placeholders replaced.
 * Numbers in `params` should already be formatted by the caller
 * (e.g. with `formatNumber`), so this function stays simple.
 */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const text: string = de[key];
  return params === undefined ? text : interpolate(text, params);
}

// Created once: building Intl objects is comparatively slow.
const pluralRules = new Intl.PluralRules(LOCALE);
const countFormat = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });

/**
 * Picks the singular or plural text for `count`, e.g.
 * `plural(6, { one: 'week.fullDay', other: 'week.fullDays' })` → "6 volle Tage".
 *
 * German only needs "one" and "other"; `Intl.PluralRules` decides which one
 * applies (1 → one, 0 and 2+ → other), so the rule is not hand-written and
 * later languages with more forms only add keys. The text can use `{count}`,
 * which is filled in with the formatted number ("1.000"); `params` may
 * override it or add more placeholders.
 */
export function plural(
  count: number,
  keys: { one: MessageKey; other: MessageKey },
  params?: Record<string, string | number>,
): string {
  const key = pluralRules.select(count) === "one" ? keys.one : keys.other;
  return t(key, { count: countFormat.format(count), ...params });
}
