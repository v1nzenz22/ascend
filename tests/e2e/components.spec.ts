// The shared UI components, tested on the component gallery (#/ui) until
// the real screens use them: toast, action sheet, confirmation dialog,
// form fields, radio groups, and an axe accessibility scan in both themes.
import AxeBuilder from "@axe-core/playwright";
import { de } from "../../src/i18n/de";
import { expect, test } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await page.goto("/#/ui");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(de["kit.title"]);
});

test.describe("toast", () => {
  test("a short toast is announced and disappears by itself", async ({ page }) => {
    const region = page.getByRole("status", { name: de["shell.notifications"] });
    await page.getByRole("button", { name: de["kit.toastShort"] }).click();
    await expect(region).toHaveText(de["kit.toastShortText"]);
    // 4 s plus a margin.
    await expect(region).toHaveText("", { timeout: 6000 });
  });

  test("a toast with an action stays until used or closed", async ({ page }) => {
    const region = page.getByRole("status", { name: de["shell.notifications"] });
    const open = page.getByRole("button", { name: de["kit.toastAction"] });

    await open.click();
    await expect(region).toContainText(de["update.available"]);
    await page.waitForTimeout(4500);
    await expect(region).toContainText(de["update.available"]);

    // Closed with the keyboard.
    await region.getByRole("button", { name: de["action.close"] }).focus();
    await page.keyboard.press("Enter");
    await expect(region).toHaveText("");

    // The action runs and the toast goes away.
    await open.click();
    await region.getByRole("button", { name: de["update.reload"] }).click();
    await expect(region).toHaveText(de["kit.toastActionDone"]);
  });
});

test.describe("action sheet and confirmation dialog", () => {
  const row = (page: import("@playwright/test").Page) =>
    page.getByRole("button", { name: new RegExp(`^${de["kit.sampleFood"]}`) });

  test("Escape closes the sheet and focus returns to the row", async ({ page }) => {
    await row(page).focus();
    await page.keyboard.press("Enter");
    const sheet = page.getByRole("dialog", { name: de["kit.sampleFood"] });
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText(de["kit.sheetSubtitle"]);
    // Focus starts inside the sheet, on the first action.
    await expect(sheet.getByRole("button", { name: de["action.edit"] })).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
    await expect(row(page)).toBeFocused();
  });

  test("Abbrechen closes the sheet without an action", async ({ page }) => {
    await row(page).click();
    const sheet = page.getByRole("dialog", { name: de["kit.sampleFood"] });
    await sheet.getByRole("button", { name: de["action.cancel"] }).click();
    await expect(sheet).toHaveCount(0);
    await expect(page.getByRole("status", { name: de["shell.notifications"] })).toHaveText("");
  });

  test("choosing an action runs it after the sheet closed", async ({ page }) => {
    await row(page).click();
    await page.getByRole("button", { name: de["action.edit"] }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("status", { name: de["shell.notifications"] })).toHaveText(
      de["kit.editChosen"],
    );
  });

  test("delete asks first; Escape and Abbrechen keep the entry", async ({ page }) => {
    const status = page.getByRole("status", { name: de["shell.notifications"] });
    const dialog = page.getByRole("alertdialog", { name: de["kit.confirmTitle"] });

    // Opened with the keyboard: Safari does not focus a button on a tap,
    // so only a keyboard user has a focused row that focus can return to.
    await row(page).focus();
    await page.keyboard.press("Enter");
    await page.getByRole("dialog").getByRole("button", { name: de["action.delete"] }).focus();
    await page.keyboard.press("Enter");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(de["kit.confirmMessage"]);
    // The safe choice has focus, so Enter never deletes by accident.
    await expect(dialog.getByRole("button", { name: de["action.cancel"] })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(status).toHaveText("");
    await expect(row(page)).toBeFocused();

    await row(page).click();
    await page.getByRole("dialog").getByRole("button", { name: de["action.delete"] }).click();
    // The dialog opens after the sheet's close event (a separate task).
    await expect(dialog.getByRole("button", { name: de["action.cancel"] })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(dialog).toHaveCount(0);
    await expect(status).toHaveText("");

    await row(page).click();
    await page.getByRole("dialog").getByRole("button", { name: de["action.delete"] }).click();
    await dialog.getByRole("button", { name: de["action.delete"] }).click();
    await expect(status).toHaveText(de["kit.deleted"]);
  });

  test("a tap outside the sheet closes it", async ({ page }) => {
    await row(page).click();
    const sheet = page.getByRole("dialog", { name: de["kit.sampleFood"] });
    await expect(sheet).toBeVisible();
    // The backdrop above the sheet (top of the screen).
    await page.mouse.click(10, 10);
    await expect(sheet).toHaveCount(0);
  });
});

test.describe("form fields", () => {
  test("errors appear on submit, are linked to the field, and focus the first one", async ({
    page,
  }) => {
    const name = page.getByLabel(de["kit.nameLabel"], { exact: true });
    const protein = page.getByLabel(de["kit.protein"], { exact: true });
    await expect(name).toHaveAttribute("aria-describedby", /kit-name-message/);
    await expect(page.locator("#kit-name-message")).toHaveText(de["kit.nameHint"]);

    await page.getByRole("button", { name: de["kit.check"] }).click();
    await expect(name).toBeFocused();
    await expect(name).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("#kit-name-message")).toHaveText(de["kit.nameRequired"]);
    // The optional field stays valid when empty ("unknown").
    await expect(protein).not.toHaveAttribute("aria-invalid", "true");

    await name.fill("Linsensuppe");
    await page.getByLabel(de["kit.energy"], { exact: true }).fill("75");
    await protein.fill("4,5");
    await page.getByLabel(de["kit.amount"], { exact: true }).fill("150");
    await page.getByRole("button", { name: de["kit.check"] }).click();
    await expect(name).not.toHaveAttribute("aria-invalid", "true");
    await expect(page.locator(".kit-status")).toHaveText(de["kit.checked"]);
  });

  test("number fields check on blur, never while typing", async ({ page }) => {
    const protein = page.getByLabel(de["kit.protein"], { exact: true });
    await expect(protein).toHaveAttribute("inputmode", "decimal");
    await expect(protein).toHaveAttribute("placeholder", "–");
    // The unit is part of the description.
    await expect(protein).toHaveAttribute("aria-describedby", /kit-protein-unit/);

    await protein.fill("-5");
    await expect(protein).not.toHaveAttribute("aria-invalid", "true");
    await protein.blur();
    await expect(protein).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("#kit-protein-message")).toHaveText("Bitte eine Zahl ab 0 eingeben.");

    await protein.fill("12,5");
    await protein.blur();
    await expect(protein).not.toHaveAttribute("aria-invalid", "true");
  });

  test("inputs use 16 px text so iOS does not zoom", async ({ page }) => {
    for (const label of [de["kit.nameLabel"], de["kit.protein"]]) {
      const size = await page
        .getByLabel(label, { exact: true })
        .evaluate((input) => getComputedStyle(input).fontSize);
      expect(Number.parseFloat(size)).toBeGreaterThanOrEqual(16);
    }
  });
});

