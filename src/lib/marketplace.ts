export type PluginType =
  | "plugin"
  | "skill"
  | "agent"
  | "prompt"
  | "hook"
  | "mcp-server"
  | "extension";

/** Counts of the artifacts bundled inside a plugin. */
export type Contains = {
  skills?: number;
  agents?: number;
  hooks?: number;
  mcpServers?: number;
};

export type Plugin = {
  name: string;
  description: string;
  version: string;
  type: PluginType;
  category: string;
  author: string;
  featured: boolean;
  updated: string;
  contains?: Contains;
  repository: string;
};

/** One entry exactly as it appears in the generated `marketplace.json`. */
export type CatalogEntry = {
  name: string;
  source: string | { source: string; repo: string };
  description: string;
  version: string;
  author: { name: string };
  repository: string;
  category: string;
  directory: {
    type: PluginType;
    featured?: boolean;
    updated: string;
    contains?: Contains;
  };
};

export type Marketplace = {
  name: string;
  owner: { name: string; email?: string };
  metadata: { description: string; version: string; repository: string };
  plugins: CatalogEntry[];
};

/**
 * Flatten the catalog for rendering. The file on disk keeps the official
 * shape plus a `directory` extension; the UI wants one flat object.
 */
export function normalize(catalog: Marketplace): Plugin[] {
  return catalog.plugins.map((entry) => ({
    name: entry.name,
    description: entry.description,
    version: entry.version,
    type: entry.directory.type,
    category: entry.category,
    author: entry.author.name,
    featured: entry.directory.featured ?? false,
    updated: entry.directory.updated,
    contains: entry.directory.contains,
    repository: entry.repository,
  }));
}

/** Tab order for the directory. Types with no entries still render, at zero. */
export const pluginTypes: { type: PluginType; label: string }[] = [
  { type: "plugin", label: "Plugins" },
  { type: "skill", label: "Skills" },
  { type: "agent", label: "Agents" },
  { type: "prompt", label: "Prompts" },
  { type: "hook", label: "Hooks" },
  { type: "mcp-server", label: "MCP Servers" },
  { type: "extension", label: "Extensions" },
];

/** Plural tab label for a type, used in breadcrumbs and section headings. */
export function typeLabel(type: PluginType): string {
  return pluginTypes.find((entry) => entry.type === type)?.label ?? "Plugins";
}

/** Short chip label for a type, used on cards and rows. */
export const typeChip: Record<PluginType, string> = {
  plugin: "Plugin",
  skill: "Skill",
  agent: "Agent",
  prompt: "Prompt",
  hook: "Hook",
  "mcp-server": "MCP",
  extension: "Extension",
};

/** What each category is for, shown under the collection heading. */
export const categoryBlurbs: Record<string, string> = {
  Delivery: "Plan the release, write the notes, and ship with confidence.",
  "Code quality": "Catch problems in review before they reach production.",
  Onboarding: "Find your way around an unfamiliar codebase, fast.",
  Operations: "Handle incidents, watch the system, and write it up afterwards.",
};

export type PluginArt = { gradient: string; monogram: string };

/**
 * Deterministic cover art. The catalog carries no images, so identity comes
 * from the name itself: a stable gradient off the chart tokens plus a monogram.
 */
export function pluginArt(name: string): PluginArt {
  let hash = 0;
  for (const character of name) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  const first = (hash % 5) + 1;
  const offset = ((hash >> 3) % 4) + 1;
  const second = ((first - 1 + offset) % 5) + 1;
  const angle = 120 + (hash % 6) * 20;

  const monogram = name
    .split("-")
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();

  return {
    gradient: `linear-gradient(${angle}deg, var(--chart-${first}), var(--chart-${second}))`,
    monogram,
  };
}

/**
 * Detail-page URL. Built from `BASE_URL` so links keep working when the site is
 * served from a repository subpath on GitHub Pages.
 */
export function pluginHref(name: string): string {
  return `${import.meta.env.BASE_URL.replace(/\/$/, "")}/plugins/${name}/`;
}

const containsLabels: { key: keyof Contains; singular: string; plural: string }[] = [
  { key: "skills", singular: "skill", plural: "skills" },
  { key: "agents", singular: "agent", plural: "agents" },
  { key: "hooks", singular: "hook", plural: "hooks" },
  { key: "mcpServers", singular: "MCP server", plural: "MCP servers" },
];

/** "1 skill", "2 MCP servers" — the composition chips shown on a card. */
export function describeContents(contains?: Contains): string[] {
  if (!contains) return [];
  return containsLabels.flatMap(({ key, singular, plural }) => {
    const count = contains[key];
    if (!count) return [];
    return [`${count} ${count === 1 ? singular : plural}`];
  });
}

const DAY_MS = 86_400_000;

/**
 * Relative age of an update, resolved at build time. The site is static, so
 * this is only as fresh as the last deploy — the exact date stays in the
 * `title` attribute for anyone who needs it.
 */
