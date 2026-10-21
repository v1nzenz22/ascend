// Placeholder for the Portion page of a food, `#/food/<id>` (work package
// P5 replaces this file).
import type { PageLoader } from "../../app/page";
import { t } from "../../i18n/i18n";
import { el } from "../../ui/dom";

const loadPortionPage: PageLoader = () =>
  Promise.resolve({
    title: t("add.portionTitle"),
    back: { href: "#/add/search", label: t("add.backToSearch") },
    content: el("p", { class: "placeholder" }, [t("placeholder.text")]),
  });

export default loadPortionPage;
