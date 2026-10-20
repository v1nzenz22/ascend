import { describe, expect, test } from "vitest";
import { de } from "../../src/i18n/de";
import { interpolate, LANGUAGE, LOCALE, t } from "../../src/i18n/i18n";

describe("t", () => {
  test("returns the German text for a key", () => {
    expect(t("nav.today")).toBe("Heute");
    expect(t("nav.settings")).toBe("Einstellungen");
  });

  test("navigation labels match the FigCraft design", () => {
    expect([t("nav.today"), t("nav.add"), t("nav.goals"), t("nav.settings")]).toEqual([
      "Heute",
      "Hinzufügen",
      "Ziele",
      "Einstellungen",
    ]);
  });

  test("returns every message unchanged when there are no params", () => {
    for (const key of Object.keys(de) as (keyof typeof de)[]) {
      expect(t(key)).toBe(de[key]);
    }
  });

  test("passes params through to the text", () => {
    // No Phase 2 message has a placeholder yet; the text stays unchanged.
    expect(t("app.name", { unused: "x" })).toBe("ascend");
  });

  test("locale is German", () => {
    expect(LOCALE).toBe("de-DE");
    expect(LANGUAGE).toBe("de");
  });

  test("rejects unknown keys at compile time", () => {
    // If `t` ever accepted an unknown key, the directive below would be
    // unused and `tsc` (npm run check) would fail.
    // @ts-expect-error: 'does.not.exist' is not a MessageKey
    expect(t("does.not.exist")).toBeUndefined();
  });
});

describe("interpolate", () => {
  test("replaces {param} placeholders with strings and numbers", () => {
    expect(interpolate("{amount} von {total}", { amount: "1.250", total: 2000 })).toBe(
      "1.250 von 2000",
    );
  });

  test("replaces every occurrence", () => {
    expect(interpolate("{x} und {x}", { x: "a" })).toBe("a und a");
  });

  test("leaves unknown placeholders visible", () => {
    expect(interpolate("Hallo {name}", {})).toBe("Hallo {name}");
  });

  test("ignores braces that are not placeholders", () => {
    expect(interpolate("{ } {-}", { x: "a" })).toBe("{ } {-}");
  });
});
