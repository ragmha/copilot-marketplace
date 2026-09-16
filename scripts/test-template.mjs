import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = mkdtempSync(join(realpathSync.native(tmpdir()), "copilot-marketplace-e2e-"));
console.log(`Template fixtures: ${fixtures}`);
try {
  const result = spawnSync(process.execPath, [
    join(root, "node_modules", "@playwright", "test", "cli.js"), "test", ...process.argv.slice(2),
  ], {
    cwd: root,
    env: { ...process.env, TEMPLATE_FIXTURES_DIR: fixtures },
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  // Playwright force-stops web servers on Windows, so cleanup belongs to their parent.
  rmSync(fixtures, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}
