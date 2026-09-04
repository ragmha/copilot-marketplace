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

Both mirror GitHub's official plugin and marketplace schemas, with one addition:
the `directory` object, a local extension holding fields this website needs.
Copilot clients ignore unknown keys there.
