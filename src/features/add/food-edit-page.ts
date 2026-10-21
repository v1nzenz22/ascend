// Placeholder for editing an own food, `#/food/<id>/edit` (work package P5
// replaces this file).
import type { PageLoader } from "../../app/page";
import { t } from "../../i18n/i18n";
import { el } from "../../ui/dom";

const loadFoodEditPage: PageLoader = ({ params }) =>
  Promise.resolve({
    title: t("add.editFoodTitle"),
    back: {
      href: `#/food/${encodeURIComponent(params.id ?? "")}`,
      label: t("add.portionTitle"),
    },
    content: el("p", { class: "placeholder" }, [t("placeholder.text")]),
  });

export default loadFoodEditPage;
