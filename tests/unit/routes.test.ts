import { describe, expect, test } from "vitest";
import { parseHash } from "../../src/app/route-parse";
import { DEFAULT_HASH, NAV_ITEMS, REDIRECTS, ROUTES } from "../../src/app/routes";

/** The route id for `hash`, following one redirect. */
function routeIdOf(hash: string): string | undefined {
  let match = parseHash(hash, ROUTES, REDIRECTS);
  if (match.kind === "redirect") match = parseHash(match.hash, ROUTES, REDIRECTS);
  return match.kind === "route" ? match.route.id : undefined;
}

describe("routes", () => {
  test("the default hash is the today page", () => {
    expect(DEFAULT_HASH).toBe("#/today");
    expect(routeIdOf(DEFAULT_HASH)).toBe("today");
  });

  test("route ids and patterns are unique", () => {
    expect(new Set(ROUTES.map((r) => r.id)).size).toBe(ROUTES.length);
    expect(new Set(ROUTES.map((r) => r.pattern)).size).toBe(ROUTES.length);
  });

  test.each([
    ["#/today", "today"],
    ["#/add/search?meal=lunch", "add"],
    ["#/add/scan", "add"],
    ["#/add/manual", "add"],
    ["#/add", "add"],
    ["#/food/abc", "food"],
    ["#/food/abc/edit", "food-edit"],
    ["#/entry/abc", "entry"],
    ["#/goals", "goals"],
    ["#/settings", "settings"],
    ["#/settings/about", "about"],
    ["#/ui", "kit"],
  ])("%s → %s", (hash, id) => {
    expect(routeIdOf(hash)).toBe(id);
  });

  test("#/add redirects to the search tab and keeps the meal", () => {
    expect(parseHash("#/add?meal=dinner", ROUTES, REDIRECTS)).toEqual({
      kind: "redirect",
      hash: "#/add/search?meal=dinner",
    });
  });

  test("every nav link leads to a route marked with that nav id", () => {
    expect(NAV_ITEMS.map((item) => item.id)).toEqual(["today", "add", "goals", "settings"]);
    for (const item of NAV_ITEMS) {
      const match = parseHash(item.href, ROUTES, REDIRECTS);
      expect(match.kind).toBe("route");
      if (match.kind === "route") expect(match.route.navId).toBe(item.id);
    }
  });

  test("unknown hashes match nothing", () => {
    expect(routeIdOf("")).toBeUndefined();
    expect(routeIdOf("#/does-not-exist")).toBeUndefined();
    expect(routeIdOf("#/food/")).toBeUndefined();
  });
});
