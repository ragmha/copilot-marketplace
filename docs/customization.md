# Customize your organization's marketplace

`marketplace.config.json` is the source of truth for customer identity, catalog
metadata, and site branding. Edit that one JSON file, or use the noninteractive
setup command. Neither option changes GitHub settings, creates Azure resources,
downloads logos, deletes sample plugins, or changes a plugin's source repository.

## Publishing this project as a template

Before inviting customers to adopt it, publish the reviewed implementation to
the source repository's default branch and enable
**Settings > General > Template repository**. Customers must have read access
to that repository; a private template is not available to everyone.

Customers then choose **Use this template > Create a new repository** and select
their own organization as the owner. This creates an independent repository
from the template, not a fork. Their new repository does not need to be marked
as a template unless they also intend to distribute it as a starter.

The setup command configures that new copy. It does not enable GitHub's template
setting, create repositories, or change repository access.

## First-time setup: Acme example

Use the source repository's **Use this template** action to create a copy under
your organization, clone that new repository, and run
`bun install --frozen-lockfile`.

Place your approved logo files at `public/branding/acme.svg` and optionally
`public/branding/acme-dark.svg` first. The setup command will reject missing
files before writing anything. Then run:

```sh
bun run setup --organization Acme --repository acme/copilot-marketplace --name acme-tools --title "Acme Marketplace" --logo branding/acme.svg --logo-dark branding/acme-dark.svg
bun run validate
bun run marketplace:check
bun run check
bun run test
bun run build
```

The direct equivalent is `bun scripts/setup.mjs` with the same arguments.
Use `bun run setup --help` for all options. Only `--organization` and
`--repository` are required. Omit both logo arguments to use the site's fallback
lettermark. Without `--title`, setup uses `<organization> Marketplace`; without
`--name`, it keeps the current registration key.

Setup validates the complete candidate, including both supplied logo paths,
and reads the plugin manifests **before any writes**. It then saves the config
and regenerates `.github/plugin/marketplace.json` and `public/marketplace.json`
through the shared catalog generator. Validation failures leave all three
files unchanged. An operating-system write failure is reported as an error;
the three file writes are not a filesystem transaction. Resolve the reported
filesystem issue and rerun `bun run marketplace` if catalog writes failed.

Any repository whose owner is not the placeholder `your-org` is treated as
already configured. Further setup calls, even with identical values, require
`--force`. Review the current config before using it. Version, description,
the registration key, and logo fields not supplied on the command line are
preserved. To remove an existing logo, delete its field in the config.

Setup changes `owner.name` to the organization. It removes placeholder contact
addresses under `example.com`, `example.org`, `example.net`, `.example`,
`.test`, `.invalid`, and `localhost`. A non-placeholder contact you explicitly
configured is retained during initial setup or when the organization is
unchanged; changing an already configured organization also clears the contact
to avoid carrying another company's address forward. Review any retained
email, or set `owner.email` directly afterward and regenerate. Contact email
is optional and public, never a credential.

## Edit the JSON instead

This is a complete Acme configuration; the logo files must exist before
validation or generation:

```json
{
  "name": "acme-tools",
  "repository": "acme/copilot-marketplace",
  "version": "1.0.0",
  "owner": {
    "name": "Acme",
    "email": "developer-experience@acme.com"
  },
  "branding": {
    "organization": "Acme",
    "title": "Acme Marketplace",
    "description": "Approved Copilot tools for Acme engineering.",
    "logo": "branding/acme.svg",
    "logoDark": "branding/acme-dark.svg"
  }
}
```

After editing, run `bun run marketplace && bun run validate`.
Commit the config, your approved logo assets, and both regenerated catalogs
together when you are ready. Never hand-edit either generated catalog.

| Config field | Meaning and affected surfaces |
| --- | --- |
| `name` | Stable kebab-case Copilot registration key, such as `acme-tools`. Sets the generated catalog name, `extraKnownMarketplaces` key, and `plugin@acme-tools` install/enable snippets. |
| `repository` | GitHub `owner/repository`, not a URL. Sets generated `metadata.repository` to `https://github.com/<repository>` and defaults site repository/submission links and marketplace registration commands. |
| `version` | Semantic version of the marketplace, not a plugin version. Sets generated `metadata.version`. |
| `owner.name`, `owner.email?` | Catalog ownership and optional public contact. Independent of each plugin's author. |
| `branding.organization` | Company display name used by the site, distinct from its GitHub organization slug. |
| `branding.title` | Full marketplace site title. |
| `branding.description` | Short site description and generated `metadata.description`. |
| `branding.logo?`, `branding.logoDark?` | Optional public-relative light/dark local logo assets. |

Changing `name` changes how clients qualify plugins. Existing consumers must
update their marketplace registration/settings and enabled plugin keys.
Changing `repository` does **not** change individual plugin repository URLs:
those can intentionally belong to partners or third parties. Review the sample
manifests under `plugins/` and deliberately replace or remove only the entries
that do not belong in your catalog. Regenerate after any manifest edits.

## Logos, multiple brands, and hosting paths

Keep one config per adopted repository. Replace organization, title,
description, and supplied images for each customer; no component edits are
needed. There is intentionally no environment override selecting another
config file.

Logo paths are relative to `public/`, not to the page URL. Use
`branding/acme.svg`, **not** `public/branding/acme.svg`,
`/branding/acme.svg`, a filesystem path, or a remote URL. Supported extensions
are SVG, PNG, JPG/JPEG, and WebP, case-insensitively. Use URL-safe, unencoded
names containing letters, digits, `.`, `_`, `-`, and `~`, separated by `/`.
Schemes, query strings, fragments, backslashes, absolute paths, `.`/`..`
segments, and percent encoding (including double-encoded traversal) are
rejected. Files must exist inside `public/`; links escaping that directory are
rejected. No SVG content is parsed or injected inline, and setup never fetches
remote assets. Supply only reviewed artwork that you are allowed to publish.

The light logo is reused in dark mode when `logoDark` is absent. Each field is
optional: with neither supplied, the site uses a lettermark; if only a dark
logo is supplied, light mode uses the lettermark.

The site's `brandLogoHref(path)` prefixes a validated path with
`marketplaceHome`, which follows Astro's build base. The same
`branding/acme.svg` config works at `/branding/acme.svg` on a root host and at
`/acme-marketplace/branding/acme.svg` on a Pages subpath. Do not bake a hosting
base into the logo path. See [deployment](deployment.md) for `BASE_PATH`.

## Build settings are not identity configuration

Set **`marketplace.config.json.repository` to the actual GitHub repository
first**, then regenerate. `PUBLIC_MARKETPLACE_REPO` is only an intentional,
non-secret build-time override for site install snippets and repository links.
It does not edit the config, change the registration key, or regenerate catalog
metadata. It is not the website URL and must be `owner/repository`.

The deployment workflows currently supply `${{ github.repository }}` as this
override. Keep the checked-in config consistent with that repository; an
environment override cannot repair stale catalog identity. Local builds need
no override after configuration. `BASE_PATH` is separate: it controls the
website's root/subpath, not GitHub identity.

## Acme checks

`bun test tests/config.test.mjs` runs bounded, isolated temporary-directory
tests for config validation, Acme catalog identity, setup protection, unchanged
third-party plugin repositories, local logo variants and unsafe/missing paths.
It never changes the actual checkout to Acme.

`bun run test:template` is the complementary browser acceptance suite at `/`
and `/acme-marketplace/`. Install its browser once with
`bun run test:template:install` if needed. It exercises the adopter-facing
branding and installation surfaces in isolated fixtures, not a deployed site.
