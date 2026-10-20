// The app starts and navigates without network once the service worker has
// cached it. Runs only in the "offline" project (Chromium).
import { de } from "../../src/i18n/de";
import { expect, test } from "./fixtures";

test("starts and navigates offline after the first visit", async ({ page, context }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(de["nav.today"]);

  // Wait until the service worker is installed and controls this page
  // (it claims open pages as soon as it is active).
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  await context.setOffline(true);

  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(de["nav.today"]);

  // Navigation inside the app works offline.
  const nav = page.getByRole("navigation", { name: de["nav.label"] });
  await nav.getByRole("link", { name: de["nav.goals"] }).click();
  await expect(page).toHaveURL(/#\/goals$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(de["nav.goals"]);

  // Opening a page directly (as from a bookmark) also works offline. A new
  // page makes this a real cold start: the browser requests the document
  // and the service worker answers from its cache (navigateFallback).
  // page.goto on the open page would only change the hash.
  const fresh = await context.newPage();
  await fresh.goto("/#/settings");
  await expect(fresh.getByRole("heading", { level: 1 })).toHaveText(de["nav.settings"]);
  expect(await fresh.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
});