export function describeUpdated(date: string, now = new Date()): string {
  const days = Math.floor((now.getTime() - new Date(date).getTime()) / DAY_MS);
  if (days <= 0) return "Updated today";
  if (days === 1) return "Updated yesterday";
  if (days < 7) return `Updated ${days} days ago`;
  if (days < 14) return "Updated last week";
  if (days < 60) return `Updated ${Math.floor(days / 7)} weeks ago`;
  return `Updated ${Math.floor(days / 30)} months ago`;
}

/** Repository that hosts this marketplace's `marketplace.json`. */
export const marketplaceRepo = "your-org/copilot-marketplace";
export const marketplaceKey = "copilot-marketplace";
const samplePlugin = "release-captain";

// `copilot plugin marketplace add` takes OWNER/REPO for GitHub.com repositories,
// not a full URL.
export const cliCommand = `copilot plugin marketplace add ${marketplaceRepo}`;

export const appSettings = JSON.stringify(
  {
    extraKnownMarketplaces: {
      [marketplaceKey]: { source: { source: "github", repo: marketplaceRepo } },
    },
  },
  null,
  2,
);

const projectSettingsFor = (plugin: string) =>
  JSON.stringify(
    {
      extraKnownMarketplaces: {
        [marketplaceKey]: { source: { source: "github", repo: marketplaceRepo } },
      },
      enabledPlugins: { [`${plugin}@${marketplaceKey}`]: true },
    },
    null,
    2,
  );

export const cloudSettings = projectSettingsFor(samplePlugin);

/** The CLI one-liner that installs a specific plugin from this marketplace. */
export function installCommand(name: string): string {
  return `copilot plugin install ${name}@${marketplaceKey}`;
}

export type InstallStep = { text: string; code?: string; caption?: string };
export type InstallGuide = {
  id: string;
  label: string;
  summary: string;
  steps: InstallStep[];
};

/**
 * Install steps for one specific plugin. Every snippet names the plugin, so the
 * guide is only ever rendered on a plugin's own page.
 */
export function installGuidesFor(plugin: string): InstallGuide[] {
  const projectSettings = projectSettingsFor(plugin);
  const qualified = `${plugin}@${marketplaceKey}`;

  return [
    {
      id: "vscode",
      label: "VS Code",
      summary: "Plugin support is behind a setting, then plugins install from the Chat view.",
      steps: [
        {
          text: "Turn on plugin support in your user settings.json.",
          code: JSON.stringify({ "chat.plugins.enabled": true }, null, 2),
        },
        {
          text: `Add the marketplace and enable ${plugin} in the repository's .github/copilot/settings.json, then commit it so the whole team gets it.`,
          code: projectSettings,
        },
        {
          text: "Open the Chat view, select the cog, then Agent Customizations, then Plugins to browse and install.",
          caption:
            "Installed plugins appear under Agent Plugins - Installed in the Extensions view.",
        },
      ],
    },
    {
      id: "cli",
      label: "Copilot CLI",
      summary: "Register the marketplace once, then install this plugin by name.",
      steps: [
        { text: "Add the marketplace.", code: cliCommand },
        { text: `Install ${plugin}.`, code: `copilot plugin install ${qualified}` },
        {
          text: "Confirm it is installed.",
          code: "copilot plugin list",
          caption: `Inside an interactive session, use /plugin install ${qualified}.`,
        },
      ],
    },
    {
      id: "app",
      label: "Copilot App",
      summary: "Browse and install from the app, or commit the settings for everyone.",
      steps: [
        { text: "Click Customize, then Plugins." },
        {
          text: `Add this marketplace by its repository, ${marketplaceRepo}, then install ${plugin} from the list.`,
        },
        {
          text: "To skip the UI, add the marketplace to your settings instead.",
          code: appSettings,
        },
      ],
    },
    {
      id: "cloud",
      label: "Copilot Cloud Agent",
      summary: "Configuration only — the cloud agent installs plugins declaratively.",
      steps: [
        {
          text: "Commit .github/copilot/settings.json to the repository the agent works in.",
          code: projectSettings,
        },
        {
          text: `The agent picks ${plugin} up on its next run. There is nothing to install by hand.`,
          caption:
            "Enterprise administrators can push marketplaces and plugins to everyone through enterprise-managed plugin standards.",
        },
      ],
    },
    {
      id: "m365",
      label: "M365 Copilot",
      summary:
        "A different packaging model: Microsoft 365 uses agents uploaded as a ZIP, not GitHub plugins.",
      steps: [
        {
          text: "Export the agent as a ZIP. In Copilot Studio, open Agents, pick your agent, then Channels, then Teams and Microsoft Copilot, then Availability options, then Download .zip.",
          caption:
            "The ZIP carries the manifest, configuration, icons, branding, and any embedded knowledge files.",
        },
        {
          text: "Open the Microsoft 365 admin center, then Agents, then Upload custom agent.",
          code: "https://admin.microsoft.com/",
        },
        { text: "Choose the ZIP file and let it validate." },
        { text: "Verify the agent's name, icon, and host products, then continue." },
        {
          text: "Assign users, then continue.",
          caption: "Start with Just me or one test group before opening it up.",
        },
        { text: "Review the agent's permissions and capabilities, then Finish deployment." },
      ],
    },
  ];
}
