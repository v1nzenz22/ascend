// Buttons. The looks live in components.css (classes `button` +
// `button--primary | --secondary | --text | --danger`); these helpers only
// make sure the markup is right:
// - type="button", so a button inside a <form> never submits it by accident;
// - icon-only buttons always get an `aria-label` (the type requires it).
import { el } from "./dom";
import { icon, type IconName } from "./icons";

export type ButtonVariant = "primary" | "secondary" | "text" | "danger";

/** CSS classes for a button or a link that looks like one. */
export function buttonClass(variant: ButtonVariant): string {
  // "danger" is the secondary look with red text (as "Löschen" in the design).
  return variant === "danger"
    ? "button button--secondary button--danger"
    : `button button--${variant}`;
}

export function button(
  label: string,
  variant: ButtonVariant,
  onClick?: () => void,
  type: "button" | "submit" = "button",
): HTMLButtonElement {
  const element = el("button", { type, class: buttonClass(variant) }, [label]);
  if (onClick !== undefined) element.addEventListener("click", onClick);
  return element;
}

/** A link styled as a button (navigation, e.g. "Ziele festlegen"). */
export function buttonLink(label: string, variant: ButtonVariant, href: string): HTMLAnchorElement {
  return el("a", { class: buttonClass(variant), href }, [label]);
}

/** A square button with only an icon (e.g. "+" next to a meal). */
export function iconButton(name: IconName, label: string, onClick?: () => void): HTMLButtonElement {
  const element = el("button", { type: "button", class: "icon-button", "aria-label": label }, [
    icon(name),
  ]);
  if (onClick !== undefined) element.addEventListener("click", onClick);
  return element;
}

/** A link with only an icon; same look as `iconButton`. */
export function iconLink(name: IconName, label: string, href: string): HTMLAnchorElement {
  return el("a", { class: "icon-button", href, "aria-label": label }, [icon(name)]);
}
