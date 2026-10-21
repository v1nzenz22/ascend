// Builds the app frame: skip link, navigation (tab bar on the phone, side
// column with the wordmark on wide screens), <main> with the page header,
// and the live region for toasts. The router fills in each page.
//
// The page header sits *inside* <main>: the skip link jumps to <main>, and
// the first thing a screen reader then reads is the page title.
import { t } from "../i18n/i18n";
import { el } from "../ui/dom";
import { icon } from "../ui/icons";
import { createToastRegion } from "../ui/toast";
import type { Page } from "./page";
import { NAV_ITEMS, type NavId } from "./routes";

export interface Shell {
  /** The page title. tabindex=-1 so the router can move focus to it. */
  heading: HTMLHeadingElement;
  /** Navigation links by nav id, to update `aria-current`. */
  links: Map<NavId, HTMLAnchorElement>;
  /** Shows title, subtitle, back link and header action of `page`. */
  setHeader: (page: Pick<Page, "title" | "subtitle" | "back" | "headerAction">) => void;
  /** Where the page content goes. */
  content: HTMLElement;
  main: HTMLElement;
}

const MAIN_ID = "main";

function navigation(links: Map<NavId, HTMLAnchorElement>): HTMLElement {
  const items = NAV_ITEMS.map((item) => {
    const link = el("a", { href: item.href, class: "app-nav__link" }, [
      icon(item.icon, "icon app-nav__icon"),
      el("span", { class: "app-nav__label" }, [t(item.labelKey)]),
    ]);
    links.set(item.id, link);
    return el("li", {}, [link]);
  });

  // The wordmark is shown only in the wide layout. The "a" repeats the logo
  // letter and is hidden from screen readers, which read "ascend" once.
  const brand = el("p", { class: "app-brand" }, [
    el("span", { class: "app-brand__mark", "aria-hidden": "true" }, ["a"]),
    t("app.name"),
  ]);

  return el("nav", { class: "app-nav", "aria-label": t("nav.label") }, [
    brand,
    el("ul", { class: "app-nav__list" }, items),
  ]);
}

/** Builds the shell into `root`, replacing anything that was there. */
export function mountShell(root: HTMLElement): Shell {
  const heading = el("h1", { class: "page-header__title", tabindex: -1 });
  const header = el("header", { class: "page-header" });
  const content = el("div", { class: "page-content" });

  const setHeader: Shell["setHeader"] = (page) => {
    heading.textContent = page.title;
    const subtitle =
      page.subtitle === undefined
        ? []
        : [el("p", { class: "page-header__subtitle" }, [page.subtitle])];
    const action =
      page.headerAction === undefined
        ? []
        : [el("div", { class: "page-header__action" }, [page.headerAction])];

    if (page.back === undefined) {
      header.className = "page-header";
      header.replaceChildren(
        el("div", { class: "page-header__text" }, [heading, ...subtitle]),
        ...action,
      );
    } else {
      // Kopfzeile variant 2: "‹ Suche" left, small title centred.
      header.className = "page-header page-header--back";
      const back = el("a", { class: "page-header__back", href: page.back.href }, [
        icon("back"),
        page.back.label,
      ]);
      header.replaceChildren(
        back,
        el("div", { class: "page-header__text" }, [heading, ...subtitle]),
        // An empty cell keeps the title centred when there is no action.
        ...(action.length === 0 ? [el("div", { class: "page-header__action" })] : action),
      );
    }
  };

  // tabindex=-1 lets the skip link move keyboard focus into <main>
  // (elements without it cannot receive focus from script).
  const main = el("main", { id: MAIN_ID, class: "app-main", tabindex: -1 }, [header, content]);

  // The app uses the URL hash for routing, so following href="#main" would
  // look like an unknown route. Move focus directly instead; the href stays
  // so the link is still a real, announced link.
  const skipLink = el("a", { class: "skip-link", href: `#${MAIN_ID}` }, [t("shell.skipToContent")]);
  skipLink.addEventListener("click", (event) => {
    event.preventDefault();
    main.focus();
  });

  const links = new Map<NavId, HTMLAnchorElement>();
  root.replaceChildren(skipLink, navigation(links), main, createToastRegion());

  return { heading, links, setHeader, content, main };
}

/** Shows the "database unavailable" message instead of the app. */
export function showDatabaseError(root: HTMLElement): void {
  root.replaceChildren(
    el("main", { class: "error-message" }, [
      el("p", { role: "alert" }, [t("error.dbUnavailable")]),
    ]),
  );
}
