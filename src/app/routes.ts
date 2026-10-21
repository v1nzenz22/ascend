// The app's pages. Hash names are English identifiers; the visible labels
// come from i18n. Hash routes (#/today) work on any static host and offline,
// because the server only ever serves index.html.
//
// Each page is loaded with a dynamic `import()` the first time it is shown,
// so the first start only downloads the code it needs. The service worker
// precaches every chunk, so lazy pages still open offline.
import type { MessageKey } from "../i18n/de";
import type { PageLoader } from "./page";

/** The four entries of the tab bar / side navigation. */
export type NavId = "today" | "add" | "goals" | "settings";

export interface NavItem {
  id: NavId;
  /** Where the nav link leads. */
  href: string;
  labelKey: MessageKey;
  icon: "today" | "plus" | "goal" | "settings";
}

export const NAV_ITEMS: readonly NavItem[] = [
  { id: "today", href: "#/today", labelKey: "nav.today", icon: "today" },
  { id: "add", href: "#/add/search", labelKey: "nav.add", icon: "plus" },
  { id: "goals", href: "#/goals", labelKey: "nav.goals", icon: "goal" },
  { id: "settings", href: "#/settings", labelKey: "nav.settings", icon: "settings" },
];

export interface Route {
  id: "today" | "add" | "food" | "food-edit" | "entry" | "goals" | "settings" | "about" | "kit";
  /** "#/food/:id" – see route-parse.ts. */
  pattern: string;
  /** Which nav link is marked as the current page. */
  navId: NavId;
  load: () => Promise<{ default: PageLoader }>;
}

// Order matters only where patterns could overlap; they do not here,
// because a parameter never contains "/" ("#/food/:id" ≠ "#/food/:id/edit").
export const ROUTES: readonly Route[] = [
  {
    id: "today",
    pattern: "#/today",
    navId: "today",
    load: () => import("../features/today/today-page"),
  },
  {
    // :tab is "search", "scan" or "manual"; the page checks it.
    id: "add",
    pattern: "#/add/:tab",
    navId: "add",
    load: () => import("../features/add/add-page"),
  },
  {
    id: "food",
    pattern: "#/food/:id",
    navId: "add",
    load: () => import("../features/add/portion-page"),
  },
  {
    id: "food-edit",
    pattern: "#/food/:id/edit",
    navId: "add",
    load: () => import("../features/add/food-edit-page"),
  },
  {
    id: "entry",
    pattern: "#/entry/:id",
    navId: "today",
    load: () => import("../features/add/entry-page"),
  },
  {
    id: "goals",
    pattern: "#/goals",
    navId: "goals",
    load: () => import("../features/goals/goals-page"),
  },
  {
    id: "settings",
    pattern: "#/settings",
    navId: "settings",
    load: () => import("../features/settings/settings-page"),
  },
  {
    id: "about",
    pattern: "#/settings/about",
    navId: "settings",
    load: () => import("../features/settings/about-page"),
  },
  {
    // Component gallery: not linked anywhere (see src/features/kit/).
    id: "kit",
    pattern: "#/ui",
    navId: "settings",
    load: () => import("../features/kit/kit-page"),
  },
];

/** Alias paths. The query ("?meal=…") is kept when redirecting. */
export const REDIRECTS: Readonly<Record<string, string>> = {
  "#/add": "#/add/search",
};

/** Where an empty or unknown hash leads. */
export const DEFAULT_HASH = "#/today";
