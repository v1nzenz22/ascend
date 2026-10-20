// A tiny helper for building DOM elements without a framework.
//
// Text is always set with `textContent`, never `innerHTML`: whatever the
// string contains (user input, data from Open Food Facts), the browser shows
// it as plain text and never runs it as HTML or script.

/** Attributes to set. `true` sets an empty attribute, `false` leaves it out. */
export type Attributes = Record<string, string | number | boolean>;

/** A child is either an element or plain text. */
export type Child = Node | string;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Attributes = {},
  children: readonly Child[] = [],
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (value === false) continue;
    element.setAttribute(name, value === true ? "" : String(value));
  }
  for (const child of children) {
    // A string becomes a text node: the safe equivalent of textContent.
    element.append(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return element;
}
