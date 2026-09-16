import { describe, expect, test } from "bun:test";
import {
  catalogParams,
  defaultCatalogState,
  readCatalogState,
  selectCatalogItems,
  updateCatalogUrl,
} from "../src/lib/catalog.ts";

const items = [
  { name: "release-captain", type: "plugin", category: "Delivery", updated: "2026-09-01", searchText: "release-captain release notes Developer Experience 1.0.0 Delivery" },
  { name: "internal-docs", type: "mcp-server", category: "Onboarding", updated: "2026-09-02", searchText: "internal-docs search runbooks Platform Engineering 2.0.0 Onboarding" },
  { name: "api-contract-check", type: "skill", category: "Code quality", updated: "2026-09-03", searchText: "api-contract-check OpenAPI breaking changes Quality Engineering 1.1.0 Code quality" },
  { name: "release-notes", type: "skill", category: "Delivery", updated: "2026-09-01", searchText: "release-notes changelog Developer Experience 1.0.0 Delivery" },
  { name: "review-companion", type: "agent", category: "Code quality", updated: "2026-09-04", searchText: "review-companion review changes and release-captain output Quality Engineering 1.0.0 Code quality" },
];
const types = ["plugin", "skill", "mcp-server", "agent"];
const categories = ["Delivery", "Onboarding", "Code quality"];
const select = (state = {}) => selectCatalogItems(items, { ...defaultCatalogState, ...state }).map((item) => item.name);

describe("catalog discovery", () => {
  test("shows all types by default, newest first with stable name ties", () => {
    expect(select()).toEqual([
      "review-companion", "api-contract-check", "internal-docs", "release-captain", "release-notes",
    ]);
  });

  test("finds a non-plugin entry without first changing its type", () => {
    expect(select({ query: "internal-docs" })).toEqual(["internal-docs"]);
  });

  test("matches words across fields regardless of order, case, or whitespace", () => {
    expect(select({ query: "  ENGINEERING   openapi  " })).toEqual(["api-contract-check"]);
    expect(select({ query: "1.1.0" })).toEqual(["api-contract-check"]);
  });

  test("ranks an exact name ahead of newer description matches", () => {
    expect(select({ query: "release-captain" })).toEqual(["release-captain", "review-companion"]);
  });

  test("combines query, type, and exact category filters", () => {
    expect(select({ query: "developer", type: "skill", category: "Delivery" })).toEqual(["release-notes"]);
    expect(select({ type: "skill", category: "Onboarding" })).toEqual([]);
    expect(select({ category: "Code" })).toEqual([]);
  });

  test("honors explicit alphabetical and recent sorts", () => {
    expect(select({ sort: "name" })).toEqual([
      "api-contract-check", "internal-docs", "release-captain", "release-notes", "review-companion",
    ]);
    expect(select({ query: "release-captain", sort: "recent" })).toEqual(["review-companion", "release-captain"]);
  });

  test("supports empty catalogs and no matches without modifying the source", () => {
    const original = [...items];
    expect(selectCatalogItems([], defaultCatalogState)).toEqual([]);
    expect(select({ query: "does-not-exist" })).toEqual([]);
    select({ sort: "name" });
    expect(items).toEqual(original);
  });
});

describe("shareable catalog state", () => {
  test("restores a full set of filters", () => {
    expect(readCatalogState(new URLSearchParams("q=review&type=agent&category=Code+quality&sort=name"), types, categories)).toEqual({
      query: "review", type: "agent", category: "Code quality", sort: "name",
    });
  });

  test("unknown or removed filters fall back to the complete catalog", () => {
    expect(readCatalogState(new URLSearchParams("type=retired&category=gone&sort=invalid"), types, categories))
      .toEqual(defaultCatalogState);
  });

  test("keeps zero-entry supported types selected", () => {
    expect(readCatalogState(new URLSearchParams("type=hook"), [...types, "hook"], categories).type).toBe("hook");
  });

  test("omits defaults and safely round-trips special characters", () => {
    expect(catalogParams(defaultCatalogState).toString()).toBe("");
    const state = { ...defaultCatalogState, query: "<script>& café + notes", category: "Code quality" };
    expect(readCatalogState(catalogParams(state), types, categories)).toEqual(state);
  });

  test.each(["/", "/acme-marketplace/"])("preserves hosting base %s, unrelated params, and anchors", (base) => {
    const original = new URL(`https://example.test${base}?campaign=demo&type=skill#catalog`);
    const next = updateCatalogUrl(original, { ...defaultCatalogState, query: "release notes" });
    expect(next.pathname).toBe(base);
    expect(next.hash).toBe("#catalog");
    expect(next.searchParams.get("campaign")).toBe("demo");
    expect(next.searchParams.get("q")).toBe("release notes");
    expect(next.searchParams.has("type")).toBe(false);
    expect(original.searchParams.get("type")).toBe("skill");
    expect(updateCatalogUrl(next, defaultCatalogState).search).toBe("?campaign=demo");
  });
});
