import configJson from "../../marketplace.config.json";
import { createInstallGuides, type InstallGuide } from "./installation";
import { parseRepositoryUrl } from "./repository-url.mjs";
export type { InstallGuide, InstallStep } from "./installation";

export type Branding = {
  organization: string;
  title: string;
  description: string;
  logo?: string;
  logoDark?: string;
};

export type SiteConfig = {
  name: string;
  repository: string;
  version: string;
  owner: { name: string; email?: string };
  branding: Branding;
};

const config: SiteConfig = configJson;
export const branding: Branding = config.branding;

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

export type GitHubSource = {
  source: "github";
  repo: string;
  path?: string;
  ref?: string;
  sha?: string;
};
export type PluginComponent = {
  name: string;
  kind: "skill" | "agent" | "hook" | "mcp-server";
  path: string;
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
  source?: string | GitHubSource;
  components?: PluginComponent[];
  notes?: string[];
};

/** One entry exactly as it appears in the generated `marketplace.json`. */
export type CatalogEntry = {
  name: string;
  source: string | GitHubSource;
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
    components?: PluginComponent[];
    notes?: string[];
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
    source: entry.source,
    components: entry.directory.components,
    notes: entry.directory.notes,
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
  "Microsoft Fabric": "Build and operate data engineering, analytics, and Power BI workflows.",
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
  const offset = ((hash >>> 3) % 4) + 1;
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
  return `${marketplaceHome}plugins/${name}/`;
}

export const marketplaceHome = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/`;
export const pluginGuideHref = `${marketplaceHome}learn/plugins/`;
export const submissionHref = `${marketplaceHome}submit/`;

export function pluginSourceHref(plugin: Plugin, component?: PluginComponent): string {
  parseRepositoryUrl(plugin.repository);
  const source = plugin.source;
  if (!source || typeof source === "string") return plugin.repository;
  if (!source.path && !source.sha && !source.ref && !component) return plugin.repository;
  const path = [source.path, component?.path].filter(Boolean).join("/");
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `https://github.com/${source.repo}/${component ? "blob" : "tree"}/${encodeURIComponent(source.sha ?? source.ref ?? "HEAD")}/${encoded}`;
}

/** Config validation ensures this is a public-relative local asset path. */
export function brandLogoHref(path: string): string {
  return `${marketplaceHome}${path}`;
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
export const marketplaceRepo = import.meta.env.PUBLIC_MARKETPLACE_REPO || config.repository;
if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(marketplaceRepo)) {
  throw new Error("PUBLIC_MARKETPLACE_REPO must be a GitHub owner/repository, not a URL.");
}
export const marketplaceKey = config.name;
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

export function installGuidesFor(plugin?: string): InstallGuide[] {
  return createInstallGuides({ repository: marketplaceRepo, name: marketplaceKey }, plugin);
}
