// Content for pages that do not exist yet (Phase 2). Real pages move into
// src/features/* from Phase 3 on.
import { t } from "../i18n/i18n";
import { el } from "./dom";

export function renderPlaceholderPage(): HTMLElement {
  return el("p", { class: "placeholder" }, [t("placeholder.text")]);
}
