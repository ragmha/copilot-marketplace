# Submitting a skill without Git

The site's **Submit a skill** link opens `/submit/`. Contributors can link an
existing repository or write plain-language instructions for a new skill.
The page suggests an identifier and shows a text-only draft preview. A skill
draft includes `SKILL.md` frontmatter; other capability types retain their
instructions as review material.

No corporate email address, Git commands, or JSON authoring are required.
Contributors do need a GitHub account with permission to open issues in the
configured marketplace repository.

## Import an existing file

Drop a single `SKILL.md` or `plugin.json` file onto the form, or choose it with
the file picker. The file is read locally in the browser. Nothing is uploaded
or executed, and commands/MCP configuration inside a manifest are not imported.
Select **Use these details** to replace the form, or cancel to keep the current
draft. Imported content still needs review and a fresh sharing confirmation.

Imports are limited to 128 KiB text files. Skill frontmatter uses a YAML parser
with scalar-only name/description extraction; aliases are not expanded.
The form rejects unsupported tags, duplicate metadata, malformed JSON, oversized
headers, and instructions beyond its 20,000-character limit. ZIP files and
folders are intentionally not supported.

## Review flow

1. Enter a name, description, and either a source repository or instructions.
2. Optionally identify the owning team, use case, and existing package version.
3. Confirm the content is appropriate to share and contains no secrets or customer data.
4. Select **Review on GitHub**. The site opens a prefilled issue form.
5. On GitHub, review the fields, complete its confirmation checklist, and submit.

The website does not create an issue, open a pull request, publish a package,
or claim a successful submission on the contributor's behalf. GitHub owns the
authentication and final submission step.

Long instructions use an explicit copy/paste handoff rather than an oversized
URL. No draft text is silently truncated. Exceptionally large summary/metadata
fields must be shortened or moved into the instructions.

## How the template is wired

- Destination: `repository` in `marketplace.config.json`, or the deliberate
  build-time `PUBLIC_MARKETPLACE_REPO` override.
- Website route: built with `marketplaceHome`, so root and Pages subpath hosting work.
- GitHub form: `.github/ISSUE_TEMPLATE/new-plugin.yml`.
- Query parameters: `submissionFieldIds` in `src/lib/submission.ts` match the
  issue form's field IDs. Tests enforce this contract.

Commit the issue form to the destination repository's default branch and enable
GitHub Issues before sharing the website. The optional `plugin-submission`
label must exist in the destination repository if you want GitHub to apply it.
An unconfigured `your-org/...` template permits draft previews, but disables
the GitHub handoff.

This stays entirely static on GitHub Pages or Azure Static Web Apps. There is
no browser token, API backend, automatic submission, or local-storage draft
retention. Fields remain in memory while editing; continuing includes fields
in a GitHub URL, which may appear in browser history. Do not include sensitive
information. Website sign-in does not grant GitHub repository access.

## Maintainer responsibilities

A submission is a proposal, not an approved catalog record. Before publication,
confirm the actual source repository, package manifest, version, publisher,
component support, access requirements, and security review.

New skill drafts still need packaging in their own source repository. This
marketplace stores registry records only; it does not turn issue text into
executable content. Once ready, follow [contributing a plugin](contributing-a-plugin.md)
and submit the manifest and regenerated catalog through normal review.

The approach uses GitHub's native
[issue forms](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-githubs-form-schema),
whose field IDs support URL prefills.
