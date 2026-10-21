// A notice box ("Hinweis"): icon, optional title, text. E.g. "Du bist
// offline" or "Die Online-Suche kommt in einem späteren Update."
//
// A plain block, not a live region: notices are part of the page when it
// is shown. A notice that appears later because something happened should
// be put into an element with role="status" by the caller.
import { el } from "./dom";
import { icon, type IconName } from "./icons";

export interface NoticeOptions {
  icon: IconName;
  title?: string;
  text: string;
  /** "warning": the title in the warning colour (e.g. offline). */
  tone?: "info" | "warning";
}

export function notice(opts: NoticeOptions): HTMLElement {
  const tone = opts.tone ?? "info";
  return el("div", { class: `notice notice--${tone}` }, [
    icon(opts.icon, "icon notice__icon"),
    el("div", { class: "notice__body" }, [
      ...(opts.title === undefined ? [] : [el("p", { class: "notice__title" }, [opts.title])]),
      el("p", { class: "notice__text" }, [opts.text]),
    ]),
  ]);
}
