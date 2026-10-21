// Tiny helpers for building DOM elements without a framework.
//
// Text is always set with `textContent`, never `innerHTML`: whatever the
// string contains (user input, data from Open Food Facts), the browser shows
// it as plain text and never runs it as HTML or script.

/** Attributes to set. `true` sets an empty attribute, `false` leaves it out. */
export type Attributes = Record<string, string | number | boolean>;

/** A child is either an element or plain text. */
export type Child = Node | string;

function setAttributes(element: Element, attributes: Attributes): void {
  for (const [name, value] of Object.entries(attributes)) {
    if (value === false) continue;
    element.setAttribute(name, value === true ? "" : String(value));
  }
}

function appendChildren(element: Element, children: readonly Child[]): void {
  for (const child of children) {
    // A string becomes a text node: the safe equivalent of textContent.
    element.append(typeof child === "string" ? document.createTextNode(child) : child);
  }
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Attributes = {},
  children: readonly Child[] = [],
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  setAttributes(element, attributes);
  appendChildren(element, children);
  return element;
}

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

/**
 * Like `el`, but for SVG elements (icons, the day ring, the week chart).
 * SVG elements must be created in the SVG namespace: `createElement('svg')`
 * would make an unknown HTML element that the browser never draws.
 *
 * Set presentation values (colours, `stroke-dasharray`) as attributes here,
 * never through a `style` attribute: the Content Security Policy blocks
 * inline style attributes.
 */
export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Attributes = {},
  children: readonly Child[] = [],
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NAMESPACE, tag);
  setAttributes(element, attributes);
  appendChildren(element, children);
  return element;
}

/** Text only for screen readers (see `.visually-hidden` in base.css). */
export function visuallyHidden(text: string): HTMLSpanElement {
  return el("span", { class: "visually-hidden" }, [text]);
}

/**
 * Ids for elements that are linked with `aria-describedby` /
 * `aria-labelledby`. A counter is enough: ids only need to be unique within
 * the page, and they are never stored.
 */
let nextId = 0;
export function uniqueId(prefix: string): string {
  nextId += 1;
  return `${prefix}-${String(nextId)}`;
}
