import { describe, expect, test } from "vitest";
import tokens from "../../design/tokens.json";
import { THEME_COLORS, themeColorFor } from "../../src/app/theme";

describe("theme colours", () => {
  test("match bgApp of both themes in tokens.json", () => {
    // light bgApp is a reference to color.paper
    expect(tokens.theme.light.bgApp).toBe("{color.paper}");
    expect(THEME_COLORS.light).toBe(tokens.color.paper);
    expect(THEME_COLORS.dark).toBe(tokens.theme.dark.bgApp);
  });

  test("system: each meta tag keeps its own scheme's colour", () => {
    expect(themeColorFor("system", "light")).toBe(THEME_COLORS.light);
    expect(themeColorFor("system", "dark")).toBe(THEME_COLORS.dark);
  });

  test("a forced theme wins over the system scheme", () => {
    expect(themeColorFor("dark", "light")).toBe(THEME_COLORS.dark);
    expect(themeColorFor("light", "dark")).toBe(THEME_COLORS.light);
  });
});
