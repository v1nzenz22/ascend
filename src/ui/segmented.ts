// Segments ("Segmente"): a row of equal parts on a grey track, the chosen
// one raised in white.
//
// Two kinds that look the same but behave differently:
// - `segmented`: a choice inside the page (kcal · kJ, System · Hell ·
//   Dunkel) – a radio group, see radio-group.ts;
// - `segmentLinks`: tabs that change the address (Suche · Scannen ·
//   Manuell) – real links, the current one marked with
//   aria-current="page", so the back button and reloading work.
import { el } from "./dom";
import { radioGroup, type RadioGroup, type RadioGroupOptions } from "./radio-group";

export type { Choice } from "./radio-group";

export function segmented<V extends string>(opts: RadioGroupOptions<V>): RadioGroup<V> {
  return radioGroup(opts, "segmented");
}

export interface SegmentLink {
  href: string;
  label: string;
  current: boolean;
}

/** @param label accessible name of the group ("Art der Eingabe") */
export function segmentLinks(label: string, links: readonly SegmentLink[]): HTMLElement {
  return el("nav", { class: "segment-links", "aria-label": label }, [
    el(
      "ul",
      {},
      links.map((link) =>
        el("li", {}, [
          el(
            "a",
            {
              href: link.href,
              class: "segment-links__link",
              ...(link.current && { "aria-current": "page" }),
            },
            [link.label],
          ),
        ]),
      ),
    ),
  ]);
}
