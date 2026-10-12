---
name: add-a-plugin
description: Add a new plugin to this marketplace, or edit an existing entry. Use when someone wants to list, register, publish, submit, or update a Copilot plugin, skill, agent, MCP server, or prompt in the catalog. Triggers include "add a plugin", "list my skill", "register an MCP server", "submit to the marketplace", "update the catalog".
---

# Add a plugin to the marketplace

The catalog is generated. You add a **manifest**, not a catalog entry.

## 1. Gather what you need

Ask for anything missing before writing files:

| Field         | Notes                                                                 |
| ------------- | --------------------------------------------------------------------- |
| `name`        | kebab-case, unique, and **identical to the directory name**            |
| `description` | One sentence, what it does for the user, no marketing                  |
| `version`     | Semver of the plugin, e.g. `1.0.0`                                     |
| `author`      | Team or person that owns it                                            |
| `repository`  | `https://github.com/<owner>/<repo>` where the plugin actually lives    |
| `source.sha`  | Required reviewed 40-hex commit for real GitHub or Git URL sources     |
| `category`    | Reuse an existing one — check `plugins/*/plugin.json` first            |
| `type`        | `plugin`, `skill`, `agent`, `prompt`, `hook`, `mcp-server`, `extension` |

## 2. Write the manifest

Create `plugins/<name>/plugin.json`:

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
    "sample": true,
    "type": "agent",
    "updated": "2026-02-14",
    "contains": { "agents": 1, "skills": 2 }
  }
}
```

Rules that validation enforces:

- The schemas set `additionalProperties: false`. Anything that only the website
  needs (`type`, `featured`, `updated`, `contains`, `sample`) goes inside `directory`.
- The example is a template placeholder: `directory.sample: true` keeps it on
  the site with a Sample badge and no install commands, but excludes it from
  `.github/plugin/marketplace.json`. Adopters should delete sample placeholders.
- Real remote entries must provide an explicit `source` with `source: "github"`
  and `repo`, or `source: "url"` and `url`, plus a reviewed 40-hex `sha`.
  Resolve upstream HEAD anonymously with
  `git ls-remote https://github.com/<owner>/<repo>.git HEAD`, verify the package
  manifest exists at that commit, and review its contents. Remove `sample`
  for real entries; do not use it to bypass review. Bump `source.sha` only
  through a reviewed PR, never automatically or to a floating branch/tag.
- `updated` is `YYYY-MM-DD`. Use today's date for a new entry.
- `contains` counts components in the plugin's own repo. The only keys the schema
  accepts are `skills`, `agents`, `hooks`, and `mcpServers`. Omit keys that are
  zero; omit the object entirely if you do not know.
- Set `"featured": true` in `directory` only when the owner asked for it — the
  homepage shows the first three featured entries.

## 3. Regenerate and validate

```sh
bun run marketplace   # rebuilds .github/plugin/marketplace.json and public/marketplace.json
bun run validate      # schema + name/directory/duplicate/sync checks
bun run build         # confirms the detail page renders
```

Commit the manifest **and** both generated files together. CI runs
`bun run marketplace:check` and fails if they drift.

## Common mistakes

- **Editing `marketplace.json` directly.** It is overwritten on every
  regeneration. Edit the manifest.
- **Directory name ≠ `name`.** Validation rejects this; rename the directory.
- **Extra top-level fields.** `type` at the top level fails the schema — it
  belongs in `directory`.
- **Pointing `repository` at this repo.** It must point at the plugin's own
  repository, since that is what Copilot clones on install.

## Removing a plugin

Delete `plugins/<name>/`, then run `bun run marketplace && bun run validate`.
Note in the PR that anyone with it installed should run
`copilot plugin uninstall <name>`.
