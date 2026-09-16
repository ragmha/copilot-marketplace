// Aggregate every plugins/<name>/plugin.json into the marketplace catalog.
//
//   bun scripts/generate-marketplace.mjs           Write the catalog
//   bun scripts/generate-marketplace.mjs --check   Verify it is in sync (CI)
import { existsSync, readFileSync } from "node:fs";
import { relative } from "node:path";
import {
  buildMarketplace,
  paths,
  repoRoot,
  serialize,
  writeMarketplace,
} from "./lib/marketplace.mjs";

const rel = (path) => relative(repoRoot, path).replaceAll("\\", "/");
const targets = [paths.marketplaceFile, paths.siteCopy];

function main() {
  const marketplace = buildMarketplace();
  const generated = serialize(marketplace);

  if (process.argv.includes("--check")) {
    // Compare newline-agnostically so a CRLF checkout is not a false failure.
    const normalize = (text) => text.replaceAll("\r\n", "\n");
    const stale = targets.filter(
      (target) =>
        !existsSync(target) || normalize(readFileSync(target, "utf8")) !== normalize(generated),
    );

    if (stale.length > 0) {
      console.error(
        `✗ Out of date: ${stale.map(rel).join(", ")}\n` +
          `  Run "bun run marketplace" and commit the result.`,
      );
      process.exit(1);
    }

    console.log(`✓ ${targets.map(rel).join(" and ")} are in sync with marketplace.config.json and plugins/.`);
    return;
  }

  writeMarketplace(marketplace);

  const count = marketplace.plugins.length;
  console.log(`✓ Wrote ${targets.map(rel).join(" and ")} with ${count} plugin(s).`);
}

try {
  main();
} catch (error) {
  console.error(`Marketplace generation failed: ${error.message}`);
  process.exitCode = 1;
}
