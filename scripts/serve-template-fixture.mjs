import { cpSync, existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const hosts = {
  root: { port: "4541", base: "/" },
  pages: { port: "4542", base: "/acme-marketplace/" },
};
const host = hosts[process.argv[2]];
if (!host) throw new Error("Choose the root or pages template fixture.");
// Astro's asset bookkeeping needs canonical paths, not Windows 8.3 temp aliases.
const fixture = process.env.TEMPLATE_FIXTURES_DIR
  ? join(realpathSync.native(process.env.TEMPLATE_FIXTURES_DIR), process.argv[2])
  : mkdtempSync(join(realpathSync.native(tmpdir()), `copilot-acme-${process.argv[2]}-`));
if (process.env.TEMPLATE_FIXTURES_DIR) mkdirSync(fixture);
const env = { ...process.env, BASE_PATH: host.base, PUBLIC_MARKETPLACE_REPO: "" };
let server;
let cleaned = false;
const cleanup = () => {
  if (cleaned) return;
  cleaned = true;
  rmSync(fixture, { recursive: true, force: true });
};
process.on("exit", cleanup);

try {
  for (const path of ["src", "public", "scripts", "schemas", "patches", "astro.config.mjs", "tsconfig.json", "package.json", "marketplace.config.json"]) {
    cpSync(join(root, path), join(fixture, path), { recursive: true });
  }
  symlinkSync(join(root, "node_modules"), join(fixture, "node_modules"), process.platform === "win32" ? "junction" : "dir");
  mkdirSync(join(fixture, "public", "branding"), { recursive: true });
  for (const name of ["acme.svg", "acme-dark.svg"]) {
    cpSync(join(root, "tests", "fixtures", "acme", name), join(fixture, "public", "branding", name));
  }
  cpSync(join(root, "tests", "fixtures", "acme", "plugins"), join(fixture, "plugins"), { recursive: true });

  const run = (args) => {
    const result = spawnSync("bun", args, { cwd: fixture, env, encoding: "utf8", timeout: 120_000 });
    if (result.error || result.status !== 0) {
      throw new Error(`Fixture command failed: bun ${args.join(" ")}\n${result.error?.message ?? ""}\n${result.stdout}\n${result.stderr}`);
    }
  };
  run(["run", "setup", "--organization", "Acme", "--repository", "acme/copilot-marketplace",
    "--name", "acme-tools", "--title", "Acme Marketplace", "--logo", "branding/acme.svg",
    "--logo-dark", "branding/acme-dark.svg", "--force"]);
  run(["run", "validate"]);
  run(["run", "marketplace:check"]);
  run(["run", "build"]);
  if (!existsSync(join(fixture, "dist", "index.html"))) throw new Error("Acme fixture did not produce a static site.");
  console.log(`Acme ${process.argv[2]} fixture: ${fixture}`);
  server = spawn("bun", ["run", "preview", "--host", "127.0.0.1", "--port", host.port], { cwd: fixture, env, stdio: "inherit" });
  server.on("error", (error) => { console.error(error); process.exitCode = 1; });
  server.on("exit", (code) => { process.exitCode = code ?? 0; });
  process.on("SIGTERM", () => server.kill("SIGTERM"));
  process.on("SIGINT", () => server.kill("SIGINT"));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
