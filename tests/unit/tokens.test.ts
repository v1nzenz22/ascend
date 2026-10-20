// Checks that src/styles/tokens.css matches design/tokens.json, so the
// hand-written CSS cannot drift away from the design tokens unnoticed.
import { describe, expect, test } from "vitest";
import tokens from "../../design/tokens.json";
import css from "../../src/styles/tokens.css?raw";

type ThemeName = "light" | "dark";

/** `ruleSoft` → `rule-soft` */
function kebab(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

// tokens.json theme key → CSS variable (see docs/design/phase-2-skeleton.md §4).
const THEME_VARIABLES: Record<keyof typeof tokens.theme.light, string> = {
  windowBackground: "--bg",
  tabStrip: "--nav-bg",
  tabActive: "--nav-active-bg",
  border: "--border",
  text: "--text",
  textMuted: "--text-muted",
  field: "--field-bg",
  focusRing: "--focus-ring",
  accent: "--accent",
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

// The light theme and primitives live in the first `:root { … }` block;
// the dark theme in the `prefers-color-scheme: dark` media query.
const darkStart = css.indexOf("@media (prefers-color-scheme: dark)");
const rootEnd = css.indexOf("}", css.indexOf(":root"));
const lightVars = declarations(css.slice(0, rootEnd));
const darkVars = declarations(css.slice(darkStart));

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

describe("tokens.css", () => {
  test("found the light and dark blocks", () => {
    expect(darkStart).toBeGreaterThan(0);
    expect(lightVars.size).toBeGreaterThan(0);
    expect(darkVars.size).toBeGreaterThan(0);
  });

  test.each(Object.entries(tokens.color))("primitive colour %s", (name, hex) => {
    expect(lightVars.get(`--color-${kebab(name)}`)?.toLowerCase()).toBe(hex.toLowerCase());
  });

  for (const theme of ["light", "dark"] as ThemeName[]) {
    const vars = theme === "light" ? lightVars : darkVars;
    test.each(Object.entries(tokens.theme[theme]))(`${theme} theme %s`, (key, value) => {
      const variable = THEME_VARIABLES[key as keyof typeof THEME_VARIABLES];
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

  test.each(Object.entries(tokens.space))("space %s", (step, px) => {
    expect(lightVars.get(`--space-${step}`)).toBe(`${String(px / 16)}rem`);
  });

  test.each(Object.entries(tokens.radius))("radius %s", (name, px) => {
    expect(lightVars.get(`--radius-${kebab(name)}`)).toBe(`${String(px)}px`);
  });

  test.each(Object.entries(tokens.size))("size %s", (name, px) => {
    expect(lightVars.get(`--size-${kebab(name)}`)).toBe(`${String(px / 16)}rem`);
  });
});
