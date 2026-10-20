// Builds the app frame: skip link, header with the page heading, one
// navigation and the main area. The router fills in the page content.
import { t } from "../i18n/i18n";
import { el } from "../ui/dom";
import { ROUTES, type Route } from "./routes";

export interface Shell {
  /** The page heading. tabindex=-1 so the router can move focus to it. */
  heading: HTMLHeadingElement;
  /** Navigation links by route id, to update `aria-current`. */
  links: Map<Route["id"], HTMLAnchorElement>;
  main: HTMLElement;
}

const MAIN_ID = "main";

/** Builds the shell into `root`, replacing anything that was there. */
export function mountShell(root: HTMLElement): Shell {
  const heading = el("h1", { class: "app-title", tabindex: -1 });

  const links = new Map<Route["id"], HTMLAnchorElement>();
  const items = ROUTES.map((route) => {
    const link = el("a", { href: route.hash }, [t(route.titleKey)]);
    links.set(route.id, link);
    return el("li", {}, [link]);
  });

  // tabindex=-1 lets the skip link move keyboard focus into <main>
  // (elements without it cannot receive focus from script).
  const main = el("main", { id: MAIN_ID, class: "app-main", tabindex: -1 });

  // The app uses the URL hash for routing, so following href="#main" would
  // look like an unknown route. Move focus directly instead; the href stays
  // so the link is still a real, announced link.
  const skipLink = el("a", { class: "skip-link", href: `#${MAIN_ID}` }, [t("shell.skipToContent")]);
  skipLink.addEventListener("click", (event) => {
    event.preventDefault();
    main.focus();
  });

  root.replaceChildren(
    skipLink,
    el("header", { class: "app-header" }, [heading]),
    el("nav", { class: "app-nav", "aria-label": t("nav.label") }, [el("ul", {}, items)]),
    main,
  );

  return { heading, links, main };
}

/** Shows the "database unavailable" message instead of the app. */
export function showDatabaseError(root: HTMLElement): void {
  root.replaceChildren(
    el("main", { class: "error-message" }, [
      el("p", { role: "alert" }, [t("error.dbUnavailable")]),
    ]),
  );
}
