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
- Schemas in `schemas/` use `additionalProperties: false`; site-only fields
  (`type`, `featured`, `updated`, `contains`) belong under `directory`.

## Checks

**Bun only** — npm, yarn, and pnpm are blocked by a `preinstall` guard. Use
`bun install` and `bun add`; never suggest `npm install` or commit a
`package-lock.json`.

```sh
bun run validate          # schemas + cross-checks
bun run marketplace:check # catalog is in sync with plugins/
bun run build             # astro build
```

## Site

- Astro 5 + Tailwind v4 (`@tailwindcss/vite`, no config file). Theme tokens are
  in `src/styles/global.css` under `@theme inline`.
- Use shadcn token classes — `bg-card`, `text-muted-foreground`, `border-border`,
  `bg-primary` — never raw colours like `bg-white` or `text-gray-500`.
- Dark mode is a `.dark` class on `<html>`; every colour must work in both modes.
- The whole site is monospace. Do not add per-component font stacks.
- Prefer `.astro` components. Use React (`client:visible`) only for genuinely
  interactive islands.
- Import shared types, labels, and install snippets from
  `src/lib/marketplace.ts` instead of re-declaring them.
- TypeScript, no `any`. Prefer `type` aliases.

## Out of scope

No backend, no runtime data fetching, no secrets in client code. Plugin content
lives in each plugin's own repository — this repo stores registry records only.
