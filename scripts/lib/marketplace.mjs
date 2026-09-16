// Shared helpers for the marketplace tooling (validation + generation).
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { loadConfig, readJson, repoRoot, validateConfig } from "./config.mjs";

export { readJson, repoRoot } from "./config.mjs";

export function pathsFor(rootDir = repoRoot) {
  return {
    configFile: join(rootDir, "marketplace.config.json"),
    pluginSchema: join(rootDir, "schemas", "plugin.schema.json"),
    marketplaceSchema: join(rootDir, "schemas", "marketplace.schema.json"),
    pluginsDir: join(rootDir, "plugins"),
    // The canonical catalog Copilot clients read from the repository.
    marketplaceFile: join(rootDir, ".github", "plugin", "marketplace.json"),
    // The same document, served by the site so it also has a public URL.
    siteCopy: join(rootDir, "public", "marketplace.json"),
  };
}

export const paths = pathsFor();

/** Discover every `plugins/<name>/plugin.json`. */
export function discoverPluginDirs(rootDir = repoRoot) {
  const { pluginsDir } = pathsFor(rootDir);
  if (!existsSync(pluginsDir)) return [];

  return readdirSync(pluginsDir)
    .filter((entry) => {
      const dir = join(pluginsDir, entry);
      return statSync(dir).isDirectory() && existsSync(join(dir, "plugin.json"));
    })
    .sort()
    .map((slug) => ({
      slug,
      dir: join(pluginsDir, slug),
      manifestPath: join(pluginsDir, slug, "plugin.json"),
    }));
}

export function loadPlugins(rootDir = repoRoot) {
  return discoverPluginDirs(rootDir).map((plugin) => ({
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
  if (manifest.source) return { ...manifest.source };
  const match = /^https:\/\/github\.com\/([^/]+\/[^/]+?)(?:\.git)?\/?$/.exec(
    manifest.repository ?? "",
  );
  return match ? { source: "github", repo: match[1] } : manifest.repository;
}

export function componentIssues(manifest) {
  const components = manifest.directory?.components;
  if (!components) return [];
  const errors = [];
  const keys = { skill: "skills", agent: "agents", hook: "hooks", "mcp-server": "mcpServers" };
  const source = sourceFor(manifest);
  if (typeof source !== "object" || source.source !== "github") {
    errors.push("Component inventories require a GitHub source.");
  }
  const seen = new Set();
  for (const component of components) {
    const key = `${component.kind}:${component.name}`;
    if (seen.has(key)) errors.push(`Duplicate component ${key}.`);
    seen.add(key);
  }
  for (const [kind, key] of Object.entries(keys)) {
    const actual = components.filter((component) => component.kind === kind).length;
    if (actual !== (manifest.directory.contains?.[key] ?? 0)) {
      errors.push(`directory.contains.${key} does not match the ${actual} listed ${kind} component(s).`);
    }
  }
  return errors;
}

export function buildEntry(plugin) {
  const entry = { name: plugin.manifest.name ?? plugin.slug, source: sourceFor(plugin.manifest) };
  for (const field of ENTRY_FIELDS) {
    if (plugin.manifest[field] !== undefined) entry[field] = plugin.manifest[field];
  }
  return entry;
}

/**
 * Identity belongs to source configuration, never the generated catalog.
 * Plugin repositories remain independent of the marketplace's organization.
 */
export function buildMarketplace(config, rootDir = repoRoot) {
  const identity = config === undefined ? loadConfig(rootDir) : validateConfig(config, rootDir);
  return {
    name: identity.name,
    owner: { ...identity.owner },
    metadata: {
      description: identity.branding.description,
      version: identity.version,
      repository: `https://github.com/${identity.repository}`,
    },
    plugins: loadPlugins(rootDir).map(buildEntry),
  };
}

export function loadExistingMarketplace(rootDir = repoRoot) {
  const { marketplaceFile } = pathsFor(rootDir);
  return existsSync(marketplaceFile) ? readJson(marketplaceFile) : null;
}

/** Write one prepared catalog identically to both consumers. */
export function writeMarketplace(marketplace, rootDir = repoRoot) {
  const { marketplaceFile, siteCopy } = pathsFor(rootDir);
  const generated = serialize(marketplace);
  for (const target of [marketplaceFile, siteCopy]) {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, generated);
  }
}

export function serialize(doc) {
  return `${JSON.stringify(doc, null, 2)}\n`;
}
