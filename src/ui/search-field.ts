// The search input ("Suchfeld"): a magnifier icon and a field.
//
// type="search" gives the clear button and Escape-to-clear; enterkeyhint
// labels the iPhone's return key "Suchen". The label is only for screen
// readers: the placeholder and the icon already say what the field does,
// but a placeholder is not a reliable accessible name.
import { el, visuallyHidden } from "./dom";
import { icon } from "./icons";

export interface SearchFieldOptions {
  id: string;
  label: string;
  placeholder?: string;
  value?: string;
}

export interface SearchField {
  element: HTMLElement;
  input: HTMLInputElement;
}

export function searchField(opts: SearchFieldOptions): SearchField {
  const input = el("input", {
    id: opts.id,
    type: "search",
    class: "search-field__input",
    enterkeyhint: "search",
    autocomplete: "off",
    // No spelling marks under food names and brands.
    spellcheck: "false",
    ...(opts.placeholder !== undefined && { placeholder: opts.placeholder }),
  });
  input.value = opts.value ?? "";

  const element = el("div", { class: "search-field" }, [
    el("label", { for: opts.id }, [visuallyHidden(opts.label)]),
    icon("search", "icon search-field__icon"),
    input,
  ]);
  return { element, input };
}
