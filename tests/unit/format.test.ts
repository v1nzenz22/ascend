import { describe, expect, test } from "vitest";
import {
  formatDate,
  formatEnergy,
  formatForInput,
  formatGrams,
  formatMillilitres,
  formatNumber,
  KJ_PER_KCAL,
} from "../../src/i18n/format";
import { de } from "../../src/i18n/de";
import { parseDecimal } from "../../src/i18n/parse-decimal";

// Intl puts a non-breaking space (U+00A0) between number and unit. Written
// as an escape because the character itself looks exactly like a space.
const NBSP = "\u00A0";
const UNKNOWN = de["number.unknown"];

describe("formatNumber", () => {
  test("uses a decimal comma and a thousands dot", () => {
    expect(formatNumber(1234.5)).toBe("1.234,5");
  });

  test("rounds to one decimal by default", () => {
    expect(formatNumber(2.345)).toBe("2,3");
    expect(formatNumber(12)).toBe("12");
  });

  test("respects maxFractionDigits", () => {
    expect(formatNumber(2.345, 2)).toBe("2,35");
    expect(formatNumber(2.5, 0)).toBe("3");
  });

  test("never shows a minus sign for zero", () => {
    expect(formatNumber(-0)).toBe("0");
    // Rounds to zero: "-0" would look like an error.
    expect(formatNumber(-0.04)).toBe("0");
    expect(formatNumber(-3)).toBe("-3");
  });

  test("shows a placeholder for values that are not numbers", () => {
    expect(UNKNOWN).toBe("–");
    expect(formatNumber(Number.NaN)).toBe(UNKNOWN);
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBe(UNKNOWN);
  });
});

describe("formatForInput", () => {
  test("uses a decimal comma but no thousands dot", () => {
    // A thousands dot would turn 1000 into "1.000", which parseDecimal reads
    // as 1 (see D4).
    expect(formatForInput(1000)).toBe("1000");
    expect(formatForInput(1234.5)).toBe("1234,5");
    expect(formatForInput(0.5)).toBe("0,5");
  });

  test.each([0, 0.5, 1, 12.5, 100, 1000, 1234.5, 0.025, 99999.125])(
    "round-trips %d through parseDecimal",
    (x) => {
      expect(parseDecimal(formatForInput(x))).toBe(x);
    },
  );

  test("gives an empty field for -0 and values that are not numbers", () => {
    expect(formatForInput(-0)).toBe("0");
    expect(formatForInput(Number.NaN)).toBe("");
    expect(formatForInput(Number.NEGATIVE_INFINITY)).toBe("");
  });
});

describe("amounts", () => {
  test("grams", () => {
    expect(formatGrams(25)).toBe(`25${NBSP}g`);
    expect(formatGrams(12.5)).toBe(`12,5${NBSP}g`);
  });

  test("millilitres", () => {
    expect(formatMillilitres(250)).toBe(`250${NBSP}ml`);
  });

  test("zero and unknown values", () => {
    expect(formatGrams(-0)).toBe(`0${NBSP}g`);
    expect(formatGrams(Number.NaN)).toBe(UNKNOWN);
    expect(formatMillilitres(Number.NaN)).toBe(UNKNOWN);
  });
});

describe("formatEnergy", () => {
  test("kcal without decimals", () => {
    expect(formatEnergy(250, "kcal")).toBe(`250${NBSP}kcal`);
    expect(formatEnergy(1999.6, "kcal")).toBe(`2.000${NBSP}kcal`);
  });

  test("converts kcal to kJ (× 4.184)", () => {
    expect(KJ_PER_KCAL).toBe(4.184);
    // 250 × 4.184 = 1046
    expect(formatEnergy(250, "kJ")).toBe(`1.046${NBSP}kJ`);
  });

  test("zero and unknown values", () => {
    expect(formatEnergy(-0, "kcal")).toBe(`0${NBSP}kcal`);
    expect(formatEnergy(Number.NaN, "kcal")).toBe(UNKNOWN);
    expect(formatEnergy(Number.NaN, "kJ")).toBe(UNKNOWN);
  });
});

describe("formatDate", () => {
  test("long German date", () => {
    expect(formatDate("2026-10-20", "long")).toBe("20. Oktober 2026");
  });

  test("short German date", () => {
    expect(formatDate("2026-10-20", "short")).toBe("20.10.26");
  });
});
