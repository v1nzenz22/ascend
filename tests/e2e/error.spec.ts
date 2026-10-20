// The "database unavailable" message, shown when IndexedDB cannot be opened
// (e.g. storage disabled). Simulated by hiding IndexedDB before the app runs.
import { de } from "../../src/i18n/de";
import { expect, test } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    // Runs before the app's own scripts: Dexie then finds no IndexedDB and
    // db.open() fails, as in a browser with storage turned off.
    Object.defineProperty(window, "indexedDB", { value: undefined, configurable: true });
  });
  await page.goto("/");
});

test("shows the error message instead of the app", async ({ page }) => {
  await expect(page.getByRole("alert")).toHaveText(de["error.dbUnavailable"]);
  await expect(page.getByRole("navigation")).toHaveCount(0);
});

test("desktop: the message uses the full width", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop layout only");
  const box = await page.locator(".error-message").boundingBox();
  if (box === null) throw new Error("error message is not visible");
  // Wider than the 264 px navigation column it used to be squeezed into.
  expect(box.width).toBeGreaterThan(264);
});
