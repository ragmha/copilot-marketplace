import type { PluginType } from "./marketplace";

export type CatalogState = {
  query: string;
  type: PluginType | "all";
  category: string;
  sort: "relevance" | "recent" | "name";
};

export type CatalogItem = {
  name: string;
  type: string;
  category: string;
  updated: string;
  searchText: string;
};

export const defaultCatalogState: CatalogState = {
  query: "",
  type: "all",
  category: "",
  sort: "relevance",
};

export function readCatalogState(
  params: URLSearchParams,
  types: readonly PluginType[],
  categories: readonly string[],
): CatalogState {
  const sort = params.get("sort");
  return {
    query: params.get("q")?.trim() ?? "",
    type: types.find((type) => type === params.get("type")) ?? "all",
    category: categories.find((category) => category === params.get("category")) ?? "",
    sort: sort === "recent" || sort === "name" ? sort : "relevance",
  };
}

export function catalogParams(state: CatalogState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.query.trim()) params.set("q", state.query.trim());
  if (state.type !== "all") params.set("type", state.type);
  if (state.category) params.set("category", state.category);
  if (state.sort !== "relevance") params.set("sort", state.sort);
  return params;
}

export function updateCatalogUrl(url: URL, state: CatalogState): URL {
  const next = new URL(url);
  for (const key of ["q", "type", "category", "sort"]) next.searchParams.delete(key);
  for (const [key, value] of catalogParams(state)) next.searchParams.set(key, value);
  return next;
}

export function selectCatalogItems<T extends CatalogItem>(
  items: readonly T[],
  state: CatalogState,
): T[] {
  const query = state.query.trim().toLowerCase();
  const terms = query.split(/\s+/).filter(Boolean);
  const score = (item: T) => {
    const name = item.name.toLowerCase();
    return (name === query ? 100 : 0) + terms.reduce(
      (total, term) => total + (name === term ? 50 : name.startsWith(term) ? 20 : name.includes(term) ? 10 : 0),
      0,
    );
  };

  return items
    .filter((item) =>
      (state.type === "all" || item.type === state.type) &&
      (!state.category || item.category === state.category) &&
      terms.every((term) => item.searchText.toLowerCase().includes(term)),
    )
    .sort((a, b) => {
      if (state.sort === "name") return a.name.localeCompare(b.name);
      if (state.sort === "relevance" && query) {
        const relevance = score(b) - score(a);
        if (relevance) return relevance;
      }
      return b.updated.localeCompare(a.updated) || a.name.localeCompare(b.name);
    });
}
