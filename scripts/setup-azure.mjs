import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { loadConfig, repoRoot } from "./lib/config.mjs";
import { azureSetupPlan, configureAzure } from "./lib/azure-setup.mjs";

export const azureSetupHelp = `Set up a public Azure Static Web Apps demo and GitHub Actions CI/CD.

Usage:
  bun run setup:azure
  bun run setup:azure --environment acme-demo --subscription SUBSCRIPTION_ID --location westeurope
  bun run setup:azure --dry-run --environment acme-demo --subscription SUBSCRIPTION_ID --location westeurope

Options:
  --environment NAME    azd environment; 3-24 lowercase letters, numbers, hyphens
  --subscription ID     Customer-selected Azure subscription UUID
  --location REGION     Azure region, for example westeurope
  --dry-run             Print the plan without any external commands or changes
  --help                Show this help

Prerequisites: a configured, committed, pushed default branch; Git, Node.js, Bun,
azd, and GitHub CLI. Sign in with "azd auth login" and "gh auth login".
GitHub admin permission and Azure provisioning/role-assignment permission are required.

The wizard requires typed approval before changes. It creates a Free public
Static Web App, a resource-scoped identity, and a default-branch-only GitHub
environment. It preserves reviewers, never commits/pushes, and never stores an
Azure client secret. Existing token-based deployments remain supported.
This is not an internal-site authentication setup. See docs/azure-setup.md.
`;

export function parseAzureArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    const key = { "--environment": "environment", "--subscription": "subscription", "--location": "location", "--dry-run": "dryRun", "--help": "help" }[argument];
    if (!key) throw new Error(`Unknown option "${argument}". Run "bun run setup:azure --help".`);
    if (Object.hasOwn(options, key)) throw new Error(`Duplicate option ${argument}.`);
    if (key === "dryRun" || key === "help") options[key] = true;
    else {
      const value = args[++index];
      if (!value || value.startsWith("--") || value !== value.trim()) throw new Error(`Provide a value for ${argument}.`);
      options[key] = value;
    }
  }
  return options;
}

export function parseGitHubResponse(result, optional = false) {
  const match = /^HTTP\/\S+\s+(\d{3})[^\r\n]*\r?\n[\s\S]*?\r?\n\r?\n([\s\S]*)$/.exec(result.stdout ?? "");
  if (optional && Number(match?.[1]) === 404) return null;
  if (result.error || result.status !== 0 || !match || Number(match[1]) >= 300) {
    throw new Error(`GitHub request failed: ${result.error?.message ?? result.stderr ?? ""}`.trim());
  }
  if (!match[2].trim()) return {};
  try {
    return JSON.parse(match[2]);
  } catch (error) {
    throw new Error("GitHub returned an invalid JSON response.", { cause: error });
  }
}

export function azureDriver(rootDir, readline) {
  const environment = { ...process.env, GH_PROMPT_DISABLED: "1", AZURE_CORE_COLLECT_TELEMETRY: "no" };
  // These non-secret azd values belong to the selected environment, never an inherited shell.
  for (const key of ["AZURE_ENV_NAME", "AZURE_SUBSCRIPTION_ID", "AZURE_LOCATION", "AZURE_GITHUB_REPOSITORY", "AZURE_PUBLICATION"]) {
    delete environment[key];
  }
  const invoke = (command, args, options = {}) => spawnSync(command, args, {
    cwd: rootDir,
    env: environment,
    encoding: "utf8",
    stdio: options.inherit ? "inherit" : "pipe",
    input: options.input,
    timeout: command === "azd" && args.includes("provision") ? 30 * 60_000 : 120_000,
    maxBuffer: 8 * 1024 * 1024,
    windowsHide: true,
    shell: false,
  });
  return {
    run(command, args, options = {}) {
      const result = invoke(command, args, options);
      if (result.error || result.status !== 0) {
        throw new Error(`${command} ${args.join(" ")} failed: ${result.error?.message ?? result.stderr ?? `exit ${result.status}`}`);
      }
      return result.stdout ?? "";
    },
    api(method, path, body, optional = false) {
      const args = ["api", path, "--hostname", "github.com", "--method", method, "--include",
        "-H", "Accept: application/vnd.github+json", "-H", "X-GitHub-Api-Version: 2022-11-28"];
      if (body !== undefined) args.push("--input", "-");
      return parseGitHubResponse(invoke("gh", args, { input: body === undefined ? undefined : JSON.stringify(body) }), optional);
    },
    hasLocalEnvironment: (name) => existsSync(join(rootDir, ".azure", name)),
    log: (message) => console.log(message),
    async confirm(question, phrase) {
      return (await readline.question(`\n${question}\nType "${phrase}" to approve, or press Enter to stop: `)) === phrase;
    },
  };
}

async function main() {
  const options = parseAzureArgs(process.argv.slice(2));
  if (options.help) { console.log(azureSetupHelp); return; }
  const config = loadConfig();
  const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
  if (!options.dryRun && !interactive) {
    throw new Error("Run the Azure wizard in an interactive terminal. Automation can use --dry-run; changes require typed approval.");
  }
  const readline = interactive ? createInterface({ input: process.stdin, output: process.stdout }) : null;
  try {
    for (const [key, label] of [
      ["environment", "Environment name (for example acme-demo)"],
      ["subscription", "Azure subscription ID"],
      ["location", "Azure region (for example westeurope)"],
    ]) {
      if (!options[key] && readline && !options.dryRun) options[key] = (await readline.question(`${label}: `)).trim();
    }
    const plan = azureSetupPlan(config, options);
    if (!plan.dryRun) {
      for (const path of ["azure.yaml", "infra/main.bicep", ".github/workflows/azure-static-web-apps.yml"]) {
        if (!existsSync(join(repoRoot, ...path.split("/")))) throw new Error(`Required setup file is missing: ${path}`);
      }
    }
    const result = await configureAzure(plan, azureDriver(repoRoot, readline));
    if (result.status === "cancelled") console.log("Cancelled. No setup changes were made.");
  } finally {
    readline?.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(`Azure setup failed: ${error.message}`);
    process.exitCode = 1;
  });
}