test.describe("choices", () => {
  test("chips are a radio group with arrow keys", async ({ page }) => {
    const meal = page.getByRole("group", { name: de["kit.meal"] });
    const breakfast = meal.getByRole("radio", { name: de["meal.breakfast"] });
    await expect(breakfast).toBeChecked();
    await breakfast.focus();
    await page.keyboard.press("ArrowRight");
    await expect(meal.getByRole("radio", { name: de["meal.lunch"] })).toBeChecked();
    await expect(breakfast).not.toBeChecked();
  });

  test("the appearance segments switch the theme", async ({ page }) => {
    const html = page.locator("html");
    const group = page.getByRole("group", { name: de["kit.appearance"] });
    await group.getByText(de["kit.themeDark"]).click();
    await expect(html).toHaveAttribute("data-theme", "dark");
    await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute(
      "content",
      "#141818",
    );
    await group.getByText(de["kit.themeLight"]).click();
    await expect(html).toHaveAttribute("data-theme", "light");
    await group.getByText(de["kit.themeSystem"]).click();
    await expect(html).not.toHaveAttribute("data-theme");
  });

  test("segment links mark the current tab", async ({ page }) => {
    const tabs = page.getByRole("navigation", { name: de["kit.tabs"] });
    await expect(tabs.getByRole("link", { name: de["kit.tabSearch"] })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(tabs.locator('[aria-current="page"]')).toHaveCount(1);
  });
});

test.describe("accessibility scan (axe)", () => {
  for (const scheme of ["light", "dark"] as const) {
    test(`no violations on the gallery and today page, ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      for (const hash of ["#/ui", "#/today", "#/food/abc"]) {
        await page.goto(`/${hash}`);
        await expect(page.getByRole("heading", { level: 1 })).not.toHaveText("");
        const results = await new AxeBuilder({ page }).analyze();
        expect(
          results.violations.map((v) => `${hash}: ${v.id} (${String(v.nodes.length)})`),
        ).toEqual([]);
      }
    });
  }

  test("no violations with an open dialog", async ({ page }) => {
    await page.getByRole("button", { name: new RegExp(`^${de["kit.sampleFood"]}`) }).click();
    await page.getByRole("dialog").getByRole("button", { name: de["action.delete"] }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });
});
