// Notices when "today" changes: at local midnight, or when the app comes
// back after a night in the background.
//
// Why three triggers:
// - a timer to the next local midnight covers a desktop dashboard that stays
//   open overnight;
// - `visibilitychange` covers a phone app that was in the background (timers
//   do not run there, so the timer alone would fire far too late);
// - `pageshow` covers the browser's back-forward cache, which restores a
//   frozen page without `visibilitychange`.
import { todayLocal, type LocalDate } from "../lib/local-date";

/** What the watcher needs from the browser; tests pass fakes. */
export interface DayWatchEnvironment {
  now: () => Date;
  today: () => LocalDate;
  document: Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener">;
  window: Pick<Window, "addEventListener" | "removeEventListener">;
}

function browserEnvironment(): DayWatchEnvironment {
  return { now: () => new Date(), today: todayLocal, document, window };
}

/**
 * Milliseconds from `now` to one second after the next local midnight.
 * Built from the local calendar (not "+24 h"), so daylight-saving days with
 * 23 or 25 hours are handled. The extra second makes sure the clock has
 * really passed midnight when the timer fires.
 */
export function msUntilNextDay(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
  return next.getTime() - now.getTime();
}

/**
 * Calls `onChange(newToday)` whenever the local day changes. Returns a
 * function that stops watching.
 */
export function watchToday(
  onChange: (today: LocalDate) => void,
  env: DayWatchEnvironment = browserEnvironment(),
): () => void {
  let known = env.today();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const check = (): void => {
    const current = env.today();
    if (current !== known) {
      known = current;
      onChange(current);
    }
    arm();
  };

  // One timer at a time, re-armed after every check: after sleep or a
  // clock change the old timer would point at the wrong moment.
  const arm = (): void => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(check, msUntilNextDay(env.now()));
  };

  const onVisibility = (): void => {
    if (env.document.visibilityState === "visible") check();
  };

  env.document.addEventListener("visibilitychange", onVisibility);
  env.window.addEventListener("pageshow", check);
  arm();

  return () => {
    if (timer !== undefined) clearTimeout(timer);
    env.document.removeEventListener("visibilitychange", onVisibility);
    env.window.removeEventListener("pageshow", check);
  };
}
