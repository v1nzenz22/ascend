// Checks the generated Cloudflare Pages `_headers` file and that it uses the
// same Content Security Policy as the <meta> tag in index.html.
import { describe, expect, test } from "vitest";
import {
  headerContentSecurityPolicy,
  headersFile,
  metaContentSecurityPolicy,
} from "../../security.config";

/** Parses `_headers` into path → (header name → value). */
function parseHeaders(text: string): Map<string, Map<string, string>> {
  const rules = new Map<string, Map<string, string>>();
  let current: Map<string, string> | undefined;
  for (const line of text.split("\n")) {
    if (line.trim() === "") continue;
    if (!line.startsWith(" ")) {
      current = new Map();
      rules.set(line, current);
      continue;
    }
    if (current === undefined) throw new Error(`header before any path: ${line}`);
    const match = /^ {2}([A-Za-z-]+): (.+)$/.exec(line);
    if (match?.[1] === undefined || match[2] === undefined) {
      throw new Error(`malformed line: ${line}`);
    }
    current.set(match[1], match[2]);
  }
  return rules;
}

const rules = parseHeaders(headersFile());

/** The headers of one path; fails if the path is missing. */
function headersFor(path: string): Map<string, string> {
  const headers = rules.get(path);
  if (headers === undefined) throw new Error(`no rule for ${path}`);
  return headers;
}

describe("Content Security Policy", () => {
  test("the meta policy is unchanged from Phase 2", () => {
    expect(metaContentSecurityPolicy()).toBe(
      [
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
      ].join("; "),
    );
  });

  test("the meta policy has no header-only directive", () => {
    // Browsers ignore frame-ancestors in <meta> and log a console error.
    expect(metaContentSecurityPolicy()).not.toContain("frame-ancestors");
  });

  test("the header is the meta policy plus frame-ancestors 'none'", () => {
    expect(headerContentSecurityPolicy()).toBe(
      `${metaContentSecurityPolicy()}; frame-ancestors 'none'`,
    );
  });

  test("no unsafe sources and no other hosts", () => {
    const csp = headerContentSecurityPolicy();
    expect(csp).not.toContain("unsafe-inline");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toMatch(/https?:|\*/);
  });
});

describe("_headers", () => {
  test("every file gets the security headers", () => {
    const all = headersFor("/*");
    expect(all.get("Content-Security-Policy")).toBe(headerContentSecurityPolicy());
    expect(all.get("X-Content-Type-Options")).toBe("nosniff");
    expect(all.get("Referrer-Policy")).toBe("no-referrer");
    expect(all.get("Cross-Origin-Opener-Policy")).toBe("same-origin");
    expect(all.get("X-Frame-Options")).toBe("DENY");
  });

  test("unused browser features are switched off, the camera too (until Phase 4)", () => {
    const policy = headersFor("/*").get("Permissions-Policy") ?? "";
    for (const feature of ["camera", "microphone", "geolocation", "payment", "usb"]) {
      expect(policy).toContain(`${feature}=()`);
    }
    expect(policy).toContain("interest-cohort=()");
  });

  test("the service worker, manifest and start page are revalidated", () => {
    for (const path of ["/sw.js", "/manifest.webmanifest", "/", "/index.html"]) {
      expect(headersFor(path).get("Cache-Control"), path).toBe("no-cache");
    }
  });

  test("hashed assets are cached for a year", () => {
    expect(headersFor("/assets/*").get("Cache-Control")).toBe(
      "public, max-age=31536000, immutable",
    );
  });

  test("no HSTS header (only with a custom domain)", () => {
    for (const headers of rules.values()) {
      expect(headers.has("Strict-Transport-Security")).toBe(false);
    }
  });

  test("format: within Cloudflare's limits, ends with a newline", () => {
    const text = headersFile();
    expect(text.endsWith("\n")).toBe(true);
    // Cloudflare Pages: at most 100 rules and 2000 characters per line.
    expect(rules.size).toBeLessThanOrEqual(100);
    for (const line of text.split("\n")) expect(line.length).toBeLessThanOrEqual(2000);
  });
});
