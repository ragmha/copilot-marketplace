// Aggregate every plugins/<name>/plugin.json into the marketplace catalog.
//
//   node scripts/generate-marketplace.mjs           Write the catalog
//   node scripts/generate-marketplace.mjs --check   Verify it is in sync (CI)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative } from "node:path";
import {
  buildMarketplace,
  loadExistingMarketplace,
  paths,
  repoRoot,
  serialize,
} from "./lib/marketplace.mjs";

const rel = (path) => relative(repoRoot, path).replaceAll("\\", "/");
const targets = [paths.marketplaceFile, paths.siteCopy];

function main() {
  const generated = serialize(buildMarketplace(loadExistingMarketplace()));

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
          `  Run "npm run marketplace" and commit the result.`,
      );
      process.exit(1);
    }

    console.log(`✓ ${targets.map(rel).join(" and ")} are in sync with plugins/.`);
    return;
  }

  for (const target of targets) {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, generated);
  }

  const count = JSON.parse(generated).plugins.length;
  console.log(`✓ Wrote ${targets.map(rel).join(" and ")} with ${count} plugin(s).`);
}

main();
