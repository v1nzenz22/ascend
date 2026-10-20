// Browser tests (Playwright) against the production build.
//
// The web server builds the app and serves it with `vite preview` on the
// loopback address only, so nothing is reachable from the network. Every
// test also blocks requests to other origins (see tests/e2e/fixtures.ts):
// tests never touch the internet.
import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${String(PORT)}`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  // Local HTML report only; never opened automatically, never uploaded.
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    // Keep a trace only for failed tests (stored locally in test-results/).
    // "on-first-retry" never recorded anything, because tests are not retried.
    trace: "retain-on-failure",
  },
  webServer: {
    // Always test a fresh build: deterministic, and it is what users get.
    command: `npm run build && npm run preview -- --host 127.0.0.1`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: "iphone",
      use: { ...devices["iPhone 15"] },
      testIgnore: /offline\.spec\.ts/,
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
      testIgnore: /offline\.spec\.ts/,
    },
    {
      // Service workers are most reliable in Chromium; the real offline check
      // on the iPhone is manual (see the phase-end checklist).
      name: "offline",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /offline\.spec\.ts/,
    },
  ],
});
