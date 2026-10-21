// Hash router: shows the page that matches `location.hash`.
//
// On every navigation it loads the page module (lazily), runs its loader,
// puts the header and content into the shell, marks the active nav link
// with aria-current="page", updates the window title and moves focus to the
// heading so screen readers announce the new page.
//
// It also re-renders the current page – without moving focus – when
// - data changed and the page asked for it (`refreshOnDataChange`), also
//   when the tab becomes visible again (another tab may have written);
// - the local day changed and the page asked for it (`refreshOnDayChange`).
import { t } from "../i18n/i18n";
import { button } from "../ui/button";
import { el } from "../ui/dom";
import { watchToday } from "./day-watch";
import type { Page, PageContext } from "./page";
import { onAppDataChanged } from "./preferences";
import { parseHash, type Params } from "./route-parse";
import { DEFAULT_HASH, REDIRECTS, ROUTES, type Route } from "./routes";
import type { Shell } from "./shell";
import { reportStaleVersion } from "./update";

interface Current {
  route: Route;
  params: Params;
  page: Page;
  controller: AbortController;
}

/** Shown when a page could not be loaded or its loader failed. */
function errorPage(): Page {
  return {
    title: t("error.pageTitle"),
    content: el("div", { class: "page-error" }, [
      el("p", {}, [t("error.pageLoad")]),
      button(t("action.reload"), "secondary", () => {
        location.reload();
      }),
    ]),
  };
}

/** Starts listening to hash changes and renders the current page. */
export function startRouter(shell: Shell): void {
  let current: Current | undefined;
  // Counts navigations, so a slow page that finishes loading after the user
  // already went elsewhere is thrown away instead of shown.
  let generation = 0;

  const show = (page: Page, route: Route, moveFocus: boolean): void => {
    shell.setHeader(page);
    document.title = `${page.title} – ${t("app.name")}`;
    for (const [id, link] of shell.links) {
      if (id === route.navId) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
    shell.content.replaceChildren(page.content);
    if (moveFocus) shell.heading.focus();
  };

  const load = async (route: Route, params: Params, signal: AbortSignal): Promise<Page> => {
    let module: Awaited<ReturnType<Route["load"]>>;
    try {
      module = await route.load();
    } catch (error: unknown) {
      console.error(error);
      // Usually the server already has a newer version and the old file
      // is gone: offer "Neu laden" (same toast as a normal update).
      reportStaleVersion();
      return errorPage();
    }
    try {
      const ctx: PageContext = { params, signal };
      return await module.default(ctx);
    } catch (error: unknown) {
      // Only the local console, never reported anywhere (zero telemetry).
      console.error(error);
      return errorPage();
    }
  };

  const navigate = async (moveFocus: boolean): Promise<void> => {
    let match = parseHash(location.hash, ROUTES, REDIRECTS);
    if (match.kind !== "route") {
      // An alias or an unknown hash. replaceState() corrects the address
      // bar without a new back-button entry and, unlike location.replace(),
      // does *not* fire `hashchange` – so this call renders the target with
      // the same moveFocus (on first load: no focus move, so the skip link
      // stays the first Tab stop).
      const target = match.kind === "redirect" ? match.hash : DEFAULT_HASH;
      history.replaceState(null, "", target);
      match = parseHash(target, ROUTES, REDIRECTS);
      if (match.kind !== "route") throw new Error(`No route for ${target}`);
    }

    generation += 1;
    const mine = generation;
    current?.controller.abort();
    const controller = new AbortController();
    const page = await load(match.route, match.params, controller.signal);
    if (mine !== generation) {
      controller.abort();
      return;
    }
    current = { route: match.route, params: match.params, page, controller };
    show(page, match.route, moveFocus);
  };

  /** Re-runs the current page's loader and swaps the content in place. */
  const refresh = async (): Promise<void> => {
    if (current === undefined) return;
    const { route, params } = current;
    const mine = generation;
    const controller = new AbortController();
    const page = await load(route, params, controller.signal);
    // The user navigated while we were loading: the navigation wins.
    if (mine !== generation || current.route !== route) {
      controller.abort();
      return;
    }
    current.controller.abort();
    current = { route, params, page, controller };
    show(page, route, false);
  };

  window.addEventListener("hashchange", () => {
    void navigate(true);
  });

  onAppDataChanged(() => {
    if (current?.page.refreshOnDataChange === true) void refresh();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && current?.page.refreshOnDataChange === true) {
      void refresh();
    }
  });
  watchToday(() => {
    if (current?.page.refreshOnDayChange === true) void refresh();
  });

  void navigate(false);
}
