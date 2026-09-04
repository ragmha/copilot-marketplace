# Copilot Marketplace

An internal GitHub Copilot plugin marketplace, built with [Astro](https://astro.build) and
[Tailwind CSS v4](https://tailwindcss.com) using shadcn theme tokens, with light and dark mode.

## Develop

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # static output in dist/
npm run preview  # serve the production build
```

## How it fits together

| Path                      | Purpose                                                                                             |
| ------------------------- | --------------------------------------------------------------------------------------------------- |
| `public/marketplace.json` | The catalog. Read at build time to render the page, and served as-is for Copilot clients to consume. |
| `src/lib/marketplace.ts`  | Catalog types plus the CLI command and settings snippets shown in the UI.                            |
| `src/styles/global.css`   | shadcn design tokens for light and dark, mapped into Tailwind via `@theme inline`.                   |
| `src/components/`         | Header, hero with the install command, plugin grid, card, footer, theme toggle.                      |

The page is deliberately one screen of chrome: a header, a hero with a single
copyable install command, and one searchable grid of every plugin. There is no
separate featured, learning, or contribute section — a plugin's own repository is
the place for its documentation.

### Theming

The theme uses shadcn's CSS variable convention (`--background`, `--primary`, `--muted-foreground`, …)
defined in `:root` and overridden under `.dark`. Tailwind utilities such as `bg-card` and
`text-muted-foreground` resolve to those variables, so both modes come from one set of tokens.
Type is monospace throughout, so the install command reads as a terminal line rather than a banner.

Dark mode is class-based (`@custom-variant dark`). An inline script in `Layout.astro` applies the
stored or system preference before first paint, so there is no flash of the wrong theme.

### Catalog schema

Each entry in `plugins[]` describes one plugin:

- `name`, `description`, `version`, `author`
- `category`, `featured`, and `icon` for discovery
- `repository`, pointing to the plugin repository that contains a root `plugin.json`

A plugin repository can contain custom agents in `agents/`, skills in `skills/`, hooks, and MCP/LSP
configuration. Keep each plugin independently versioned and reviewable.

## Make it an internal GitHub marketplace

1. Create an organization-owned repository for this site and catalog, and set its visibility to
   **Internal** (or **Private** where internal visibility is unavailable). Restrict write access to
   the marketplace maintainers team, and require pull requests and CODEOWNERS review for catalog
   changes.
2. Create one repository per plugin, with a root `plugin.json` and the relevant `agents/`, `skills/`,
   `hooks.json`, `.mcp.json`, or `lsp.json` files. Apply branch protection and security scanning to
   each plugin repository.
3. Update `marketplaceRepo` in `src/lib/marketplace.ts` and the `repository` URLs in
   `public/marketplace.json` to your organization. Do not put tokens, client secrets, or private API
   credentials in this static site.
4. In **Settings → Pages**, select **GitHub Actions** as the source. `.github/workflows/pages.yml`
   builds the Astro site and publishes `dist/` on pushes to `master`. The workflow passes the Pages
   base path to the build, so the site works from a project page URL.
5. Confirm the Pages visibility policy for your enterprise. A Pages site is not automatically private
   just because its source repository is private; use the enterprise-supported internal/private Pages
   option, or serve the same static artifact behind your approved internal gateway.
6. Register the marketplace with Copilot. In Copilot CLI, run
   `copilot plugin marketplace add <marketplace-url>` (or `/plugin marketplace add`). For the Copilot
   app and cloud agent, use `extraKnownMarketplaces` and `enabledPlugins` in
   `.github/copilot/settings.json`. Enterprise administrators can apply approved plugin standards
   centrally.

The hero's install command copies the Copilot CLI line, with the app and cloud agent settings
available alongside it. Replace the sample organization and plugin names before rolling this out to
users.

## Reference

- [About GitHub Copilot plugins](https://docs.github.com/en/copilot/concepts/agents/about-plugins)
- [Creating a plugin marketplace for GitHub Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/plugins-marketplace)
