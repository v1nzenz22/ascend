// Empty state ("Leerzustand"): the large "a" of the logo, a title in the
// display font, a short text, a main action and an optional second one.
// E.g. "Noch keine Ziele" with "Ziele festlegen" / "Ohne Ziel loslegen".
import { el } from "./dom";
import { button, buttonLink } from "./button";

/** An action is a link (`href`) or a button (`onClick`). */
export type EmptyStateAction =
  { label: string; href: string } | { label: string; onClick: () => void };

export interface EmptyStateOptions {
  title: string;
  text: string;
  action?: EmptyStateAction;
  secondary?: EmptyStateAction;
}

function actionElement(action: EmptyStateAction, variant: "primary" | "text"): HTMLElement {
  return "href" in action
    ? buttonLink(action.label, variant, action.href)
    : button(action.label, variant, action.onClick);
}

export function emptyState(opts: EmptyStateOptions): HTMLElement {
  return el("section", { class: "empty-state" }, [
    // The logo letter is decoration; the title says what this is.
    el("p", { class: "empty-state__mark", "aria-hidden": "true" }, ["a"]),
    el("h2", { class: "empty-state__title" }, [opts.title]),
    el("p", { class: "empty-state__text" }, [opts.text]),
    ...(opts.action === undefined ? [] : [actionElement(opts.action, "primary")]),
    ...(opts.secondary === undefined ? [] : [actionElement(opts.secondary, "text")]),
  ]);
}
