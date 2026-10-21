// Turns a URL hash like "#/food/abc?meal=lunch" into a route and its
// parameters. Pure functions without DOM access, so every case is easy to
// unit-test (tests/unit/route-parse.test.ts).
//
// Patterns are written like the hash itself, with ":name" for a parameter:
// "#/food/:id" matches "#/food/abc" with { id: "abc" }. A parameter matches
// exactly one path segment (never a "/").

/** Anything with a pattern can be matched (routes.ts adds more fields). */
export interface Patterned {
  pattern: string;
}

export type Params = Readonly<Record<string, string>>;

export type HashMatch<R extends Patterned> =
  | { kind: "route"; route: R; params: Params }
  /** The hash is an alias: show `hash` instead (keeps the query). */
  | { kind: "redirect"; hash: string }
  | { kind: "unknown" };

/** "#/add/search?meal=lunch" → { path: "#/add/search", query: "meal=lunch" } */
export function splitHash(hash: string): { path: string; query: string } {
  const at = hash.indexOf("?");
  return at === -1
    ? { path: hash, query: "" }
    : { path: hash.slice(0, at), query: hash.slice(at + 1) };
}

/** Decodes "%C3%BC" → "ü"; `null` for broken escapes like "%E0%A4%A". */
function decode(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

/**
 * The parameters if `path` matches `pattern`, else `null`.
 * Empty parameters ("#/food/") do not match: an id is never empty.
 */
export function matchPattern(pattern: string, path: string): Record<string, string> | null {
  const patternParts = pattern.split("/");
  const pathParts = path.split("/");
  if (patternParts.length !== pathParts.length) return null;

  const entries: [string, string][] = [];
  for (const [index, part] of patternParts.entries()) {
    const actual = pathParts[index] ?? "";
    if (part.startsWith(":")) {
      const value = decode(actual);
      if (value === null || value === "") return null;
      entries.push([part.slice(1), value]);
    } else if (part !== actual) {
      return null;
    }
  }
  // Object.fromEntries (unlike `obj[key] = …`) can never change the object's
  // prototype, even for a key like "__proto__" typed into the address bar.
  return Object.fromEntries(entries);
}

/** Query parameters as a plain object (the first value wins for repeated keys). */
function parseQuery(query: string): Record<string, string> {
  const entries: [string, string][] = [];
  const seen = new Set<string>();
  for (const [key, value] of new URLSearchParams(query)) {
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push([key, value]);
  }
  return Object.fromEntries(entries);
}

/**
 * Finds the route for `hash`.
 * - `redirects` maps alias paths to real ones ("#/add" → "#/add/search").
 * - Parameters from the path win over query parameters of the same name, so
 *   "#/food/a?id=b" still means food "a".
 */
export function parseHash<R extends Patterned>(
  hash: string,
  routes: readonly R[],
  redirects: Readonly<Record<string, string>> = {},
): HashMatch<R> {
  const { path, query } = splitHash(hash);

  if (Object.hasOwn(redirects, path)) {
    const target = redirects[path] ?? "";
    return { kind: "redirect", hash: query === "" ? target : `${target}?${query}` };
  }

  for (const route of routes) {
    const pathParams = matchPattern(route.pattern, path);
    if (pathParams !== null) {
      return {
        kind: "route",
        route,
        params: Object.freeze({ ...parseQuery(query), ...pathParams }),
      };
    }
  }
  return { kind: "unknown" };
}
