# Copilot instructions

Internal GitHub Copilot plugin marketplace: a catalog of plugin manifests plus
an Astro static site that renders it.

See [AGENTS.md](../AGENTS.md) for the full contributor guide. The essentials:

## The catalog is generated

- Source of truth: `plugins/<name>/plugin.json` (one directory per plugin).
- Generated: `.github/plugin/marketplace.json` and `public/marketplace.json`.
- **Never edit the generated files.** Change a manifest, then run
  `bun run marketplace`.
- Directory name must match the manifest `name`.
- Real GitHub and Git URL entries require a reviewed 40-hex `source.sha`;
  bump it only through a reviewed PR, never to a floating branch or tag.
- `directory.sample: true` marks template placeholders adopters should delete.
  Keep samples in the site catalog, exclude them from the installable catalog,
  show a Sample badge, and never offer sample install commands.
- Schemas in `schemas/` use `additionalProperties: false`; site-only fields
  (`type`, `featured`, `updated`, `contains`, `sample`) belong under `directory`.

## Checks

**Bun only** — npm, yarn, and pnpm are blocked by a `preinstall` guard. Use
`bun install` and `bun add`; never suggest `npm install` or commit a
`package-lock.json`.

Workflow `uses:` entries in `.github/workflows/*.yml` must be SHA-pinned to the
current major version; Dependabot updates the inline version comments when it
bumps those actions.

```sh
bun run validate          # schemas + cross-checks
bun run marketplace:check # catalog is in sync with plugins/
bun run build             # astro build
```

## Site

- Astro 7 + Tailwind v4 (`@tailwindcss/vite`, no config file). Theme tokens are
  in `src/styles/global.css` under `@theme inline`.
- Require Node.js >=22.12.0 and Bun >=1.4.0. Let Astro resolve Vite 8 without
  overrides; `compressHTML: true` retains HTML-aware inline spacing.
- Use shadcn token classes — `bg-card`, `text-muted-foreground`, `border-border`,
  `bg-primary` — never raw colours like `bg-white` or `text-gray-500`.
- Dark mode is a `.dark` class on `<html>`; every colour must work in both modes.
- The whole site is monospace. Do not add per-component font stacks.
- Prefer `.astro` components. Use React (`client:visible`) only for genuinely
  interactive islands.
- Import shared types, labels, and install snippets from
  `src/lib/marketplace.ts` instead of re-declaring them.
- TypeScript, no `any`. Prefer `type` aliases.
- A hashed CSP meta tag comes from `security.csp`. Never allow script
  `'unsafe-inline'` or `'unsafe-eval'`; keep `public/staticwebapp.config.json`
  in sync with `src/lib/csp.mjs`.

## Out of scope

No backend, no runtime data fetching, no secrets in client code. Plugin content
lives in each plugin's own repository — this repo stores registry records only.
