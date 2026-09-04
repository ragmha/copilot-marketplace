export type Plugin = {
  name: string;
  description: string;
  version: string;
  category: string;
  author: string;
  icon: string;
  featured: boolean;
  repository: string;
};

export type Marketplace = {
  name: string;
  owner: { name: string; email: string };
  metadata: { description: string; version: string; repository: string };
  plugins: Plugin[];
};

/** Repository that hosts this marketplace's `marketplace.json`. */
export const marketplaceRepo = "your-org/copilot-marketplace";
export const marketplaceKey = "copilot-marketplace";

export const cliCommand = `copilot plugin marketplace add https://github.com/${marketplaceRepo}`;

export const appSettings = JSON.stringify(
  {
    extraKnownMarketplaces: {
      [marketplaceKey]: { source: { source: "github", repo: marketplaceRepo } },
    },
  },
  null,
  2,
);

export const cloudSettings = JSON.stringify(
  {
    enabledPlugins: [
      `release-captain@${marketplaceKey}`,
      `review-companion@${marketplaceKey}`,
    ],
    extraKnownMarketplaces: [marketplaceKey],
  },
  null,
  2,
);
