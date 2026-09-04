# Rolling the marketplace out across an organisation

Two ways to get this marketplace in front of people: let them add it themselves,
or push it centrally so it is already there when they open Copilot.

## Prerequisites

- The marketplace repository is **internal** (or public) so everyone in the
  organisation can read it.
- `.github/plugin/marketplace.json` is committed on the default branch.
- Copilot plugins are enabled for the organisation in Copilot policy settings.

## Option A — people add it themselves

Copilot CLI:

```sh
copilot plugin marketplace add your-org/copilot-marketplace
copilot plugin marketplace browse copilot-marketplace
copilot plugin install release-captain@copilot-marketplace
```

VS Code needs `"chat.plugins.enabled": true`, then the marketplace can be added
through `chat.plugins.marketplaces`. See [setup-vscode.md](setup-vscode.md).

## Option B — push it centrally (recommended)

Create or open the organisation's **`.github-private`** repository and add
`copilot/managed-settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "copilot-marketplace": {
      "source": "github",
      "repo": "your-org/copilot-marketplace"
    }
  },
  "enabledPlugins": {
    "release-captain@copilot-marketplace": true,
    "review-companion@copilot-marketplace": true
  }
}
```

What this does:

- The marketplace appears for everyone in the organisation with no action on
  their part.
- Anything in `enabledPlugins` is installed and enabled automatically.
- Members **cannot** disable or remove centrally enabled plugins.

Consequences worth planning for:

- **The marketplace name is a contract.** `enabledPlugins` keys are
  `<plugin>@<marketplace>`. Renaming the marketplace breaks every entry.
- Start with a small, uncontroversial set. Every addition lands on every
  developer at once.
- Removing a plugin from `enabledPlugins` does not uninstall it from machines
  that already have it; tell people to run `copilot plugin uninstall`.

## Per-repository defaults

For plugins that only make sense in one repository, commit
`.github/copilot/settings.json` there instead:

```json
{
  "extraKnownMarketplaces": {
    "copilot-marketplace": {
      "source": "github",
      "repo": "your-org/copilot-marketplace"
    }
  },
  "enabledPlugins": {
    "api-contract-check@copilot-marketplace": true
  }
}
```

This is also the only way to give the **Copilot cloud agent** plugins, since it
has no interactive install step.

Note that `enabledPlugins` is an **object map**, not an array.

## Keeping the site internal

The site deploys to GitHub Pages from `.github/workflows/pages.yml`. On GitHub
Enterprise Cloud you can restrict Pages visibility to organisation members:

**Repository → Settings → Pages → Visibility → Private.**

This requires GitHub Enterprise Cloud; on other plans a Pages site for an
internal repository is still publicly reachable, so treat the catalog contents
accordingly and keep anything sensitive out of plugin descriptions.

## Review and governance

- Plugin submissions arrive as issues or pull requests; CI validates them.
- Require review from a CODEOWNERS team before merge.
- Because plugins execute in developers' environments, treat every submission as
  a supply-chain review: check the linked repository, not just the manifest.
