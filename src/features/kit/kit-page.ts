// Component gallery at #/ui: every UI building block with sample content.
//
// Why it exists: the real screens are built later (work packages P4–P8).
// Until then this page lets the designer compare the components with
// FigCraft's "Components" page and lets the browser tests
// (tests/e2e/components.spec.ts) check keyboard use, focus and contrast.
// It is not linked from anywhere and stores nothing: the appearance switch
// here only previews a theme for this session.
import "../../styles/kit.css";

import type { PageLoader } from "../../app/page";
import { applyTheme, type Theme } from "../../app/theme";
import { MEALS } from "../../domain/meals";
import { t } from "../../i18n/i18n";
import type { MessageKey } from "../../i18n/de";
import { button } from "../../ui/button";
import { chipGroup } from "../../ui/chip-group";
import { confirmDialog, openActionSheet } from "../../ui/dialog";
import { el } from "../../ui/dom";
import { emptyState } from "../../ui/empty-state";
import { icon, ICON_PARTS, type IconName } from "../../ui/icons";
import { listRow } from "../../ui/list-row";
import { notice } from "../../ui/notice";
import { numberField } from "../../ui/number-field";
import { searchField } from "../../ui/search-field";
import { segmented, segmentLinks } from "../../ui/segmented";
import { textField } from "../../ui/text-field";
import { showToast } from "../../ui/toast";

function section(titleKey: MessageKey, children: Node[]): HTMLElement {
  return el("section", { class: "kit-section" }, [
    el("h2", { class: "kit-section__title" }, [t(titleKey)]),
    ...children,
  ]);
}

function buttons(): HTMLElement {
  const row = (disabled: boolean): HTMLElement => {
    const items = [
      button(t("action.save"), "primary"),
      button(t("action.cancel"), "secondary"),
      button(t("kit.more"), "text"),
      button(t("action.delete"), "danger"),
    ];
    for (const item of items) item.disabled = disabled;
    return el("div", { class: "kit-row" }, items);
  };
  return section("kit.buttons", [row(false), row(true)]);
}

function fields(): HTMLElement {
  const name = textField({
    id: "kit-name",
    label: t("kit.nameLabel"),
    hint: t("kit.nameHint"),
    placeholder: t("kit.namePlaceholder"),
    required: true,
    requiredMessage: t("kit.nameRequired"),
    maxLength: 100,
  });
  const energy = numberField({
    id: "kit-energy",
    label: t("kit.energy"),
    unit: t("unit.kcal"),
    required: true,
    min: 0,
    max: 1000,
  });
  const protein = numberField({
    id: "kit-protein",
    label: t("kit.protein"),
    unit: t("unit.g"),
    required: false,
    min: 0,
    max: 100,
  });
  const amount = numberField({
    id: "kit-amount",
    label: t("kit.amount"),
    unit: t("unit.g"),
    required: true,
    min: 0,
    minExclusive: true,
    max: 10000,
  });
  const status = el("p", { class: "kit-status", role: "status" });

  // novalidate: our own checks show German messages under the fields
  // instead of the browser's bubbles.
  const form = el("form", { class: "kit-form", novalidate: true }, [
    name.element,
    energy.element,
    protein.element,
    amount.element,
    button(t("kit.check"), "primary", undefined, "submit"),
    status,
  ]);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const results = [
      { field: name.input, ok: name.read().ok },
      { field: energy.input, ok: energy.read().ok },
      { field: protein.input, ok: protein.read().ok },
      { field: amount.input, ok: amount.read().ok },
    ];
    const firstInvalid = results.find((r) => !r.ok);
    // Focus on the first wrong field: the screen reader then reads its
    // label and the error (linked with aria-describedby).
    if (firstInvalid === undefined) status.textContent = t("kit.checked");
    else {
      status.textContent = "";
      firstInvalid.field.focus();
    }
  });
  return section("kit.fields", [form]);
}

