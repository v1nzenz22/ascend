// Hash router: shows the page that matches `location.hash`.
//
// On every navigation it renders the page into <main>, marks the active link
// with aria-current="page", updates the heading and the window title, and
// moves focus to the heading so screen readers announce the new page.
import { t } from "../i18n/i18n";
import { renderPlaceholderPage } from "../ui/placeholder-page";
import { DEFAULT_HASH, DEFAULT_ROUTE, findRoute, type Route } from "./routes";
import type { Shell } from "./shell";

function render(shell: Shell, route: Route, moveFocus: boolean): void {
  const title = t(route.titleKey);
  shell.heading.textContent = title;
  document.title = `${title} – ${t("app.name")}`;

  for (const [id, link] of shell.links) {
    if (id === route.id) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }

  // Every page is a placeholder in Phase 2.
  shell.main.replaceChildren(renderPlaceholderPage());

  // Not on first load: focus would skip the skip link and confuse users who
  // just opened the app.
  if (moveFocus) shell.heading.focus();
}

/** Starts listening to hash changes and renders the current page. */
export function startRouter(shell: Shell): void {
  const show = (moveFocus: boolean): void => {
    let route = findRoute(location.hash);
    if (route === undefined) {
      // An empty or unknown hash shows the default page. replaceState()
      // corrects the address bar without a new back-button entry and,
      // unlike location.replace(), does *not* fire `hashchange`. That
      // matters on first load: a hashchange would render a second time
      // with moveFocus=true and put focus on the heading, past the skip
      // link. So the default page is rendered right here, with the same
      // moveFocus as the original call.
      history.replaceState(null, "", DEFAULT_HASH);
      route = DEFAULT_ROUTE;
    }
    render(shell, route, moveFocus);
  };

  window.addEventListener("hashchange", () => {
    show(true);
  });
  show(false);
}
