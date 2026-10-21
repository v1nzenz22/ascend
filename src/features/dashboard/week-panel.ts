// Placeholder for the week panel of the desktop dashboard (work package P8
// replaces this file). Contract with the Heute page (P4): it calls
// `renderWeekPanel(ctx)` on wide screens and puts the result next to today.
import type { PageContext } from "../../app/page";
import { el } from "../../ui/dom";

// A typed constant, so the placeholder may ignore `ctx` (the real panel
// stops its media-query listener with ctx.signal).
export const renderWeekPanel: (ctx: PageContext) => Promise<HTMLElement> = () =>
  Promise.resolve(el("section", { class: "week-panel" }));
