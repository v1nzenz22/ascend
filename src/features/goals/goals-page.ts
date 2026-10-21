// Placeholder for the Ziele page (work package P6 replaces this file).
import type { PageLoader } from "../../app/page";
import { t } from "../../i18n/i18n";
import { el } from "../../ui/dom";

const loadGoalsPage: PageLoader = () =>
  Promise.resolve({
    title: t("nav.goals"),
    content: el("p", { class: "placeholder" }, [t("placeholder.text")]),
  });

export default loadGoalsPage;
