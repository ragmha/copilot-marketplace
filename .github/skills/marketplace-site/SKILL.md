---
name: marketplace-site
description: Build or change the marketplace website — Astro components, pages, Tailwind v4 theme tokens, dark mode, and the client-side catalog filtering. Use when editing anything under src/, adding a section or component to the homepage, restyling the UI, or debugging the theme toggle, search, sort, or the React Flow diagram.
---

# Working on the marketplace site

Astro 5 static site, Tailwind v4, shadcn design tokens, monospace throughout.

## Layout of the code

```
src/
  layouts/Layout.astro          <html>, theme bootstrap script, <slot/>
  pages/index.astro             Composition root — section order lives here
  pages/plugins/[slug].astro    getStaticPaths() → one detail page per plugin
  components/*.astro            Everything else
  components/PluginAnatomy.tsx  The only React island (React Flow)
  lib/marketplace.ts            Types, labels, install snippets, href + art helpers
  styles/global.css             @theme inline tokens + @layer components
```

Data flows one way: `public/marketplace.json` → `normalize()` → flat `Plugin[]`
→ components. The JSON is generated from `plugins/*/plugin.json`; see the
`add-a-plugin` skill.

## Design system

- **Tailwind v4 with no config file.** It is wired through `@tailwindcss/vite`.
  Tokens are declared in `src/styles/global.css` inside `@theme inline`, and the
  `.dark` block overrides the same custom properties.
- **Only use token classes**: `bg-background`, `bg-card`, `text-foreground`,
  `text-muted-foreground`, `border-border`, `bg-primary`, `text-primary-foreground`,
  and `--chart-1..5` for accents. Never `bg-white`, `text-gray-500`, or a hex value.
- **Every change must work in both themes.** Toggle dark mode and re-check; a
  colour that only reads well on light is a bug.
- **Monospace is deliberate.** The stack is set once on `body`. Do not override it.
- Rounded corners, thin `border-border` outlines, and generous spacing are the
  house style. Match neighbouring components rather than inventing a new look.

## Component conventions

- Default to `.astro`. Add a React island only when client state is genuinely
  required, and mount it with `client:visible`.
- Props are typed via `interface Props` / `const { ... } = Astro.props`.
- Client behaviour goes in an inline `<script>` in the component that owns it.
  There is no shared JS bundle.
- Reuse `src/lib/marketplace.ts` helpers — `typeLabel`, `typeChip`, `pluginHref`,
  `pluginArt`, `installCommand`, `describeUpdated` — rather than re-deriving them.

## Things that will bite you

- **`Catalog.astro` filters the DOM, it does not re-render.** Its script reads
  `data-name`, `data-type`, `data-updated`, and `data-search` off `.plugin-card`
  elements emitted by `PluginCard.astro`. Change one, change both. Sorting sets
  `style.order`, which works because the container is a CSS grid.
- **Install buttons sit inside full-card links.** `InstallToast.astro` is the
  single delegated `[data-install]` handler and calls `preventDefault()`. Add new
  install buttons by emitting `data-install="<command>"`, not a new listener.
- **React islands need the JSX tsconfig.** `jsx: "react-jsx"` and
  `jsxImportSource: "react"` are already set; without them SSR fails with
  `ReferenceError: React is not defined`.
- **React Flow needs theme bridging.** Its own CSS is imported by the island and
  overridden in the `@layer components` block of `global.css`.
- **`describeUpdated()` runs at build time**, so relative dates are only as fresh
  as the last deploy. The exact ISO date stays in the `title` attribute.
- `bunx astro add react` fails in this environment; install packages with
  `bun add`. This repo uses **Bun only** — a `preinstall` guard rejects npm,
  yarn, and pnpm.

## Before you finish

```sh
bun run check   # astro check
bun run build   # must stay at 1 index + one page per plugin
```

Then load the dev server and confirm in **both** themes: featured cards,
category rows, tab counts, search and sort, the anatomy diagram, the install
guide tabs, a detail page, and the copy toast.
