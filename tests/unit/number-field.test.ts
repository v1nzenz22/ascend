import { describe, expect, test } from "vitest";
import { de } from "../../src/i18n/de";
import { checkNumberInput, type NumberRules } from "../../src/ui/number-field";

const OPTIONAL: NumberRules = { required: false, min: 0, max: 100 };
const REQUIRED: NumberRules = { required: true, min: 0, max: 1000 };
const AMOUNT: NumberRules = { required: true, min: 0, minExclusive: true, max: 10000 };

describe("checkNumberInput", () => {
  test("empty optional field is unknown (null), never 0", () => {
    expect(checkNumberInput("", OPTIONAL)).toEqual({ ok: true, value: null });
    expect(checkNumberInput("   ", OPTIONAL)).toEqual({ ok: true, value: null });
  });

  test("empty required field is an error", () => {
    expect(checkNumberInput("", REQUIRED)).toEqual({ ok: false, message: de["field.required"] });
  });

  test("reads the decimal comma and the dot", () => {
    expect(checkNumberInput("4,5", OPTIONAL)).toEqual({ ok: true, value: 4.5 });
    expect(checkNumberInput("4.5", OPTIONAL)).toEqual({ ok: true, value: 4.5 });
  });

  test("text that is no number", () => {
    expect(checkNumberInput("abc", OPTIONAL)).toEqual({
      ok: false,
      message: de["field.notANumber"],
    });
  });

  test("negative numbers get the design's message", () => {
    expect(checkNumberInput("-5", OPTIONAL)).toEqual({
      ok: false,
      message: "Bitte eine Zahl ab 0 eingeben.",
    });
  });

  test("limits", () => {
    expect(checkNumberInput("0", OPTIONAL)).toEqual({ ok: true, value: 0 });
    expect(checkNumberInput("100", OPTIONAL)).toEqual({ ok: true, value: 100 });
    expect(checkNumberInput("100,5", OPTIONAL)).toEqual({
      ok: false,
      message: "Bitte eine Zahl bis 100 eingeben.",
    });
    // Thousands are formatted in the message.
    expect(checkNumberInput("20000", AMOUNT)).toEqual({
      ok: false,
      message: "Bitte eine Zahl bis 10.000 eingeben.",
    });
  });

  test("an exclusive minimum rejects the minimum itself", () => {
    expect(checkNumberInput("0", AMOUNT)).toEqual({
      ok: false,
      message: "Bitte eine Zahl größer als 0 eingeben.",
    });
    expect(checkNumberInput("0,1", AMOUNT)).toEqual({ ok: true, value: 0.1 });
  });
});
