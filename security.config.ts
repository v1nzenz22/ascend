// Security policies of the deployed app, in one place.
//
// Why one file: the Content Security Policy (CSP) is used twice, once as a
// <meta> tag inside index.html (works everywhere, also in `vite preview` and
// the Playwright tests) and once as a real HTTP header in the `_headers` file
// that Cloudflare Pages reads. Two hand-written copies would drift apart, so
// vite.config.ts builds both from the values below.
//
// The `_headers` format: a path pattern on its own line, followed by indented
// `Name: value` lines. Cloudflare applies every block whose pattern matches,
// so `/*` adds its headers to all files and the other blocks add more.
// Docs: https://developers.cloudflare.com/pages/configuration/headers/

/**
 * CSP directives valid in a <meta> tag. Everything comes from our own
 * origin: no CDN, no external fonts, no trackers. Phase 4 adds the Open Food
 * Facts host to connect-src.
 */
export const CSP_DIRECTIVES: readonly string[] = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self'",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
];

/**
 * Directives that browsers only accept from an HTTP header. In a <meta> tag
 * they are ignored with a console error, so they must stay out of it.
 * frame-ancestors 'none': no other site may show the app inside a frame
 * (protects against clickjacking).
 */
export const CSP_HEADER_ONLY_DIRECTIVES: readonly string[] = ["frame-ancestors 'none'"];

/** The policy for the <meta http-equiv="Content-Security-Policy"> tag. */
export function metaContentSecurityPolicy(): string {
  return CSP_DIRECTIVES.join("; ");
}

/** The policy for the Content-Security-Policy HTTP header. */
export function headerContentSecurityPolicy(): string {
  return [...CSP_DIRECTIVES, ...CSP_HEADER_ONLY_DIRECTIVES].join("; ");
}

/**
 * Browser features the app does not use are switched off, so neither the app
 * nor anything injected into it can ask for them. Phase 4 changes the camera
 * to `camera=(self)` for the barcode scanner.
 */
export const PERMISSIONS_POLICY: readonly string[] = [
  "camera=()",
  "microphone=()",
  "geolocation=()",
  "payment=()",
  "usb=()",
  "interest-cohort=()",
];

/** One `_headers` block: a path pattern and the headers it gets. */
interface HeaderRule {
  path: string;
  headers: readonly (readonly [name: string, value: string])[];
}

// Files that must be checked for a new version on every load. `no-cache`
// does not mean "never cache": the browser keeps the file but asks the
// server each time whether it changed. Without it, a cached sw.js could hide
// a new app version for up to a day.
const REVALIDATE: readonly [string, string] = ["Cache-Control", "no-cache"];

export const HEADER_RULES: readonly HeaderRule[] = [
  {
    path: "/*",
    headers: [
      ["Content-Security-Policy", headerContentSecurityPolicy()],
      // Browsers must use the declared file type instead of guessing.
      ["X-Content-Type-Options", "nosniff"],
      // Never send the page address to other sites.
      ["Referrer-Policy", "no-referrer"],
      ["Permissions-Policy", PERMISSIONS_POLICY.join(", ")],
      // Pages from other sites opened from the app get no handle to it.
      ["Cross-Origin-Opener-Policy", "same-origin"],
      // Old browsers that do not know frame-ancestors.
      ["X-Frame-Options", "DENY"],
    ],
  },
  { path: "/sw.js", headers: [REVALIDATE] },
  { path: "/manifest.webmanifest", headers: [REVALIDATE] },
  // The start page is requested as "/", not "/index.html", so both are
  // listed (the design names only /index.html).
  { path: "/", headers: [REVALIDATE] },
  { path: "/index.html", headers: [REVALIDATE] },
  // Vite puts a content hash into every file name in /assets/, so a changed
  // file always gets a new name and the old one may be cached forever.
  {
    path: "/assets/*",
    headers: [["Cache-Control", "public, max-age=31536000, immutable"]],
  },
];

/** The content of `dist/_headers` for Cloudflare Pages. */
export function headersFile(): string {
  const lines: string[] = [];
  for (const rule of HEADER_RULES) {
    lines.push(rule.path);
    for (const [name, value] of rule.headers) lines.push(`  ${name}: ${value}`);
  }
  return `${lines.join("\n")}\n`;
}
