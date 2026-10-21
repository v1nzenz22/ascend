// The contract between the router and every screen ("page").
//
// A page module exports a `PageLoader` as its default export. The router
// calls it with the route parameters; the loader reads what it needs (from
// the local database) and returns the finished page. The router then puts
// the title into the shell's header and the content into <main>.

export interface PageContext {
  /** From the route pattern (":id") and the query ("?meal=lunch"). */
  params: Readonly<Record<string, string>>;
  /**
   * Aborted when this content goes away: the user leaves the page, or the
   * router refreshes it with new content. Pass it to `addEventListener(…,
   * { signal })` and check it in timers, so nothing keeps running for a page
   * that is no longer shown.
   */
  signal: AbortSignal;
}

export interface Page {
  /** The <h1> and the window title. */
  title: string;
  /** Small line under the title, e.g. "Dienstag, 20. Oktober" or "Zu Frühstück". */
  subtitle?: string;
  /**
   * Turns the header into the "back" variant: a back link ("‹ Suche") on the
   * left, the title centred and small (Kopfzeile, second variant).
   */
  back?: { href: string; label: string };
  /**
   * One element on the right of the header, e.g. the pencil icon button on
   * the Portion page. Icon-only buttons need an `aria-label`.
   */
  headerAction?: HTMLElement;
  content: Node;
  /** Re-render when data changes (any write through src/db/write.ts). */
  refreshOnDataChange?: boolean;
  /** Re-render when the local day changes (midnight, or app reopened). */
  refreshOnDayChange?: boolean;
}

export type PageLoader = (ctx: PageContext) => Promise<Page>;
