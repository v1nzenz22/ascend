// Responsive layout: tab bar at the bottom on the phone, side navigation on
// the desktop, and dark mode.
import { de } from "../../src/i18n/de";
import { expect, test } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(de["nav.today"]);
});

test("iPhone: horizontal tab bar at the bottom", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "iphone", "phone layout only");
  const viewport = page.viewportSize();
  if (viewport === null) throw new Error("no viewport");

  const nav = page.getByRole("navigation", { name: de["nav.label"] });
  const box = await nav.boundingBox();
  if (box === null) throw new Error("nav is not visible");
  expect(Math.round(box.y + box.height)).toBe(viewport.height);
  expect(Math.round(box.width)).toBe(viewport.width);

  // All four links sit side by side in one row, each at least 44 px tall.
  const boxes = await Promise.all(
    (await nav.getByRole("link").all()).map(async (link) => link.boundingBox()),
  );
  expect(boxes).toHaveLength(4);
  const ys = new Set(boxes.map((b) => Math.round(b?.y ?? -1)));
  expect(ys.size).toBe(1);
  for (const b of boxes) expect(b?.height ?? 0).toBeGreaterThanOrEqual(44);
});

test("desktop: full-height navigation on the left", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop layout only");
  const viewport = page.viewportSize();
  if (viewport === null) throw new Error("no viewport");

  const nav = page.getByRole("navigation", { name: de["nav.label"] });
  const box = await nav.boundingBox();
  if (box === null) throw new Error("nav is not visible");
  expect(box.x).toBe(0);
  expect(Math.round(box.width)).toBe(264);
  expect(Math.round(box.height)).toBe(viewport.height);

  // Links are stacked vertically.
  const boxes = await Promise.all(
    (await nav.getByRole("link").all()).map(async (link) => link.boundingBox()),
  );
  const ys = boxes.map((b) => b?.y ?? -1);
  expect([...ys].sort((a, b) => a - b)).toEqual(ys);
  expect(new Set(boxes.map((b) => Math.round(b?.x ?? -1))).size).toBe(1);

  // The heading sits to the right of the navigation.
  const heading = await page.getByRole("heading", { level: 1 }).boundingBox();
  expect(heading?.x ?? 0).toBeGreaterThan(box.width);
});

test("follows the system colour scheme", async ({ page }) => {
  const background = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

  await page.emulateMedia({ colorScheme: "light" });
  expect(await background()).toBe("rgb(251, 250, 247)"); // #FBFAF7

  await page.emulateMedia({ colorScheme: "dark" });
  expect(await background()).toBe("rgb(20, 24, 24)"); // #141818
});
