// The app's pages. Hash names are English identifiers; the visible labels
// come from i18n. Hash routes (#/today) work on any static host and offline,
// because the server only ever serves index.html.
import type { MessageKey } from "../i18n/de";

export interface Route {
  id: "today" | "add" | "goals" | "settings";
  hash: string;
  titleKey: MessageKey;
}

export const ROUTES: readonly Route[] = [
  { id: "today", hash: "#/today", titleKey: "nav.today" },
  { id: "add", hash: "#/add", titleKey: "nav.add" },
  { id: "goals", hash: "#/goals", titleKey: "nav.goals" },
  { id: "settings", hash: "#/settings", titleKey: "nav.settings" },
];

/** Where an empty or unknown hash leads. */
export const DEFAULT_HASH = "#/today";

/** The route for DEFAULT_HASH. Checked once here, so callers need no `?? …`. */
export const DEFAULT_ROUTE: Route = (() => {
  const route = ROUTES.find((r) => r.hash === DEFAULT_HASH);
  if (route === undefined) throw new Error(`No route for DEFAULT_HASH ${DEFAULT_HASH}`);
  return route;
})();

/** The route for `hash`, or `undefined` if there is none. */
export function findRoute(hash: string): Route | undefined {
  return ROUTES.find((route) => route.hash === hash);
}
