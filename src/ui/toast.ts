// Short messages at the bottom of the screen ("Eintrag gelöscht").
//
// Screen readers announce them through a live region (role="status"). A
// live region must already be in the page *before* its content changes,
// otherwise nothing is announced – so the shell creates the region once at
// start (`createToastRegion`) and toasts are only put inside it.
//
// - Without an action, a toast disappears after 4 seconds.
// - With an action (e.g. "Neu laden" after an update) it stays until the
//   action is used or the toast is closed: a button that vanishes on its own
//   cannot be reached reliably with a screen reader or a keyboard.
// - Only one toast at a time; a new one replaces the old one.
import { t } from "../i18n/i18n";
import { el } from "./dom";
import { icon } from "./icons";

export const TOAST_DURATION_MS = 4000;

export interface ToastOptions {
  action?: { label: string; onClick: () => void };
}

let region: HTMLElement | undefined;
let hideTimer: ReturnType<typeof setTimeout> | undefined;

/** The live region for toasts. The shell adds it to the page once. */
export function createToastRegion(): HTMLElement {
  region = el("div", {
    class: "toast-region",
    role: "status",
    // Announce the whole toast, not only the part that changed.
    "aria-atomic": "true",
    "aria-label": t("shell.notifications"),
  });
  return region;
}

/** Removes the current toast (if any). */
export function hideToast(): void {
  if (hideTimer !== undefined) clearTimeout(hideTimer);
  hideTimer = undefined;
  region?.replaceChildren();
}

export function showToast(message: string, opts: ToastOptions = {}): void {
  if (region === undefined) {
    // Before the shell exists (e.g. on the database error screen) there is
    // nowhere to show it; the console keeps it for debugging.
    console.warn("toast before the shell was mounted:", message);
    return;
  }
  hideToast();

  const children: Node[] = [el("p", { class: "toast__text" }, [message])];
  const { action } = opts;
  if (action === undefined) {
    // A confirmation ("… hinzugefügt"): the check mark as in the design.
    children.unshift(icon("check", "icon toast__icon"));
    hideTimer = setTimeout(hideToast, TOAST_DURATION_MS);
  } else {
    const actionButton = el("button", { type: "button", class: "toast__action" }, [action.label]);
    actionButton.addEventListener("click", () => {
      hideToast();
      action.onClick();
    });
    const closeButton = el(
      "button",
      { type: "button", class: "toast__close", "aria-label": t("action.close") },
      [icon("close")],
    );
    closeButton.addEventListener("click", hideToast);
    children.push(actionButton, closeButton);
  }

  region.replaceChildren(el("div", { class: "toast" }, children));
}
