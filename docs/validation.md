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

The last two mean the generated file is stale — run `bun run marketplace`.

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

Astro is pinned to `5.18.2` with a committed Bun dependency patch. It removes
the renderer's URL-specific exception to attribute escaping, matching the
corrected behavior in
[Astro's upstream renderer](https://github.com/withastro/astro/blob/astro%407.2.8/packages/astro/src/runtime/server/render/util.ts).
This keeps the existing Astro 5 integration without a major-version migration.
It is a targeted backport, not a claim that every upstream advisory is fixed.

`bun install --frozen-lockfile` applies the patch through `patchedDependencies`
in `package.json`; keep the patch, manifest, and lockfile together. When updating
Astro, verify the replacement release escapes URL-like attribute values before
removing the patch and exact version pin.

`bun test tests/security.test.mjs` checks repository URL rejection at every
boundary and parses the renderer's HTML to verify that quotes and ampersands
are escaped without adding elements. `bun run test:template` also builds a
fixture whose description contains an inert injection probe and verifies that
the actual homepage and detail page preserve the original text at both root
and Pages hosting paths.
