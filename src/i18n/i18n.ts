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
