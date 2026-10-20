// Unit test configuration (Vitest). Kept apart from vite.config.ts so the
// PWA and CSP plugins never run during unit tests.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Logic tests run in Node; there is no browser here.
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    // Node has no IndexedDB. fake-indexeddb provides an in-memory one for
    // tests only; it is never imported by app code in src/.
    setupFiles: ["fake-indexeddb/auto"],
    // Vitest replaces CSS imports with empty strings by default (tests don't
    // need styles). tokens.test.ts reads tokens.css with `?raw`, so that one
    // file must be loaded for real.
    css: { include: [/tokens\.css/] },
    // One fixed time zone for every machine. Europe/Berlin because it has
    // daylight-saving changes: the local-date tests check that days never
    // shift across them, which a zone like UTC could not prove. Vitest sets
    // this before the test files load, so Node's Date and Intl use it
    // (checked by the "test environment" test in local-date.test.ts).
    env: { TZ: "Europe/Berlin" },
    // Explicit imports (`import { test } from 'vitest'`) instead of globals.
    globals: false,
  },
});
