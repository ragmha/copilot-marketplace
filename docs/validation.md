# Validation

Three checks guard the catalog. All three run in CI on every pull request that
touches `plugins/`, `schemas/`, `scripts/`, or a generated file.

```sh
bun run validate           # schemas + cross-checks
bun run marketplace:check  # generated files match plugins/
bun run build              # the site still builds
```

## `bun run validate`

`scripts/validate.mjs` compiles the JSON Schemas with ajv (draft 2020-12) and
then applies checks a schema cannot express.

| Check                     | Failure looks like                                            |
| ------------------------- | -------------------------------------------------------------- |
| Manifest schema           | `plugins/x/plugin.json failed schema validation`                |
| Name matches directory    | `name "y" does not match directory "x"`                         |
| No duplicate names        | `Duplicate plugin name "x" in x and x-copy`                     |
| Catalog schema            | `.github/plugin/marketplace.json failed schema validation`      |
| Every plugin is listed    | `Plugin "x" is missing from the catalog`                        |
| No orphan catalog entries | `Catalog entry "x" has no plugins/x/plugin.json`                |
| Real remote sources pinned | `Plugin "x" requires a 40-hex source.sha`                     |
| Both catalogs match manifests | `differs from marketplace.config.json or plugin manifests (including sample exclusions)` |

Missing, orphaned, or mismatched entries mean the generated file is stale —
run `bun run marketplace`.

Every non-sample GitHub or Git URL plugin must set an explicit `source.sha`
to a reviewed 40-hex commit. Only `directory.sample: true` template placeholders
are exempt. The installable catalog excludes samples; the site catalog retains
them. Validation checks both schemas and both expected documents independently,
including an empty installable catalog when only samples remain.

Plugin repository URLs and catalog string sources must be complete HTTPS URLs
without embedded credentials, whitespace, or backslashes. A shared parsed-URL
check also rejects unsafe repositories during generation, submission validation,
and Source-link rendering; it fails explicitly instead of emitting a usable
link. An explicit GitHub `source` does not bypass the repository check.

## `bun run marketplace:check`

Regenerates the catalog in memory and byte-compares it against the two files on
disk. It fails if either differs, which is how a hand-edited `marketplace.json`
gets caught.

Fix: `bun run marketplace`, then commit the result.

## Common failures

**`additionalProperties` errors.** Both schemas are closed. Display-only fields
(`type`, `featured`, `updated`, `contains`) belong inside `directory`, not at the
top level.

**`must match format "date"`.** `directory.updated` is `YYYY-MM-DD`.

**`must match pattern` on `name`.** Names are lowercase kebab-case:
`^[a-z0-9]+(-[a-z0-9]+)*$`.

**Catalog out of date on a branch that did not touch plugins.** Someone edited a
generated file directly. Regenerate.

## The schemas

- `schemas/plugin.schema.json` — a single `plugins/<name>/plugin.json`.
- `schemas/marketplace.schema.json` — the aggregated catalog.

Both follow GitHub's plugin and marketplace formats, with the `directory`
object as a local extension holding fields this website needs. Copilot clients
ignore unknown keys there. The local schemas additionally restrict repository
URLs to HTTPS for safe website links.

## Rendering security regression

Astro is pinned to stable `7.3.5` with React integration `7.0.0`. Its
[upstream renderer](https://github.com/withastro/astro/blob/astro%407.3.5/packages/astro/src/runtime/server/render/util.ts)
escapes URL-like attribute values without the unsafe URL exception. The Astro
5.18.2 backport and `patchedDependencies` are no longer needed. Named entities
(`&amp;` and `&quot;`) replace the old numeric entities without changing decoded text.

The migration follows the official [Astro 6](https://docs.astro.build/en/guides/upgrade-to/v6/)
and [Astro 7](https://docs.astro.build/en/guides/upgrade-to/v7/) guides. Use
Node.js >=22.12.0 and Bun >=1.4.0. Astro resolves Vite 8 without the old
direct Vite dependency or overrides. Tailwind's Vite plugin is `4.3.3`, which
supports Vite 8; TypeScript remains on 5.9.

The site remains explicitly static. `compressHTML: true` retains HTML-aware
inline spacing instead of Astro 7's new JSX default. Browser regressions cover
spacing, asset loading, React Flow hydration, themes, filtering, installation,
and sample visibility at root and Pages subpaths.

`bun install --frozen-lockfile` verifies the committed resolution. Dependency
advisories still need review against the resolved versions and their actual
build-time or browser exposure; passing rendering tests is not an all-clear audit.

`bun test tests/security.test.mjs` checks repository URL rejection at every
boundary and parses the renderer's HTML to verify that quotes and ampersands
are escaped without adding elements. `bun run test:template` also builds a
fixture whose description contains an inert injection probe and verifies that
the actual homepage and detail page preserve the original text at both root
and Pages hosting paths.

### Dependency advisory snapshot (2026-10-09)

GitHub's global advisory API was queried for all 433 unique package versions in
the committed lockfile, including optional platform packages, using
`gh api --method GET advisories -f ecosystem=npm -f affects=<name@version,...>`.
The result agrees with `bun audit --json`: one remaining applicable advisory,
[GHSA-ch52-4w7c-c8xp](https://github.com/advisories/GHSA-ch52-4w7c-c8xp)
(high), affecting `http-cache-semantics` <=4.2.0. GitHub lists no patched release.

The issue requires a shared HTTP cache containing user-specific responses and
client-controlled `max-stale` directives. Here the package is an Astro
build-time remote-image dependency; the site has no `astro:assets` remote-image
pipeline, server adapter, authenticated response cache, or deployed Node server.
Only static files are deployed, so that vulnerable shared-cache path is not
exposed by this application. This is an accepted, scoped residual dependency
risk, not a claim that the package is fixed. Reassess before adding remote image
processing, on-demand rendering, or a shared cache, and refresh when a fix exists.

Compatible transitive fixes include `fast-uri` 3.1.8, `smol-toml` 1.9.0,
`source-map-js` 1.2.2, and `undici` 8.11.2. No broad dependency overrides are used.
