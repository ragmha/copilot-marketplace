# Contributing a plugin

The catalog in this repository is **generated**. You contribute a manifest; the
tooling produces `.github/plugin/marketplace.json` and `public/marketplace.json`.

Your plugin's actual content — skills, agents, MCP servers, prompts — stays in
your own repository. This repo stores registry records only.

## Before you start

Your plugin repository needs to be:

- Visible to everyone in the organisation (internal or public).
- Free of secrets, credentials, and customer data.
- Home to a valid plugin manifest that Copilot can read on install.

## Steps

### 1. Create the manifest

```
plugins/<plugin-name>/plugin.json
```

The directory name **must** equal the `name` field.

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

| Field                | Required | Notes                                                       |
| -------------------- | -------- | ----------------------------------------------------------- |
| `name`               | yes      | kebab-case, unique, matches the directory                    |
| `description`        | yes      | One sentence, plain language                                 |
| `version`            | yes      | Semver                                                       |
| `author.name`        | yes      | Owning team or person                                        |
| `repository`         | yes      | The plugin's own repository URL                              |
| `category`           | yes      | Reuse an existing category where possible                    |
| `directory.type`     | yes      | `skill`, `agent`, `mcp-server`, `prompt`, or `bundle`        |
| `directory.updated`  | yes      | `YYYY-MM-DD`                                                 |
| `directory.featured` | no       | Promotes it to the homepage picks                            |
| `directory.contains` | no       | Component counts: `skills`, `agents`, `mcpServers`, `prompts`|

Everything under `directory` is a local extension used only by this website.
Copilot clients ignore it.

### 2. Regenerate and validate

```sh
bun install          # first time only
bun run marketplace  # regenerate the catalog
bun run validate     # schemas + cross-checks
bun run build        # confirm the detail page renders
```

### 3. Open a pull request

Commit the manifest **and** the regenerated catalog files. CI runs
`bun run validate`, `bun run marketplace:check`, and `bun run build`, and fails
if the generated files drift from `plugins/`.

Prefer not to open a PR? File a
[plugin submission issue](../../issues/new?template=new-plugin.yml) instead.

## Updating a plugin

Edit `plugins/<name>/plugin.json`, bump `version`, set `directory.updated` to
today, then regenerate and validate.

## Removing a plugin

Delete `plugins/<name>/`, regenerate, and validate. Mention in the PR that
anyone with it installed should run `copilot plugin uninstall <name>`.

## See also

- [validation.md](validation.md) — what the checks enforce and how to read failures
- [setup-org-enterprise.md](setup-org-enterprise.md) — rolling the marketplace out org-wide
