import { describe, expect, test } from "vitest";
import { de, MESSAGE_FILES } from "../../src/i18n/de";
import { interpolate, LANGUAGE, LOCALE, plural, t } from "../../src/i18n/i18n";

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

describe("message files", () => {
  test("no key appears in two files (one would silently win)", () => {
    const seen = new Map<string, string>();
    const duplicates: string[] = [];
    for (const [file, messages] of Object.entries(MESSAGE_FILES)) {
      for (const key of Object.keys(messages)) {
        const other = seen.get(key);
        if (other !== undefined) duplicates.push(`${key} (${other}, ${file})`);
        seen.set(key, file);
      }
    }
    expect(duplicates).toEqual([]);
    expect(Object.keys(de).length).toBe(seen.size);
  });

  test("the app description no longer says 'ohne Konto'", () => {
    expect(t("app.description")).toBe(
      "Kalorien und Nährwerte erfassen – offline und ohne Tracking.",
    );
  });

  test("every message is a non-empty string", () => {
    for (const value of Object.values(de)) {
      expect(typeof value).toBe("string");
      expect(value.trim()).not.toBe("");
    }
  });
});

describe("plural", () => {
  // Real plural keys arrive with the screens; field.belowMin / aboveMax
  // stand in as "one" / "other" texts with a placeholder.
  const keys = { one: "field.belowMin", other: "field.aboveMax" } as const;

  test("German: 1 is singular, 0 and 2+ are plural", () => {
    expect(plural(1, keys, { min: "x" })).toBe("Bitte eine Zahl ab x eingeben.");
    expect(plural(0, keys, { max: "y" })).toBe("Bitte eine Zahl bis y eingeben.");
    expect(plural(6, keys, { max: "y" })).toBe("Bitte eine Zahl bis y eingeben.");
  });

  // No message uses {count} yet; the dashboard (P8) adds the first ones
  // ("6 volle Tage") together with a test of the filled-in number.
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
