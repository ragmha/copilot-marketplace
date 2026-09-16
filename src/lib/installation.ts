export type InstallStep = { text: string; code?: string; caption?: string };
export type InstallGuide = {
  id: "apm" | "cli" | "vscode";
  label: string;
  badge: string;
  summary: string;
  primary: { code: string; label: string };
  steps: InstallStep[];
  docs: { href: string; label: string };
};

export function createInstallGuides(
  identity: { repository: string; name: string },
  plugin?: string,
): InstallGuide[] {
  const qualified = plugin ? `${plugin}@${identity.name}` : "";
  const cliRegistration = `copilot plugin marketplace add ${identity.repository}`;
  // Explicit name and remote HEAD work with custom catalog keys and main/master.
  const apmRegistration = `apm marketplace add ${identity.repository} --name ${identity.name} --ref HEAD`;
  const settings = JSON.stringify({
    extraKnownMarketplaces: {
      [identity.name]: { source: { source: "github", repo: identity.repository } },
    },
    ...(plugin ? { enabledPlugins: { [qualified]: true } } : {}),
  }, null, 2);

  return [
    {
      id: "apm",
      label: "APM",
      badge: "Package manager",
      summary: plugin
        ? "Install the package through this marketplace and track its dependencies in your project."
        : "Register this marketplace with Agent Package Manager to browse and install project dependencies.",
      primary: {
        code: apmRegistration + (plugin ? `\napm install ${qualified} --target copilot` : `\napm marketplace browse ${identity.name}`),
        label: "Run in your project",
      },
      steps: [
        { text: "Install APM separately and authenticate Git access to any private repositories." },
        { text: "This example uses APM's project-scoped Copilot target. MCP configuration at this scope targets VS Code; use the Copilot CLI tab for native CLI installation." },
        { text: plugin ? "Review and commit your project's apm.yml and apm.lock.yaml." : "Choose a package from the catalog, then open its APM installation instructions." },
      ],
      docs: { href: "https://microsoft.github.io/apm/consumer/installing-from-marketplaces/", label: "APM installation documentation" },
    },
    {
      id: "cli",
      label: "Copilot CLI",
      badge: "Plugin",
      summary: plugin
        ? "Register the marketplace, then install this plugin as a complete bundle in Copilot CLI."
        : "Add the marketplace once, then browse its plugins in Copilot CLI.",
      primary: {
        code: cliRegistration + (plugin ? `\ncopilot plugin install ${qualified}` : `\ncopilot plugin marketplace browse ${identity.name}`),
        label: "Run in your terminal",
      },
      steps: [
        { text: "Install Copilot CLI and sign in with an account that can read the marketplace and plugin repositories." },
        { text: plugin ? "Run copilot plugin list to confirm installation." : "Open an entry to copy its plugin-specific install command." },
        { text: "Review the package's prerequisites and permissions before using its skills, hooks, or MCP servers." },
      ],
      docs: { href: "https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference", label: "Copilot CLI plugin reference" },
    },
    {
      id: "vscode",
      label: "VS Code",
      badge: "Workspace settings",
      summary: plugin
        ? "Make this marketplace and plugin available through your repository's Copilot settings."
        : "Share the marketplace with your project through its Copilot settings.",
      primary: { code: settings, label: "Merge into .github/copilot/settings.json" },
      steps: [
        { text: "Enable plugin support in your VS Code user settings.json.", code: '{\n  "chat.plugins.enabled": true\n}' },
        { text: "Merge the configuration above with existing repository settings; do not overwrite unrelated entries." },
        { text: "Open the Chat view, then Agent Customizations and Plugins to review the available packages." },
      ],
      docs: { href: "https://code.visualstudio.com/docs/copilot/customization/agent-plugins", label: "VS Code plugin documentation" },
    },
  ];
}
