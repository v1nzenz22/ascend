// Placeholder for editing an entry, `#/entry/<id>` (work package P5
// replaces this file, e.g. with a re-export from portion-page.ts).
import type { PageLoader } from "../../app/page";
import { t } from "../../i18n/i18n";
import { el } from "../../ui/dom";

const loadEntryPage: PageLoader = () =>
  Promise.resolve({
    title: t("add.portionTitle"),
    back: { href: "#/today", label: t("nav.today") },
    content: el("p", { class: "placeholder" }, [t("placeholder.text")]),
  });

export default loadEntryPage;
