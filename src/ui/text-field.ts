// A labelled text input ("Textfeld"): label above, field, hint or error
// below. Checked when the field loses focus and when the form is submitted
// (`read()`), never while typing – an error that appears after the first
// letter is only noise.
import { t } from "../i18n/i18n";
import { el } from "./dom";
import { fieldMessage } from "./field-message";

export interface TextFieldOptions {
  id: string;
  label: string;
  hint?: string;
  value?: string;
  placeholder?: string;
  required?: boolean;
  /** Error text for an empty required field (default: "Bitte einen Wert eingeben."). */
  requiredMessage?: string;
  /** Maximum length after trimming (see src/domain/limits.ts). */
  maxLength?: number;
  /** e.g. "off" for food names, so the browser does not offer old entries. */
  autocomplete?: string;
}

export type TextReadResult = { ok: true; value: string } | { ok: false; message: string };

export interface TextField {
  element: HTMLElement;
  input: HTMLInputElement;
  /** Checks the value, shows or clears the error, returns the trimmed text. */
  read: () => TextReadResult;
  /** Shows an error that comes from elsewhere (e.g. a failed save), or clears it. */
  setError: (message: string | null) => void;
}

export function textField(opts: TextFieldOptions): TextField {
  const input = el("input", {
    id: opts.id,
    type: "text",
    class: "field__input",
    autocomplete: opts.autocomplete ?? "off",
    ...(opts.placeholder !== undefined && { placeholder: opts.placeholder }),
    ...(opts.required === true && { "aria-required": "true" }),
  });
  input.value = opts.value ?? "";

  const message = fieldMessage(input, `${opts.id}-message`, opts.hint);

  const check = (): TextReadResult => {
    const value = input.value.trim();
    if (value === "" && opts.required === true) {
      return { ok: false, message: opts.requiredMessage ?? t("field.required") };
    }
    if (opts.maxLength !== undefined && value.length > opts.maxLength) {
      return { ok: false, message: t("field.tooLong", { max: opts.maxLength }) };
    }
    return { ok: true, value };
  };

  const read = (): TextReadResult => {
    const result = check();
    message.setError(result.ok ? null : result.message);
    return result;
  };

  // Only check on blur once something was typed: tabbing through an empty
  // form should not paint every field red.
  input.addEventListener("blur", () => {
    if (input.value !== "" || input.hasAttribute("aria-invalid")) read();
  });

  const element = el("div", { class: "field" }, [
    el("label", { class: "field__label", for: opts.id }, [opts.label]),
    input,
    message.element,
  ]);

  return { element, input, read, setError: message.setError };
}
