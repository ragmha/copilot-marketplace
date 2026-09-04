// Refuse installs from anything other than Bun.
// Runs as `preinstall`, so npm/yarn/pnpm fail before they write a lockfile.
const agent = process.env.npm_config_user_agent ?? "";

if (!agent.startsWith("bun")) {
  const tool = agent.split("/")[0] || "this package manager";
  console.error(
    `\n✗ This repository uses Bun. Refusing to install with ${tool}.\n\n` +
      `  curl -fsSL https://bun.sh/install | bash   # macOS / Linux\n` +
      `  powershell -c "irm bun.sh/install.ps1|iex" # Windows\n\n` +
      `  Then run: bun install\n`,
  );
  process.exit(1);
}
