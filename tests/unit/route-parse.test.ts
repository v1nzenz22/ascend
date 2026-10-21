import { describe, expect, test } from "vitest";
import { matchPattern, parseHash, splitHash } from "../../src/app/route-parse";

const ROUTES = [
  { id: "today", pattern: "#/today" },
  { id: "food", pattern: "#/food/:id" },
  { id: "food-edit", pattern: "#/food/:id/edit" },
  { id: "add", pattern: "#/add/:tab" },
] as const;

describe("splitHash", () => {
  test("separates path and query", () => {
    expect(splitHash("#/add/search?meal=lunch")).toEqual({
      path: "#/add/search",
      query: "meal=lunch",
    });
    expect(splitHash("#/today")).toEqual({ path: "#/today", query: "" });
    expect(splitHash("")).toEqual({ path: "", query: "" });
  });
});

describe("matchPattern", () => {
  test("fixed patterns match only themselves", () => {
    expect(matchPattern("#/today", "#/today")).toEqual({});
    expect(matchPattern("#/today", "#/today/x")).toBeNull();
    expect(matchPattern("#/today", "#/goals")).toBeNull();
  });

  test("parameters take one decoded segment", () => {
    expect(matchPattern("#/food/:id", "#/food/abc-123")).toEqual({ id: "abc-123" });
    expect(matchPattern("#/food/:id", "#/food/M%C3%BCsli")).toEqual({ id: "Müsli" });
    expect(matchPattern("#/food/:id", "#/food/a/b")).toBeNull();
  });

  test("empty or broken parameters do not match", () => {
    expect(matchPattern("#/food/:id", "#/food/")).toBeNull();
    expect(matchPattern("#/food/:id", "#/food/%E0%A4%A")).toBeNull();
  });
});

describe("parseHash", () => {
  test("finds the route with path and query parameters", () => {
    const match = parseHash("#/food/abc?meal=lunch", ROUTES);
    expect(match).toEqual({
      kind: "route",
      route: ROUTES[1],
      params: { id: "abc", meal: "lunch" },
    });
  });

  test("a longer pattern is not confused with a shorter one", () => {
    const match = parseHash("#/food/abc/edit", ROUTES);
    expect(match.kind === "route" && match.route.id).toBe("food-edit");
  });

  test("path parameters win over query parameters of the same name", () => {
    const match = parseHash("#/food/a?id=b", ROUTES);
    expect(match.kind === "route" && match.params.id).toBe("a");
  });

  test("the first of repeated query parameters wins", () => {
    const match = parseHash("#/add/search?meal=lunch&meal=dinner", ROUTES);
    expect(match.kind === "route" && match.params.meal).toBe("lunch");
  });

  test("params are frozen", () => {
    const match = parseHash("#/today?x=1", ROUTES);
    expect(match.kind === "route" && Object.isFrozen(match.params)).toBe(true);
  });

  test("a __proto__ key in the query cannot change the prototype", () => {
    const match = parseHash("#/today?__proto__=evil&constructor=x", ROUTES);
    if (match.kind !== "route") throw new Error("expected a route");
    expect(Object.getPrototypeOf(match.params)).toBe(Object.prototype);
    expect(Object.hasOwn(match.params, "__proto__")).toBe(true);
    expect(({} as Record<string, unknown>).evil).toBeUndefined();
  });

  test("redirects keep the query", () => {
    expect(parseHash("#/add", ROUTES, { "#/add": "#/add/search" })).toEqual({
      kind: "redirect",
      hash: "#/add/search",
    });
    expect(parseHash("#/add?meal=snacks", ROUTES, { "#/add": "#/add/search" })).toEqual({
      kind: "redirect",
      hash: "#/add/search?meal=snacks",
    });
  });

  test("redirect lookup ignores inherited keys", () => {
    expect(parseHash("toString", ROUTES, {})).toEqual({ kind: "unknown" });
  });

  test("unknown hashes", () => {
    expect(parseHash("", ROUTES)).toEqual({ kind: "unknown" });
    expect(parseHash("#/nothing", ROUTES)).toEqual({ kind: "unknown" });
    expect(parseHash("#today", ROUTES)).toEqual({ kind: "unknown" });
  });
});
