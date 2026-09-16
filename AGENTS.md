# AGENTS.md

Guidance for coding agents working in this repository.

## What this repository is

An internal GitHub Copilot **plugin marketplace**. It has two halves:

1. **The catalog** — `plugins/<name>/plugin.json` manifests, aggregated into
   `.github/plugin/marketplace.json`. This is what Copilot CLI, VS Code, the
   Copilot app, and cloud agents read when the marketplace is added.
2. **The site** — an Astro static site that renders the catalog for humans and
   can publish to GitHub Pages or Azure Static Web Apps.

Plugin *content* (skills, agents, MCP servers, prompts) lives in each plugin's
own repository. This repo only holds registry records.

## Commands

**Bun only.** A `preinstall` guard rejects npm, yarn, and pnpm, `bun.lock` is
the committed lockfile, and CI installs with `bun install --frozen-lockfile`.
Never run `npm install` here or suggest it in docs, and never commit a
`package-lock.json`. Add dependencies with `bun add` / `bun add -d`.

| Command                    | Purpose                                                  |
| -------------------------- | -------------------------------------------------------- |
| `bun install`              | Install dependencies                                     |
| `bun run dev`              | Astro dev server on <http://localhost:4321>              |
| `bun run build`            | Static build into `dist/`                                |
| `bun run check`            | `astro check` — types and template diagnostics           |
| `bun run test`             | Catalog filtering, ranking, and shareable URL tests      |
| `bun run setup --help`      | Configure the adopting company, repository, and logos    |
| `bun run test:template`    | Acme browser acceptance tests at root and Pages subpath  |
| `bun run marketplace`      | Regenerate the catalog from `plugins/`                   |
| `bun run marketplace:check`| Fail if the catalog is out of date (what CI runs)        |
| `bun run validate`         | Validate manifests and the catalog against the schemas   |

Before finishing any change: `bun run validate && bun run marketplace:check && bun run build`.

## Hard rules

- **Never hand-edit `.github/plugin/marketplace.json` or `public/marketplace.json`.**
  They are generated. Edit `plugins/<name>/plugin.json` and run `bun run marketplace`.
- A plugin's directory name must equal its manifest `name`. Validation enforces it.
- The schemas use `additionalProperties: false`. Site-only display data goes in
  the `directory` object, which Copilot clients ignore.
- No secrets in the frontend. This is a static site with no backend.

## Adding a plugin

```
plugins/<plugin-name>/plugin.json
```

Then `bun run marketplace && bun run validate`. See
[docs/contributing-a-plugin.md](docs/contributing-a-plugin.md) for the full walkthrough,
or use the `add-a-plugin` skill in `.github/skills/`.

## Site conventions

- **Astro 5** with **Tailwind v4** via `@tailwindcss/vite`. There is no
  `tailwind.config.js`; theme tokens are declared in `src/styles/global.css`
  with `@theme inline`.
- **shadcn token names** (`--background`, `--foreground`, `--card`, `--muted`,
  `--border`, `--primary`, `--chart-1..5`). Dark mode is a `.dark` class on
  `<html>`, toggled by `ThemeToggle.astro` and pre-applied by an inline script
  in `Layout.astro` to avoid a flash.
- **Use the tokens, never raw colours.** `bg-card`, `text-muted-foreground`,
  `border-border` — not `bg-white` or `text-gray-500`.
- **Monospace everywhere.** The type stack is set once on `body`; do not add
  per-component font overrides.
- Components are `.astro` by default. Reach for React (`.tsx`, `client:visible`)
  only when a component genuinely needs client state — currently just
  `PluginAnatomy.tsx`, which uses React Flow.
- `src/lib/marketplace.ts` is the single source of truth for types, labels,
  install snippets, and href helpers. Import from there rather than duplicating
  strings.
- Client-side behaviour lives in inline `<script>` blocks in the component that
  owns it. `Catalog.astro`'s filter script depends on the `data-*` attributes
  emitted by `PluginCard.astro` — keep them in sync.
- Pure filtering, ranking, and URL state helpers live in `src/lib/catalog.ts`.
  Sort the actual card elements so visual, screen-reader, and keyboard order agree.
- Company identity and logo paths live in `marketplace.config.json`, shared by
  the generator and site. Configure it directly or use `bun run setup`; regenerate
  the catalog after identity changes. Never hardcode company names in components.
- `MarketplaceSearch.astro` owns header search and keyboard access. `Catalog.astro`
  applies its query to category-grouped cards. Preserve search from detail pages.
- `InstallGuide.astro` shares the APM, Copilot CLI, and VS Code tabs between
  Quickstart and detail pages; method-specific instructions live in `src/lib/installation.ts`.
- Submission forms remain static: `src/lib/submission.ts` maps fields to
  `.github/ISSUE_TEMPLATE/new-plugin.yml` IDs. File imports read metadata locally;
  they must not upload or execute content, or silently replace a draft.
- Build links from `marketplaceHome` / `pluginHref`, not root-relative literals.
  Both root hosting (Azure/custom domains) and repository subpaths (Pages) must work.
- `PUBLIC_MARKETPLACE_REPO` is a non-secret build-time `owner/repository` setting
  overriding install snippets and repository links; it does not replace the
  source config or regenerate metadata. Never put credentials in `PUBLIC_*`.
- Template acceptance tests copy the app into isolated Acme fixtures. Run
  Playwright with its Node-based CLI (`bun run test:template`), not `bun --bun`;
  browser launch via Bun can hang on Windows.
- Keep Vite caches local to each project's `.astro/` directory. Acceptance
  fixtures link dependencies but must not invalidate the running dev server.

## Style

- TypeScript, no `any`. Prefer `type` over `interface`.
- Comment only what needs clarifying — why, not what.
- Match the surrounding formatting; there is no formatter enforced in CI.
