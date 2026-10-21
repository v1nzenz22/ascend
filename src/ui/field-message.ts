// The line under a form field: a hint ("Wie es auf der Packung steht.") or,
// after a failed check, the error ("Bitte einen Namen eingeben.").
//
// Shared by text-field.ts and number-field.ts so both behave the same:
// - the error replaces the hint (as in the design);
// - the input is linked to whatever is shown with `aria-describedby`, so a
//   screen reader reads the hint or the error together with the field;
// - `aria-invalid="true"` marks the field; CSS draws the red border from it,
//   and the text says what is wrong (colour is never the only signal).
import { el } from "./dom";

export interface FieldMessage {
  /** The <p> to place under the field. Hidden while there is nothing to say. */
  element: HTMLParagraphElement;
  /** Shows `message` as an error, or the hint again for `null`. */
  setError: (message: string | null) => void;
}

/**
 * @param input the field the message belongs to
 * @param id the message element's id
 * @param hint optional hint shown while there is no error
 * @param extraDescribedBy ids that always describe the field (e.g. the unit)
 */
export function fieldMessage(
  input: HTMLInputElement,
  id: string,
  hint: string | undefined,
  extraDescribedBy: readonly string[] = [],
): FieldMessage {
  const element = el("p", { class: "field-message", id });

  const setError = (message: string | null): void => {
    const text = message ?? hint ?? "";
    element.textContent = text;
    element.hidden = text === "";
    element.classList.toggle("field-message--error", message !== null);

    if (message === null) input.removeAttribute("aria-invalid");
    else input.setAttribute("aria-invalid", "true");

    const describedBy = [...extraDescribedBy, ...(text === "" ? [] : [id])];
    if (describedBy.length === 0) input.removeAttribute("aria-describedby");
    else input.setAttribute("aria-describedby", describedBy.join(" "));
  };

  setError(null);
  return { element, setError };
}
