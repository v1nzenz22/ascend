// Checks that src/styles/tokens.css matches design/tokens.json, so the
// hand-written CSS cannot drift away from the design tokens unnoticed.
import { describe, expect, test } from "vitest";
import tokens from "../../design/tokens.json";
import css from "../../src/styles/tokens.css?raw";

type ThemeName = "light" | "dark";
type ThemeKey = keyof typeof tokens.theme.light;

/** `ruleSoft` → `rule-soft` */
function kebab(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

// tokens.json theme key → CSS variable (docs/design/phase-3-core.md §7.1).
const THEME_VARIABLES: Record<ThemeKey, string> = {
  bgApp: "--bg-app",
  bgSurface: "--bg-surface",
  bgChrome: "--bg-chrome",
  bgField: "--bg-field",
  lineRule: "--line-rule",
  lineSoft: "--line-soft",
  textPrimary: "--text",
  textMuted: "--text-muted",
  textDisabled: "--text-disabled",
  textInverse: "--text-inverse",
  accent: "--accent",
  accentOn: "--accent-on",
  accentSoft: "--accent-soft",
  statusWarning: "--status-warning",
  statusDanger: "--status-danger",
  buttonPrimary: "--button-primary",
  buttonPrimaryPressed: "--button-primary-pressed",
  focusRing: "--focus-ring",
};

// font.size key → CSS variable on the phone. `body` (13 px) is the desktop
// Body style; on the phone --font-size-body uses Mobile/Body (checked below).
const FONT_VARIABLES: Record<keyof typeof tokens.font.size, string | null> = {
  caption: "--font-size-caption",
  body: null,
  heading: "--font-size-heading",
  title: "--font-size-title",
  display: "--font-size-display",
  mobileBody: "--font-size-body",
  mobileLabel: "--font-size-label",
  mono: "--font-size-mono",
  input: "--font-size-input",
  numberLarge: "--font-size-number-lg",
  numberMedium: "--font-size-number-md",
};

/** Collects `--name: value;` declarations from a piece of CSS. */
function declarations(block: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const match of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    const [, name, value] = match;
    if (name !== undefined && value !== undefined) result.set(name, value.trim());
  }
  return result;
}

/** The declarations inside the `{ … }` that follows `selector`. */
function block(selector: string): Map<string, string> {
  const start = css.indexOf(selector);
  if (start === -1) return new Map();
  // Blocks here contain no nested braces except the media query wrapper,
  // so the first "}" after the selector's own "{" ends it.
  const open = css.indexOf("{", start + selector.length - 1);
  const close = css.indexOf("}", open);
  return declarations(css.slice(open + 1, close));
}

const lightVars = block(":root {");
const desktopVars = block("@media (min-width: 60rem) {\n  :root {");
const forcedDarkVars = block(':root[data-theme="dark"] {');
const systemDarkVars = block(':root:not([data-theme="light"]) {');

/** Follows `var(--x)` until a plain value is reached. */
function resolve(vars: Map<string, string>, value: string | undefined): string | undefined {
  const reference = value === undefined ? null : /^var\((--[\w-]+)\)$/.exec(value);
  if (reference?.[1] === undefined) return value?.toLowerCase();
  return resolve(vars, vars.get(reference[1]) ?? lightVars.get(reference[1]));
}

/** Resolves `{color.mint}` references in tokens.json to their hex value. */
function tokenValue(value: string): string {
  const reference = /^\{color\.(\w+)\}$/.exec(value);
  if (reference?.[1] === undefined) return value.toLowerCase();
  const colors: Record<string, string> = tokens.color;
  const hex = colors[reference[1]];
  if (hex === undefined) throw new Error(`Unknown token reference ${value}`);
  return hex.toLowerCase();
}

const rem = (px: number): string => `${String(px / 16)}rem`;

describe("tokens.css", () => {
  test("found the light, desktop and both dark blocks", () => {
    expect(lightVars.size).toBeGreaterThan(30);
    expect(desktopVars.size).toBeGreaterThan(0);
    expect(forcedDarkVars.size).toBe(Object.keys(THEME_VARIABLES).length);
    expect(systemDarkVars.size).toBe(Object.keys(THEME_VARIABLES).length);
  });

  test("the forced and the system dark theme are identical", () => {
    expect([...systemDarkVars]).toEqual([...forcedDarkVars]);
  });

  test("dark mode is applied by attribute and by system setting", () => {
    expect(css).toContain(':root[data-theme="dark"] {\n  color-scheme: dark;');
    expect(css).toContain(
      '@media (prefers-color-scheme: dark) {\n  :root:not([data-theme="light"]) {\n    color-scheme: dark;',
    );
  });

  test.each(Object.entries(tokens.color))("primitive colour %s", (name, hex) => {
    expect(lightVars.get(`--color-${kebab(name)}`)?.toLowerCase()).toBe(hex.toLowerCase());
  });

  for (const theme of ["light", "dark"] as ThemeName[]) {
    const vars = theme === "light" ? lightVars : forcedDarkVars;
    test.each(Object.entries(tokens.theme[theme]))(`${theme} theme %s`, (key, value) => {
      const variable = THEME_VARIABLES[key as ThemeKey];
      expect(resolve(vars, vars.get(variable))).toBe(tokenValue(value));
    });
  }

  test("every theme key has a CSS variable", () => {
    expect(Object.keys(THEME_VARIABLES).sort()).toEqual(Object.keys(tokens.theme.light).sort());
    expect(Object.keys(tokens.theme.dark).sort()).toEqual(Object.keys(tokens.theme.light).sort());
  });

  test("font families match", () => {
    expect(lightVars.get("--font-ui")).toBe(tokens.font.family.ui);
    expect(lightVars.get("--font-display")).toBe(tokens.font.family.display);
    expect(lightVars.get("--font-mono")).toBe(tokens.font.family.mono);
  });

  test.each(Object.entries(FONT_VARIABLES).filter(([, v]) => v !== null))(
    "font size %s",
    (key, variable) => {
      const px = tokens.font.size[key as keyof typeof tokens.font.size];
      expect(lightVars.get(variable ?? "")).toBe(rem(px));
    },
  );

  test("wide screens use the desktop body size", () => {
    expect(desktopVars.get("--font-size-body")).toBe(rem(tokens.font.size.body));
  });

  test("inputs are at least 16 px (no iOS zoom)", () => {
    expect(tokens.font.size.input).toBeGreaterThanOrEqual(16);
  });

  test.each(Object.entries(tokens.font.weight))("font weight %s", (name, weight) => {
    expect(lightVars.get(`--font-weight-${name}`)).toBe(String(weight));
  });

  test.each(Object.entries(tokens.space))("space %s", (step, px) => {
    expect(lightVars.get(`--space-${step}`)).toBe(rem(px));
  });

  test.each(Object.entries(tokens.radius))("radius %s", (name, px) => {
    expect(lightVars.get(`--radius-${kebab(name)}`)).toBe(`${String(px)}px`);
  });

  test.each(Object.entries(tokens.size))("size %s", (name, px) => {
    expect(lightVars.get(`--size-${kebab(name)}`)).toBe(rem(px));
  });
});
