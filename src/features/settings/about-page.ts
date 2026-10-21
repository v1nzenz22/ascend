// Placeholder for "Über ascend & Datenschutz" (work package P7 replaces
// this file).
import type { PageLoader } from "../../app/page";
import { t } from "../../i18n/i18n";
import { el } from "../../ui/dom";

const loadAboutPage: PageLoader = () =>
  Promise.resolve({
    title: t("settings.aboutTitle"),
    back: { href: "#/settings", label: t("nav.settings") },
    content: el("p", { class: "placeholder" }, [t("placeholder.text")]),
  });

export default loadAboutPage;
