// Light, dark or "follow the system" appearance.
//
// How it works (docs/design/phase-3-core.md D10): tokens.css switches to the
// dark colours either when <html data-theme="dark"> is set, or when the
// system is dark and the user did not force light. So "system" needs no
// JavaScript at all – we only set or remove one attribute.

import type { SettingsMap } from "../db/types";

export type Theme = SettingsMap["theme"];

/**
 * Background of the browser bar (`<meta name="theme-color">`): `--bg-app` of
 * each theme. Checked against design/tokens.json by tests/unit/theme.test.ts.
 */
export const THEME_COLORS = { light: "#F6F5F0", dark: "#141818" } as const;

/**
 * The colour a `<meta name="theme-color" media="(prefers-color-scheme: …)">`
 * tag should hold. Each tag only applies while its media query matches; when
 * the user forces a theme, both tags get that theme's colour.
 */
export function themeColorFor(theme: Theme, scheme: "light" | "dark"): string {
  return THEME_COLORS[theme === "system" ? scheme : theme];
}

/** Applies `theme` to the page at once (no reload). */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);

  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const scheme = meta.media.includes("dark") ? "dark" : "light";
    meta.content = themeColorFor(theme, scheme);
  }
}
