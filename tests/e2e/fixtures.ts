// Shared Playwright fixtures. Every spec imports `test` and `expect` from
// here instead of from @playwright/test, so these rules apply everywhere:
//
// - Requests to any origin other than the app's own are aborted and
//   recorded, and so is every WebSocket. After each test the list must be
//   empty: tests must never reach the internet, and the app must not try.
// - Console errors and uncaught exceptions are recorded. A CSP violation
//   shows up as a console error, so this also catches inline scripts/styles.
import { test as base, expect } from "@playwright/test";

interface Fixtures {
  /** URLs of requests to other origins and of WebSockets (all were blocked). */
  externalRequests: string[];
  /** Console errors and uncaught exceptions on the page. */
  consoleErrors: string[];
}

export const test = base.extend<Fixtures>({
  externalRequests: [
    async ({ context, baseURL }, use) => {
      if (baseURL === undefined) throw new Error("baseURL is not configured");
      const ownOrigin = new URL(baseURL).origin;
      const external: string[] = [];
      await context.route("**/*", async (route) => {
        const url = route.request().url();
        if (new URL(url).origin === ownOrigin) {
          await route.continue();
        } else {
          external.push(url);
          await route.abort("blockedbyclient");
        }
      });
      // The app has no reason to open a WebSocket at all (not even to its
      // own origin), so every attempt is closed and counted.
      await context.routeWebSocket(/.*/, async (ws) => {
        external.push(ws.url());
        await ws.close();
      });
      await use(external);
      // Checked after every test, also those that never look at the list.
      expect(external, "requests to other origins").toEqual([]);
    },
    // Runs for every test, even if the test does not ask for it.
    { auto: true },
  ],

  consoleErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => {
      errors.push(error.message);
    });
    await use(errors);
  },
});

export { expect };
