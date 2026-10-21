// A list row ("Eintrag"): name and a small line on the left, a value (and
// an optional small caption) on the right, optionally a chevron.
//
//   Haferflocken                223 kcal      ← entry on the today page
//   60 g                                        (a button: opens the sheet)
//
//   Skyr Natur                   63 kcal  ›   ← food in the search list
//   Milbona · Becher 150 g      pro 100 g      (a link to the Portion page)
//
// The whole row is one button or link, so it is one big touch target and
// one tab stop; its accessible name is all of its text in reading order.
import { el } from "./dom";
import { icon } from "./icons";

export interface ListRowOptions {
  title: string;
  subtitle?: string;
  value?: string;
  valueCaption?: string;
  /** A link to this address (adds the chevron)… */
  href?: string;
  /** …or a button that runs this. Without either, the row is plain text. */
  onClick?: () => void;
}

export function listRow(opts: ListRowOptions): HTMLElement {
  const children: Node[] = [
    el("span", { class: "list-row__main" }, [
      el("span", { class: "list-row__title" }, [opts.title]),
      ...(opts.subtitle === undefined
        ? []
        : [el("span", { class: "list-row__subtitle" }, [opts.subtitle])]),
    ]),
  ];
  if (opts.value !== undefined) {
    children.push(
      el("span", { class: "list-row__end" }, [
        el("span", { class: "list-row__value num" }, [opts.value]),
        ...(opts.valueCaption === undefined
          ? []
          : [el("span", { class: "list-row__caption" }, [opts.valueCaption])]),
      ]),
    );
  }

  if (opts.href !== undefined) {
    children.push(icon("forward", "icon list-row__chevron"));
    return el("a", { class: "list-row list-row--link", href: opts.href }, children);
  }
  if (opts.onClick !== undefined) {
    const button = el("button", { type: "button", class: "list-row list-row--button" }, children);
    button.addEventListener("click", opts.onClick);
    return button;
  }
  return el("div", { class: "list-row" }, children);
}
