// Placeholder for the Hinzufügen page with its tabs search / scan / manual
// (work package P5 replaces this file). `ctx.params.tab` holds the tab,
// `ctx.params.meal` the meal the "+" was pressed for.
import type { PageLoader } from "../../app/page";
import { t } from "../../i18n/i18n";
import { el } from "../../ui/dom";

const loadAddPage: PageLoader = () =>
  Promise.resolve({
    title: t("nav.add"),
    content: el("p", { class: "placeholder" }, [t("placeholder.text")]),
  });

export default loadAddPage;
