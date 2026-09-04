# Copilot Marketplace

A dependency-light, static GitHub Copilot plugin marketplace prototype for internal engineering workflows. It follows the supplied visual direction: a large workflow-focused hero, quick actions, a marketplace install control, CLI copy action, and a featured catalog.

## Run locally

The browser must load `marketplace.json` over HTTP because the app uses `fetch`. From this directory, run any static file server, for example:

```powershell
python -m http.server 8000
```

Open `http://localhost:8000` in a browser.

## Catalog model

`marketplace.json` is the source of truth for the UI and is intentionally compatible with the Copilot plugin marketplace concept. Each plugin entry includes:

- `name`, `description`, `version`, `author`
- `category`, `featured`, and `icon` for discovery
- `repository`, pointing to the plugin repository containing a root `plugin.json`

A plugin repository can contain custom agents in `agents/`, skills in `skills/`, hooks, and MCP/LSP configuration. Keep each plugin independently versioned and reviewable.

## Make it an internal GitHub marketplace

1. Create an organization-owned repository for this site/catalog and set its visibility to **Internal** (or **Private** where internal visibility is unavailable). Restrict write access to the marketplace maintainers team and require pull requests and CODEOWNERS review for catalog changes.
2. Create one repository per plugin, with a root `plugin.json` and the relevant `agents/`, `skills/`, `hooks.json`, `.mcp.json`, or `lsp.json` files. Use repository branch protection and security scanning on each plugin repository.
3. Update `owner`, `metadata.repository`, and each plugin `repository` URL in `marketplace.json` to your enterprise organization. Do not put tokens, client secrets, or private API credentials in this static site.
4. In the repository **Settings → Pages**, select **GitHub Actions** as the source. The included `.github/workflows/pages.yml` publishes the static site on pushes to `master`.
5. In GitHub Enterprise, confirm the Pages visibility policy for your organization. GitHub Pages sites are not automatically private just because the source repository is private; use the enterprise-supported internal/private Pages option or serve the same static artifact behind your approved internal gateway.
6. Register the marketplace with Copilot. In Copilot CLI, use `copilot plugin marketplace add <marketplace-url>` (or the `/plugin marketplace add` command). For cloud agent or repository configuration, use `extraKnownMarketplaces` and `enabledPlugins` in `.github/copilot/settings.json`. Enterprise administrators can apply approved plugin standards centrally.

The UI's install dropdown copies example settings for the Copilot app and cloud agent. Replace the sample organization and plugin names before rolling out to users.

## Source of truth

See [About GitHub Copilot plugins](https://docs.github.com/en/copilot/concepts/agents/about-plugins) and the [Copilot CLI plugin marketplace guide](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/plugins-marketplace) for the current manifest and marketplace fields.