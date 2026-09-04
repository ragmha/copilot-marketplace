// Validate every plugin.json and the generated catalog against the schemas,
// plus repo-level cross-checks that a schema alone cannot express.
//
// Usage: node scripts/validate.mjs
import { relative } from "node:path";
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  loadExistingMarketplace,
  loadPlugins,
  paths,
  readJson,
  repoRoot,
} from "./lib/marketplace.mjs";

const rel = (path) => relative(repoRoot, path).replaceAll("\\", "/");

function formatErrors(errors) {
  return (errors ?? [])
    .map((error) => `    - ${error.instancePath || "(root)"} ${error.message}`)
    .join("\n");
}

function main() {
  const ajv = new Ajv({ allErrors: true, allowUnionTypes: true, strict: false });
  addFormats(ajv);

  const validatePlugin = ajv.compile(readJson(paths.pluginSchema));
  const validateMarketplace = ajv.compile(readJson(paths.marketplaceSchema));

  const errors = [];
  const plugins = loadPlugins();

  if (plugins.length === 0) {
    errors.push("✗ No plugins found under plugins/. Add at least one plugin.json.");
  }

  const seen = new Map();

  for (const plugin of plugins) {
    if (!validatePlugin(plugin.manifest)) {
      errors.push(
        `✗ ${rel(plugin.manifestPath)} failed schema validation:\n${formatErrors(validatePlugin.errors)}`,
      );
    }

    // The directory name is what consumers install by, so it has to match.
    if (plugin.manifest.name && plugin.manifest.name !== plugin.slug) {
      errors.push(
        `✗ ${rel(plugin.manifestPath)}: name "${plugin.manifest.name}" does not match directory "${plugin.slug}".`,
      );
    }

    const name = plugin.manifest.name ?? plugin.slug;
    if (seen.has(name)) {
      errors.push(`✗ Duplicate plugin name "${name}" in ${plugin.slug} and ${seen.get(name)}.`);
    } else {
      seen.set(name, plugin.slug);
    }
  }

  const marketplace = loadExistingMarketplace();

  if (!marketplace) {
    errors.push(`✗ Missing ${rel(paths.marketplaceFile)}. Run "npm run marketplace".`);
  } else {
    if (!validateMarketplace(marketplace)) {
      errors.push(
        `✗ ${rel(paths.marketplaceFile)} failed schema validation:\n${formatErrors(validateMarketplace.errors)}`,
      );
    }

    const entryNames = new Set(marketplace.plugins?.map((entry) => entry.name));

    for (const name of seen.keys()) {
      if (!entryNames.has(name)) {
        errors.push(`✗ Plugin "${name}" is missing from the catalog. Run "npm run marketplace".`);
      }
    }

    for (const name of entryNames) {
      if (!seen.has(name)) {
        errors.push(`✗ Catalog entry "${name}" has no plugins/${name}/plugin.json.`);
      }
    }
  }

  if (errors.length > 0) {
    console.error(`\nValidation failed with ${errors.length} error(s):\n`);
    console.error(`${errors.join("\n\n")}\n`);
    process.exit(1);
  }

  console.log(`✓ ${plugins.length} plugin(s) and the catalog conform to the schemas.`);
}

main();
