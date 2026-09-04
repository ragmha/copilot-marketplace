// Shared helpers for the marketplace tooling (validation + generation).
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(here, "..", "..");

export const paths = {
  pluginSchema: join(repoRoot, "schemas", "plugin.schema.json"),
  marketplaceSchema: join(repoRoot, "schemas", "marketplace.schema.json"),
  pluginsDir: join(repoRoot, "plugins"),
  // The canonical catalog Copilot clients read from the repository.
  marketplaceFile: join(repoRoot, ".github", "plugin", "marketplace.json"),
  // The same document, served by the site so it also has a public URL.
  siteCopy: join(repoRoot, "public", "marketplace.json"),
};

export function readJson(path) {
  const raw = readFileSync(path, "utf8");
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON in ${path}: ${error.message}`);
  }
}

/** Discover every `plugins/<name>/plugin.json`. */
export function discoverPluginDirs() {
  if (!existsSync(paths.pluginsDir)) return [];

  return readdirSync(paths.pluginsDir)
    .filter((entry) => {
      const dir = join(paths.pluginsDir, entry);
      return statSync(dir).isDirectory() && existsSync(join(dir, "plugin.json"));
    })
    .sort()
    .map((slug) => ({
      slug,
      dir: join(paths.pluginsDir, slug),
      manifestPath: join(paths.pluginsDir, slug, "plugin.json"),
    }));
}

export function loadPlugins() {
  return discoverPluginDirs().map((plugin) => ({
    ...plugin,
    manifest: readJson(plugin.manifestPath),
  }));
}

/** Fields copied verbatim from a plugin.json into its marketplace entry. */
const ENTRY_FIELDS = [
  "description",
  "version",
  "author",
  "homepage",
  "repository",
  "license",
  "keywords",
  "category",
  "tags",
  "directory",
];

/**
 * Plugin content lives in its own repository, so the entry source points at
 * that repository rather than a path inside this one.
 */
export function sourceFor(manifest) {
  const match = /^https:\/\/github\.com\/([^/]+\/[^/]+?)(?:\.git)?\/?$/.exec(
    manifest.repository ?? "",
  );
  return match ? { source: "github", repo: match[1] } : manifest.repository;
}

export function buildEntry(plugin) {
  const entry = { name: plugin.manifest.name ?? plugin.slug, source: sourceFor(plugin.manifest) };
  for (const field of ENTRY_FIELDS) {
    if (plugin.manifest[field] !== undefined) entry[field] = plugin.manifest[field];
  }
  return entry;
}

/**
 * Aggregate every plugin manifest into one catalog, preserving the top-level
 * identity from the existing file so the marketplace name stays stable.
 */
export function buildMarketplace(existing) {
  const base = existing ?? {};
  return {
    name: base.name ?? "copilot-marketplace",
    owner: base.owner ?? { name: "Developer Experience" },
    ...(base.metadata ? { metadata: base.metadata } : {}),
    plugins: loadPlugins().map(buildEntry),
  };
}

export function loadExistingMarketplace() {
  return existsSync(paths.marketplaceFile) ? readJson(paths.marketplaceFile) : null;
}

export function serialize(doc) {
  return `${JSON.stringify(doc, null, 2)}\n`;
}
