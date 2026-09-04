# VS Code setup

## 1. Enable plugins

Plugins are behind a setting. In `settings.json`:

```json
{
  "chat.plugins.enabled": true
}
```

## 2. Add the marketplace

```json
{
  "chat.plugins.enabled": true,
  "chat.plugins.marketplaces": {
    "copilot-marketplace": {
      "source": "github",
      "repo": "your-org/copilot-marketplace"
    }
  }
}
```

## 3. Browse and install

Open the Chat view → the cog icon → **Agent Customizations** → **Plugins**.
Pick the marketplace, then install what you want.

Installed plugins show up in the Extensions view under
**Agent Plugins - Installed**.

## Sharing with a team

Commit `.github/copilot/settings.json` in the repository so everyone who opens
it gets the same marketplace and plugins:

```json
{
  "extraKnownMarketplaces": {
    "copilot-marketplace": {
      "source": "github",
      "repo": "your-org/copilot-marketplace"
    }
  },
  "enabledPlugins": {
    "review-companion@copilot-marketplace": true
  }
}
```

`enabledPlugins` is an object map keyed by `<plugin>@<marketplace>`, not an
array.

To push plugins to a whole organisation instead, see
[setup-org-enterprise.md](setup-org-enterprise.md).