function choices(): HTMLElement {
  const portion = chipGroup({
    legend: t("kit.portion"),
    choices: [
      { value: "100", label: t("kit.portion100") },
      { value: "cup", label: t("kit.portionCup") },
    ],
    value: "cup",
  });
  const meal = chipGroup({
    legend: t("kit.meal"),
    choices: MEALS.map((m) => ({ value: m, label: t(`meal.${m}`) })),
    value: "breakfast",
  });
  const appearance = segmented<Theme>({
    legend: t("kit.appearance"),
    choices: [
      { value: "system", label: t("kit.themeSystem") },
      { value: "light", label: t("kit.themeLight") },
      { value: "dark", label: t("kit.themeDark") },
    ],
    value: "system",
  });
  appearance.onChange(applyTheme);
  const tabs = segmentLinks(t("kit.tabs"), [
    { href: "#/ui", label: t("kit.tabSearch"), current: true },
    { href: "#/ui", label: t("kit.tabScan"), current: false },
    { href: "#/ui", label: t("kit.tabManual"), current: false },
  ]);
  return section("kit.choices", [
    portion.element,
    meal.element,
    appearance.element,
    tabs,
    searchField({
      id: "kit-search",
      label: t("kit.searchLabel"),
      placeholder: t("kit.searchLabel"),
    }).element,
  ]);
}

function rows(): HTMLElement {
  const entry = listRow({
    title: t("kit.sampleFood"),
    subtitle: t("kit.sampleAmount"),
    value: t("kit.sampleEnergy"),
    onClick: () => {
      openActionSheet({
        title: t("kit.sampleFood"),
        subtitle: t("kit.sheetSubtitle"),
        actions: [
          {
            label: t("action.edit"),
            onSelect: () => {
              showToast(t("kit.editChosen"));
            },
          },
          {
            label: t("action.delete"),
            danger: true,
            onSelect: () => {
              void confirmDialog({
                title: t("kit.confirmTitle"),
                message: t("kit.confirmMessage"),
                confirmLabel: t("action.delete"),
                danger: true,
              }).then((confirmed) => {
                if (confirmed) showToast(t("kit.deleted"));
              });
            },
          },
        ],
      });
    },
  });
  const food = listRow({
    title: t("kit.sampleFood"),
    subtitle: t("kit.sampleBrand"),
    value: t("kit.sampleEnergy100"),
    valueCaption: t("kit.per100"),
    href: "#/ui",
  });
  return section("kit.rows", [el("div", { class: "kit-list" }, [entry, food])]);
}

function notices(): HTMLElement {
  return section("kit.notices", [
    notice({
      icon: "offline",
      title: t("kit.offlineTitle"),
      text: t("kit.offlineText"),
      tone: "warning",
    }),
    notice({ icon: "info", text: t("kit.infoText") }),
  ]);
}

function toasts(): HTMLElement {
  return section("kit.toasts", [
    el("div", { class: "kit-row" }, [
      button(t("kit.toastShort"), "secondary", () => {
        showToast(t("kit.toastShortText"));
      }),
      button(t("kit.toastAction"), "secondary", () => {
        showToast(t("update.available"), {
          action: {
            label: t("update.reload"),
            onClick: () => {
              showToast(t("kit.toastActionDone"));
            },
          },
        });
      }),
    ]),
  ]);
}

function icons(): HTMLElement {
  const names = Object.keys(ICON_PARTS) as IconName[];
  return section("kit.icons", [
    el(
      "ul",
      { class: "kit-icons" },
      names.map((name) => el("li", {}, [icon(name), el("span", {}, [name])])),
    ),
  ]);
}

const loadKitPage: PageLoader = () =>
  Promise.resolve({
    title: t("kit.title"),
    subtitle: t("kit.subtitle"),
    content: el("div", { class: "kit" }, [
      buttons(),
      fields(),
      choices(),
      rows(),
      notices(),
      section("kit.empty", [
        emptyState({
          title: t("kit.emptyTitle"),
          text: t("kit.emptyText"),
          action: { label: t("kit.emptyAction"), href: "#/ui" },
        }),
      ]),
      toasts(),
      icons(),
    ]),
  });

export default loadKitPage;
