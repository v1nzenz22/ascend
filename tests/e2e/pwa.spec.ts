// Installability basics: manifest, icons and the Content Security Policy.
// Node loads this spec as an ES module, which requires the json attribute.
import tokens from "../../design/tokens.json" with { type: "json" };
import { de } from "../../src/i18n/de";
import { expect, test } from "./fixtures";

interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
}

interface Manifest {
  name: string;
  short_name: string;
  description: string;
  lang: string;
  display: string;
  start_url: string;
  theme_color: string;
  background_color: string;
  icons: ManifestIcon[];
}

/** Resolves a `{color.paper}` reference from tokens.json to its hex value. */
function tokenColor(value: string): string {
  const reference = /^\{color\.(\w+)\}$/.exec(value);
  if (reference?.[1] === undefined) return value;
  const colors: Record<string, string> = tokens.color;
  const hex = colors[reference[1]];
  if (hex === undefined) throw new Error(`Unknown token reference ${value}`);
  return hex;
}

// The browser bar and splash colour: the app background (bgApp) of each theme.
const LIGHT_APP = tokenColor(tokens.theme.light.bgApp);
const DARK_APP = tokenColor(tokens.theme.dark.bgApp);

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("manifest is linked, valid and its icons load", async ({ page, request }) => {
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).not.toBeNull();
  const manifestUrl = new URL(href ?? "", page.url());

  const response = await request.get(manifestUrl.href);
  expect(response.status()).toBe(200);
  const manifest = (await response.json()) as Manifest;

  expect(manifest.name).toBe(de["app.name"]);
  expect(manifest.short_name).toBe(de["app.name"]);
  expect(manifest.description).toBe(de["app.description"]);
  expect(manifest.lang).toBe("de");
  expect(manifest.display).toBe("standalone");
  expect(manifest.start_url).toBe("/");
  expect(manifest.theme_color.toLowerCase()).toBe(LIGHT_APP.toLowerCase());
  expect(manifest.background_color.toLowerCase()).toBe(LIGHT_APP.toLowerCase());

  expect(manifest.icons.map((icon) => [icon.src, icon.sizes, icon.purpose])).toEqual([
    ["icons/icon-192.png", "192x192", "any"],
    ["icons/icon-512.png", "512x512", "any"],
    // The same file: the full-bleed icon also works as maskable icon.
    ["icons/icon-512.png", "512x512", "maskable"],
  ]);

  // The manifest icons plus the iOS home-screen icon, each file once.
  const appleHref = await page.locator('link[rel="apple-touch-icon"]').getAttribute("href");
  expect(appleHref).toBe("/icons/apple-touch-icon-180.png");
  const iconUrls = new Set([
    ...manifest.icons.map((icon) => new URL(icon.src, manifestUrl).href),
    new URL(appleHref ?? "", page.url()).href,
  ]);
  expect(iconUrls.size).toBe(3);
  for (const url of iconUrls) {
    const icon = await request.get(url);
    expect(icon.status(), url).toBe(200);
    expect(icon.headers()["content-type"], url).toContain("image/png");
  }
});

test("Content Security Policy is set", async ({ page }) => {
  const csp = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute("content");
  expect(csp).not.toBeNull();
  const directives = (csp ?? "").split(";").map((part) => part.trim());
  expect(directives).toContain("default-src 'self'");
  expect(directives).toContain("script-src 'self'");
  expect(directives).toContain("style-src 'self'");
  expect(directives).toContain("connect-src 'self'");
  expect(directives).toContain("object-src 'none'");
  expect(csp).not.toContain("unsafe-inline");
  expect(csp).not.toContain("unsafe-eval");
});

test("theme-color meta tags match the design tokens", async ({ page }) => {
  const light = await page
    .locator('meta[name="theme-color"][media="(prefers-color-scheme: light)"]')
    .getAttribute("content");
  const dark = await page
    .locator('meta[name="theme-color"][media="(prefers-color-scheme: dark)"]')
    .getAttribute("content");
  expect(light?.toLowerCase()).toBe(LIGHT_APP.toLowerCase());
  expect(dark?.toLowerCase()).toBe(DARK_APP.toLowerCase());
});

test("iOS meta tags are present", async ({ page }) => {
  await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute(
    "content",
    "ascend",
  );
  await expect(page.locator('meta[name="referrer"]')).toHaveAttribute("content", "no-referrer");
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
    "content",
    /viewport-fit=cover/,
  );
});
