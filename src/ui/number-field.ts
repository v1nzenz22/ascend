// A labelled number input with a unit ("Zahlenfeld"): label on the left,
// the field on the right with the unit inside it ("110 g"), errors below.
//
// Why <input type="text" inputmode="decimal"> and not type="number":
// type="number" rejects "4,5" in some browsers, shows spin buttons, and
// changes the value on scroll. inputmode="decimal" still opens the number
// keyboard with a decimal key on the iPhone; parseDecimal reads "4,5" and
// "4.5" alike.
//
// The field is empty ("–") until the user types: no value is ever invented.
import { formatForInput, formatNumber } from "../i18n/format";
import { t } from "../i18n/i18n";
import { parseDecimal } from "../i18n/parse-decimal";
import { el } from "./dom";
import { fieldMessage } from "./field-message";

export interface NumberRules {
  required: boolean;
  min: number;
  max: number;
  /** true: the value must be greater than `min` (amounts: > 0). */
  minExclusive?: boolean;
}

export type NumberReadResult = { ok: true; value: number | null } | { ok: false; message: string };

/**
 * Checks typed text against the rules. Pure (no DOM), so it is unit-tested
 * directly. Empty text is `null` ("unknown") unless the field is required.
 */
export function checkNumberInput(text: string, rules: NumberRules): NumberReadResult {
  if (text.trim() === "") {
    return rules.required ? { ok: false, message: t("field.required") } : { ok: true, value: null };
  }
  const value = parseDecimal(text);
  // parseDecimal accepts no minus sign, so "-5" lands here too. The design
  // answers it with "Bitte eine Zahl ab 0 eingeben.", which fits better than
  // "not a number" when the minimum is 0.
  if (value === null) {
    return {
      ok: false,
      message: /^\s*-/.test(text) ? belowMinMessage(rules) : t("field.notANumber"),
    };
  }
  if (rules.minExclusive === true ? value <= rules.min : value < rules.min) {
    return { ok: false, message: belowMinMessage(rules) };
  }
  if (value > rules.max) {
    return { ok: false, message: t("field.aboveMax", { max: formatNumber(rules.max, 3) }) };
  }
  return { ok: true, value };
}

function belowMinMessage(rules: NumberRules): string {
  const min = formatNumber(rules.min, 3);
  return rules.minExclusive === true
    ? t("field.notAboveMin", { min })
    : t("field.belowMin", { min });
}

export interface NumberFieldOptions extends NumberRules {
  id: string;
  label: string;
  /**
   * The unit shown inside the field ("g", "kcal"). An element instead of
   * text replaces it completely – e.g. the kcal/kJ toggle button of the
   * manual form, which then needs its own accessible name.
   */
  unit: string | HTMLElement;
  value?: number | null;
  hint?: string;
}

export interface NumberField {
  element: HTMLElement;
  input: HTMLInputElement;
  /** Checks the value, shows or clears the error. */
  read: () => NumberReadResult;
  /** Puts a number into the field (formatted for input), or empties it. */
  setValue: (value: number | null) => void;
  setError: (message: string | null) => void;
}

export function numberField(opts: NumberFieldOptions): NumberField {
  const input = el("input", {
    id: opts.id,
    type: "text",
    inputmode: "decimal",
    autocomplete: "off",
    class: "number-field__input",
    placeholder: t("number.unknown"),
    ...(opts.required && { "aria-required": "true" }),
  });

  const unitId = `${opts.id}-unit`;
  const unitIsText = typeof opts.unit === "string";
  const unit =
    typeof opts.unit === "string"
      ? el("span", { class: "number-field__unit", id: unitId }, [opts.unit])
      : opts.unit;

  // A text unit is part of what the field means ("Eiweiß, g"), so it is
  // linked with aria-describedby. A button brings its own name instead.
  const message = fieldMessage(input, `${opts.id}-message`, opts.hint, unitIsText ? [unitId] : []);

  const setValue = (value: number | null): void => {
    input.value = value === null ? "" : formatForInput(value);
  };
  setValue(opts.value ?? null);

  const read = (): NumberReadResult => {
    const result = checkNumberInput(input.value, opts);
    message.setError(result.ok ? null : result.message);
    return result;
  };

  input.addEventListener("blur", () => {
    if (input.value !== "" || input.hasAttribute("aria-invalid")) read();
  });

  const element = el("div", { class: "number-field" }, [
    el("label", { class: "number-field__label", for: opts.id }, [opts.label]),
    // The visible box: the input and the unit sit side by side inside it.
    el("div", { class: "number-field__box" }, [input, unit]),
    message.element,
  ]);

  return { element, input, read, setValue, setError: message.setError };
}
