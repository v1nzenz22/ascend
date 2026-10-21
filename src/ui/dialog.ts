// Overlays: the action sheet at the bottom ("Sheet · Eintrag") and the
// confirmation dialog ("Dialog · Löschen").
//
// Both use the native <dialog> element with showModal(). The browser then
// does the hard parts for us: focus moves into the dialog and cannot leave
// it, Escape closes it, and the page behind becomes inert (not clickable,
// hidden from screen readers).
//
// Focus goes back to the element that opened the dialog when it closes.
// Browsers do this themselves in most cases, but not all versions agree, so
// it is done here explicitly.
import { t } from "../i18n/i18n";
import { el, uniqueId } from "./dom";

interface OpenOptions {
  dialog: HTMLDialogElement;
  /** Called after the dialog closed and focus went back to the opener. */
  onClosed: () => void;
}

function open({ dialog, onClosed }: OpenOptions): void {
  const opener = document.activeElement;

  // A click on the dark area around the dialog hits the <dialog> element
  // itself (its content sits in an inner wrapper that fills it), so
  // "target === dialog" means "clicked outside the content".
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  dialog.addEventListener(
    "close",
    () => {
      dialog.remove();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
      onClosed();
    },
    { once: true },
  );

  document.body.append(dialog);
  dialog.showModal();
}

export interface SheetAction {
  label: string;
  danger?: boolean;
  onSelect: () => void;
}

/**
 * Bottom sheet with a title, an optional subtitle and one button per action.
 * "Abbrechen" is added automatically. Tapping outside or pressing Escape
 * closes it without choosing anything.
 */
export function openActionSheet(opts: {
  title: string;
  subtitle?: string;
  actions: SheetAction[];
}): void {
  const titleId = uniqueId("sheet-title");
  let chosen: SheetAction | undefined;

  const dialog = el("dialog", { class: "sheet", "aria-labelledby": titleId });

  const buttons = opts.actions.map((action) => {
    const button = el(
      "button",
      {
        type: "button",
        class:
          action.danger === true
            ? "button button--secondary button--danger"
            : "button button--secondary",
      },
      [action.label],
    );
    button.addEventListener("click", () => {
      chosen = action;
      dialog.close();
    });
    return button;
  });

  const cancel = el("button", { type: "button", class: "button button--text" }, [
    t("action.cancel"),
  ]);
  cancel.addEventListener("click", () => {
    dialog.close();
  });

  dialog.append(
    el("div", { class: "sheet__body" }, [
      // The grab handle only looks like iOS; there is no drag gesture.
      el("div", { class: "sheet__handle", "aria-hidden": "true" }),
      el("h2", { class: "sheet__title", id: titleId }, [opts.title]),
      ...(opts.subtitle === undefined
        ? []
        : [el("p", { class: "sheet__subtitle" }, [opts.subtitle])]),
      el("div", { class: "sheet__actions" }, [...buttons, cancel]),
    ]),
  );

  // The action runs only after the sheet is closed and focus is back, so
  // it can open the next dialog or move focus itself.
  open({ dialog, onClosed: () => chosen?.onSelect() });
}

/**
 * Asks a yes/no question. Resolves `true` only for the confirm button;
 * "Abbrechen", Escape and a tap outside resolve `false`. Focus starts on
 * "Abbrechen" (the first button), so Enter never deletes by accident.
 */
export function confirmDialog(opts: {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
}): Promise<boolean> {
  return new Promise((resolve) => {
    const titleId = uniqueId("dialog-title");
    const messageId = uniqueId("dialog-message");
    let confirmed = false;

    // alertdialog: a question that interrupts the user and needs an answer.
    const dialog = el("dialog", {
      class: "confirm",
      role: "alertdialog",
      "aria-labelledby": titleId,
      "aria-describedby": messageId,
    });

    const cancel = el("button", { type: "button", class: "button button--text" }, [
      t("action.cancel"),
    ]);
    cancel.addEventListener("click", () => {
      dialog.close();
    });

    const confirm = el(
      "button",
      {
        type: "button",
        class:
          opts.danger === true
            ? "button button--secondary button--danger"
            : "button button--primary",
      },
      [opts.confirmLabel],
    );
    confirm.addEventListener("click", () => {
      confirmed = true;
      dialog.close();
    });

    dialog.append(
      el("div", { class: "confirm__body" }, [
        el("h2", { class: "confirm__title", id: titleId }, [opts.title]),
        el("p", { class: "confirm__message", id: messageId }, [opts.message]),
        el("div", { class: "confirm__actions" }, [cancel, confirm]),
      ]),
    );

    open({
      dialog,
      onClosed: () => {
        resolve(confirmed);
      },
    });
  });
}
