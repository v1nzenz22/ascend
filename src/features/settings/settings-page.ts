// Placeholder for the Einstellungen page (work package P7 replaces this
// file).
import type { PageLoader } from "../../app/page";
import { t } from "../../i18n/i18n";
import { el } from "../../ui/dom";

const loadSettingsPage: PageLoader = () =>
  Promise.resolve({
    title: t("nav.settings"),
    content: el("p", { class: "placeholder" }, [t("placeholder.text")]),
  });

export default loadSettingsPage;
