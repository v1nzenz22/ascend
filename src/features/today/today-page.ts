// Placeholder for the Heute page (work package P4 replaces this file).
import type { PageLoader } from "../../app/page";
import { formatWeekday } from "../../i18n/format";
import { t } from "../../i18n/i18n";
import { todayLocal } from "../../lib/local-date";
import { el } from "../../ui/dom";

const loadTodayPage: PageLoader = () =>
  Promise.resolve({
    title: t("nav.today"),
    subtitle: formatWeekday(todayLocal()),
    content: el("p", { class: "placeholder" }, [t("placeholder.text")]),
    refreshOnDataChange: true,
    refreshOnDayChange: true,
  });

export default loadTodayPage;
