// The app shell: language, headings, navigation, skip link, and no
// console errors or requests to other sites.
import { de } from "../../src/i18n/de";
import { expect, test } from "./fixtures";

// "Today" comes last: the app starts there, and clicking the link of the
// page you are already on changes nothing (no navigation, no focus move).
const PAGES = [
  { hash: "#/add/search", label: de["nav.add"] },
  { hash: "#/goals", label: de["nav.goals"] },
  { hash: "#/settings", label: de["nav.settings"] },
  { hash: "#/today", label: de["nav.today"] },
] as const;

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("is German and starts on the today page", async ({ page }) => {
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await expect(page).toHaveURL(/#\/today$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(de["nav.today"]);
  await expect(page).toHaveTitle(`${de["nav.today"]} – ${de["app.name"]}`);
  await expect(page.getByRole("main")).toContainText(de["placeholder.text"]);
});

test("navigation links switch pages", async ({ page }) => {
  const nav = page.getByRole("navigation", { name: de["nav.label"] });
  const heading = page.getByRole("heading", { level: 1 });

  for (const target of PAGES) {
    const link = nav.getByRole("link", { name: target.label });
    await link.click();

    await expect(page).toHaveURL(new RegExp(`${target.hash.replace("/", "\\/")}$`));
    await expect(heading).toHaveText(target.label);
    // Focus moves to the heading so screen readers announce the new page.
    await expect(heading).toBeFocused();
    // Exactly one link is marked as the current page.
    await expect(link).toHaveAttribute("aria-current", "page");
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
  }
});

test("back button returns to the previous page", async ({ page }) => {
  const nav = page.getByRole("navigation", { name: de["nav.label"] });
  await nav.getByRole("link", { name: de["nav.goals"] }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(de["nav.goals"]);
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(de["nav.today"]);
});

test("unknown pages fall back to today on a cold start", async ({ context }) => {
  // A new page, so the app really starts with the unknown hash (as from an
  // old bookmark). page.goto on the already open page would only change the
  // hash of the running app.
  const fresh = await context.newPage();
  await fresh.goto("/#/does-not-exist");
  await expect(fresh).toHaveURL(/#\/today$/);
  await expect(fresh.getByRole("heading", { level: 1 })).toHaveText(de["nav.today"]);
  // Like any first load: focus stays at the start of the page.
  await expect(fresh.getByRole("heading", { level: 1 })).not.toBeFocused();
  // The unknown address is replaced, not kept as an extra history entry:
  // the history is as long as after opening #/today directly.
  const control = await context.newPage();
  await control.goto("/#/today");
  await expect(control.getByRole("heading", { level: 1 })).toHaveText(de["nav.today"]);
  const historyLength = () => history.length;
  expect(await fresh.evaluate(historyLength)).toBe(await control.evaluate(historyLength));
});

test("first load leaves focus at the start, so Tab reaches the skip link", async ({
  page,
  browserName,
}) => {
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toHaveText(de["nav.today"]);
  await expect(heading).not.toBeFocused();
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);

  // WebKit (like Safari) only tabs to links with Option+Tab.
  await page.keyboard.press(browserName === "webkit" ? "Alt+Tab" : "Tab");
  await expect(page.getByRole("link", { name: de["shell.skipToContent"] })).toBeFocused();
});

test("skip link moves focus to the main content", async ({ page }) => {
  const skipLink = page.getByRole("link", { name: de["shell.skipToContent"] });
  // Focus it directly: WebKit does not move Tab focus to links by default.
  await skipLink.focus();
  await expect(skipLink).toBeInViewport();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  // Following the skip link must not change the page.
  await expect(page).toHaveURL(/#\/today$/);
});

test("no console errors (this also catches CSP violations)", async ({ page, consoleErrors }) => {
  await page.goto("/#/settings");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(de["nav.settings"]);
  expect(consoleErrors).toEqual([]);
});

test("the request guard records other origins and WebSockets", async ({
  page,
  externalRequests,
}) => {
  // Proves that the guard in fixtures.ts works, so the empty list checked
  // after every test means something. Even a WebSocket to the app's own
  // origin is blocked: the app never needs one.
  await page.evaluate(() => {
    new WebSocket(`ws://${location.host}/guard-test`);
  });
  await expect.poll(() => [...externalRequests]).toEqual([expect.stringMatching(/\/guard-test$/)]);

  await page.goto("https://example.invalid/").catch(() => undefined);
  await expect.poll(() => externalRequests.length).toBe(2);
  expect(externalRequests[1]).toBe("https://example.invalid/");

  // Empty the list again, so the check after this test passes.
  externalRequests.length = 0;
});

test("every request goes to the app's own origin", async ({ page, externalRequests }) => {
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(de["nav.today"]);
  // Give late requests (service worker, manifest, icons) a moment to start.
  await page.waitForLoadState("networkidle");
  expect(externalRequests).toEqual([]);
});

test("routes with parameters, redirects and the back header", async ({ page }) => {
  const nav = page.getByRole("navigation", { name: de["nav.label"] });
  const heading = page.getByRole("heading", { level: 1 });

  // #/add is an alias: the address becomes #/add/search and keeps ?meal.
  await page.goto("/#/add?meal=lunch");
  await expect(page).toHaveURL(/#\/add\/search\?meal=lunch$/);
  await expect(heading).toHaveText(de["nav.add"]);

  // A food: back variant of the header, "Hinzufügen" stays the active tab.
  await page.goto("/#/food/abc?meal=dinner");
  await expect(heading).toHaveText(de["add.portionTitle"]);
  const back = page.getByRole("link", { name: de["add.backToSearch"] });
  await expect(back).toHaveAttribute("href", "#/add/search");
  await expect(nav.getByRole("link", { name: de["nav.add"] })).toHaveAttribute(
    "aria-current",
    "page",
  );

  await page.goto("/#/food/abc/edit");
  await expect(heading).toHaveText(de["add.editFoodTitle"]);

  await page.goto("/#/entry/xyz");
  await expect(heading).toHaveText(de["add.portionTitle"]);
  await expect(nav.getByRole("link", { name: de["nav.today"] })).toHaveAttribute(
    "aria-current",
    "page",
  );

  // The back link of the about page leads to the settings, and focus moves
  // to the new heading.
  await page.goto("/#/settings/about");
  await expect(heading).toHaveText(de["settings.aboutTitle"]);
  await page.getByRole("main").getByRole("link", { name: de["nav.settings"] }).click();
  await expect(page).toHaveURL(/#\/settings$/);
  await expect(heading).toHaveText(de["nav.settings"]);
  await expect(heading).toBeFocused();
});

test("the today page shows the weekday as subtitle", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-20T12:00:00"));
  await page.goto("/#/today");
  await page.reload();
  await expect(page.getByText("Dienstag, 20. Oktober")).toBeVisible();
});

test("nav icons are decorative; every link has a text name", async ({ page }) => {
  const nav = page.getByRole("navigation", { name: de["nav.label"] });
  await expect(nav.locator("svg")).toHaveCount(4);
  for (const icon of await nav.locator("svg").all()) {
    await expect(icon).toHaveAttribute("aria-hidden", "true");
  }
  await expect(nav.getByRole("link")).toHaveText([
    de["nav.today"],
    de["nav.add"],
    de["nav.goals"],
    de["nav.settings"],
  ]);
});
