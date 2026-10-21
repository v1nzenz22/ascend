// Vite build configuration: bundling, the PWA (manifest + service worker),
// the Content Security Policy and the Cloudflare Pages `_headers` file for
// the production build. The policies themselves live in security.config.ts.
// Unit tests have their own config (vitest.config.ts), so these plugins never
// run during tests.
import { defineConfig, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import packageJson from "./package.json" with { type: "json" };
import { headersFile, metaContentSecurityPolicy } from "./security.config";
import { de } from "./src/i18n/de";

// The app is served from the site root. If hosting ever puts it under a
// sub-path (e.g. /ascend/), only this value changes.
const BASE = "/";

// Surface colour of the light theme (theme.light.windowBackground).
const THEME_COLOR = "#FBFAF7";

/**
 * Adds the CSP as a <meta> tag, only to the production build. The dev server
 * injects inline styles for hot reloading, which this strict policy would
 * block. The tag goes right after <meta charset>, because a meta CSP only
 * protects what comes after it.
 */
function contentSecurityPolicy(): Plugin {
  const charset = '<meta charset="UTF-8" />';
  return {
    name: "ascend:csp",
    apply: "build",
    transformIndexHtml(html) {
      if (!html.includes(charset)) {
        throw new Error(`ascend:csp: index.html must contain ${charset}`);
      }
      const meta = `<meta http-equiv="Content-Security-Policy" content="${metaContentSecurityPolicy()}" />`;
      return html.replace(charset, `${charset}\n    ${meta}`);
    },
  };
}

/**
 * Writes `_headers` into dist/. Cloudflare Pages reads it and sends these
 * HTTP headers with every file (see security.config.ts). Build only: the dev
 * server and `vite preview` ignore the file.
 */
function cloudflareHeaders(): Plugin {
  return {
    name: "ascend:headers",
    apply: "build",
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "_headers", source: headersFile() });
    },
  };
}

export default defineConfig({
  base: BASE,
  // The app version for the settings page ("ascend 0.1"). `define` replaces
  // the name with the string literal at build time.
  define: { __APP_VERSION__: JSON.stringify(packageJson.version) },
  // Never listen on the network: only this computer can open the app.
  server: { host: "localhost" },
  preview: { host: "localhost" },
  build: {
    // iOS Safari 16.4 is the oldest browser we support. Vite only lowers
    // syntax; newer APIs are kept out by tsconfig's "lib".
    target: ["es2022", "safari16.4"],
    // Never inline assets as data: URLs, so the CSP can stay at img-src 'self'.
    assetsInlineLimit: 0,
    // No source maps in the shipped app.
    sourcemap: false,
  },
  plugins: [
    contentSecurityPolicy(),
    cloudflareHeaders(),
    VitePWA({
      strategies: "generateSW",
      // A new version installs in the background and then waits. The app
      // shows "Neue Version verfügbar" and the user decides when to reload
      // (src/app/update.ts). This way a new version never replaces the old
      // one while the user is typing.
      registerType: "prompt",
      // "auto": as long as no code imports `virtual:pwa-register`, the plugin
      // adds an external registerSW.js that only registers the service
      // worker. As soon as src/app/update.ts is imported (from main.ts), the
      // plugin notices it and leaves the registration to update.ts. Never
      // "inline": that would need an inline <script>, which the CSP forbids.
      injectRegister: "auto",
      // No service worker in `npm run dev`: avoids stale caches while
      // developing. It exists only in build/preview.
      devOptions: { enabled: false },
      // The icons (including apple-touch-icon-180.png) are already precached
      // by globPatterns below. Adding them again here would list every icon
      // twice in the service worker.
      includeManifestIcons: false,
      manifest: {
        name: de["app.name"],
        short_name: de["app.name"],
        description: de["app.description"],
        lang: "de",
        dir: "ltr",
        id: BASE,
        start_url: BASE,
        scope: BASE,
        display: "standalone",
        theme_color: THEME_COLOR,
        background_color: THEME_COLOR,
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          // The same full-bleed image works as maskable icon (see D16), so it
          // is listed twice instead of shipping an identical copy. Two entries
          // rather than purpose "any maskable": Chrome advises against
          // combining both purposes in one entry.
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Precache the whole app shell so it starts without network.
        // wasm is listed for the barcode scanner (Phase 4). The web manifest
        // is missing on purpose: the plugin adds it to the precache itself.
        globPatterns: ["**/*.{html,js,css,png,svg,wasm}"],
        navigateFallback: "index.html",
        cleanupOutdatedCaches: true,
        // No skipWaiting: a new version waits until the user taps "Neu
        // laden" (registerType "prompt").
        // clientsClaim only matters for the very first install: the new
        // service worker then controls the open page at once, so the app
        // works offline right after the first visit. For an update it has no
        // effect until the user agreed, because a waiting worker cannot claim.
        clientsClaim: true,
        // Bundle the Workbox runtime into sw.js instead of loading it as a
        // separate file.
        inlineWorkboxRuntime: true,
        mode: "production",
        disableDevLogs: true,
        sourcemap: false,
        // Deliberately not set: runtimeCaching (no requests to other sites
        // in Phase 2), importScripts and offlineGoogleAnalytics (never).
      },
    }),
  ],
});
