import { describe, expect, test } from "vitest";
import { DEFAULT_HASH, DEFAULT_ROUTE, findRoute, ROUTES } from "../../src/app/routes";

describe("routes", () => {
  test("the default route is the today page", () => {
    expect(DEFAULT_HASH).toBe("#/today");
    expect(DEFAULT_ROUTE.hash).toBe(DEFAULT_HASH);
    expect(DEFAULT_ROUTE.id).toBe("today");
  });

  test("findRoute knows every route and nothing else", () => {
    for (const route of ROUTES) expect(findRoute(route.hash)).toBe(route);
    expect(findRoute("")).toBeUndefined();
    expect(findRoute("#/does-not-exist")).toBeUndefined();
  });
});
