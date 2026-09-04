# Copilot Marketplace

An internal GitHub Copilot plugin marketplace: a validated catalog of plugins
plus an [Astro](https://astro.build) site that renders it, styled with
[Tailwind CSS v4](https://tailwindcss.com) and shadcn theme tokens in light and
dark mode.

Plugin *content* lives in each plugin's own repository. This repository holds
registry records, the schemas that keep them honest, and the storefront.

## Develop

This project uses **[Bun](https://bun.sh)**. npm, yarn, and pnpm are rejected by
a `preinstall` guard so the lockfile stays consistent.

```sh
bun install
bun run dev          # http://localhost:4321
bun run build        # static output in dist/
bun run preview      # serve the production build

bun run validate     # schemas + cross-checks
bun run marketplace  # regenerate the catalog from plugins/
bun run check        # astro check
```

## How it fits together

| Path                             | Purpose                                                             |
| -------------------------------- | ------------------------------------------------------------------- |
| `plugins/<name>/plugin.json`     | **Source of truth.** One manifest per plugin.                       |
| `schemas/`                       | JSON Schemas for a manifest and for the aggregated catalog.         |
| `scripts/generate-marketplace.mjs` | Aggregates manifests into the catalog. `--check` for CI.          |
| `scripts/validate.mjs`           | Schema validation plus name, duplicate, and sync checks.            |
| `.github/plugin/marketplace.json` | **Generated.** What Copilot clients read.                          |
| `public/marketplace.json`        | **Generated.** The same document, with a public URL, and the build-time source for the site. |
| `src/lib/marketplace.ts`         | Types, labels, install snippets, and art helpers used by the site.  |
| `src/components/`                | Header, hero, featured cards, collections, catalog, anatomy diagram, install guide. |
| `src/pages/plugins/[slug].astro` | One detail page per plugin.                                         |
| `docs/`                          | Contribution, validation, and rollout guides.                       |

> Never hand-edit `marketplace.json`. Edit a manifest and run
> `bun run marketplace`.

## Adding a plugin

Create `plugins/<plugin-name>/plugin.json`:

```json
{
  "$schema": "../../schemas/plugin.schema.json",
  "name": "release-captain",
  "description": "Draft a changelog and release PR description from the branch diff.",
  "version": "1.0.0",
  "author": { "name": "Developer Experience" },
  "repository": "https://github.com/your-org/release-captain",
  "category": "Delivery",
  "directory": {
    "type": "agent",
    "updated": "2026-02-14",
    "contains": { "agents": 1, "skills": 2 }
  }
}
```

Then `bun run marketplace && bun run validate` and open a pull request with the
manifest and the regenerated catalog. Full walkthrough:
[docs/contributing-a-plugin.md](docs/contributing-a-plugin.md). There is also a
[plugin submission issue form](.github/ISSUE_TEMPLATE/new-plugin.yml) for people
who would rather not open a PR.

The `directory` object is a local extension holding display-only fields. The
official schemas are closed (`additionalProperties: false`), and Copilot clients
ignore unknown keys there.

## Copilot customisation in this repo

| File                                    | Purpose                                                   |
| --------------------------------------- | ---------------------------------------------------------- |
| `AGENTS.md`                             | Full contributor guide for coding agents.                  |
| `.github/copilot-instructions.md`       | Repository custom instructions for Copilot.                |
| `.github/skills/add-a-plugin/`          | Skill: register or update a plugin in the catalog.         |
| `.github/skills/marketplace-site/`      | Skill: work on the Astro site and design system.           |

## Make it an internal marketplace

1. Create an organisation-owned repository and set visibility to **Internal**.
   Restrict write access to the maintainers team and require CODEOWNERS review
   for catalog changes.
2. Create one repository per plugin, each with its own plugin manifest and
   `agents/`, `skills/`, `hooks.json`, `.mcp.json`, or `lsp.json` as needed.
3. Update `marketplaceRepo` in `src/lib/marketplace.ts` and the `repository`
   URLs in `plugins/*/plugin.json` to your organisation. No tokens or secrets
   belong in this static site.
4. In **Settings → Pages**, choose **GitHub Actions** as the source.
   `.github/workflows/pages.yml` builds and publishes `dist/` on pushes to
   `master`, passing the Pages base path to the build.
5. Confirm your enterprise's Pages visibility policy. A Pages site is not
   private just because its repository is — use the enterprise internal Pages
   option, or serve `dist/` behind an approved internal gateway.
6. Register the marketplace with Copilot:
   [CLI](docs/setup-cli.md), [VS Code](docs/setup-vscode.md), or push it to
   everyone at once with
   [organisation-managed settings](docs/setup-org-enterprise.md).

## CI

`.github/workflows/validate-marketplace.yml` runs `bun run validate`,
`bun run marketplace:check`, and `bun run build` on every pull request touching
the catalog, so a stale or hand-edited `marketplace.json` cannot merge.

## Reference

- [About GitHub Copilot plugins](https://docs.github.com/en/copilot/concepts/agents/about-plugins)
- [Creating a plugin marketplace for GitHub Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/plugins-marketplace)
- [Finding and installing plugins](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/plugins-finding-installing)
