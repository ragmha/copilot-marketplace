<h1 align="center">Copilot Marketplace</h1>

<p align="center">
  <strong>Your organization's home for Copilot skills, agents, and tools.</strong><br>
  A customizable plugin catalog and static storefront for GitHub Pages or Azure Static Web Apps.
</p>

<p align="center">
  <a href="#quick-start">Quick start</a> &middot;
  <a href="docs/customization.md">Configuration</a> &middot;
  <a href="docs/deployment.md">Deployment</a> &middot;
  <a href="docs/submissions.md">Submit a skill</a>
</p>

## Why Copilot Marketplace

- **Make it yours.** Set your company name, logos, and repository in one configuration file.
- **Find and install.** Search capabilities and follow instructions for APM, Copilot CLI, or VS Code.
- **Choose your host.** Publish a static site on GitHub Pages or Azure Static Web Apps. No backend required.
- **Keep human review.** Contributors submit GitHub review requests, not automatically published plugins.

## Quick start

1. Select **Use this template > Create a new repository** at the top of this repository.
2. Choose **your organization** as the owner and name your copy, for example
   `acme/copilot-marketplace`.
3. Clone **your new repository**, then configure and run it:

Requires Git, Node.js, and [Bun](https://bun.sh).

```powershell
git clone https://github.com/acme/copilot-marketplace.git
Set-Location copilot-marketplace
bun install --frozen-lockfile
bun run setup --organization Acme --repository acme/copilot-marketplace --name acme-tools
bun run dev
```

Replace `Acme` and `acme/copilot-marketplace` with your real company and repository.
Open <http://localhost:4321>. Setup configures the site; it does not create a
GitHub organization or repository. See [Configuration](docs/customization.md) for logos.
If **Use this template** is missing, the publisher must first
[enable template adoption](docs/customization.md#publishing-this-project-as-a-template).

## Deploy

Review or remove sample catalog entries before publishing. Set the repository
variable `DEPLOY_TARGET` to `github-pages` or `azure`, then follow the
[deployment guide](docs/deployment.md). Azure requires an existing Static Web Apps
resource; `azd` provisioning is not included. A private repository does not
automatically make its website private.

## How it works

`marketplace.config.json` owns company identity and branding.
`plugins/<name>/plugin.json` contains each registry record; plugin code stays
in its own repository. After editing either source, run
`bun run marketplace && bun run validate`. Never hand-edit the generated catalogs.

## Go deeper

| Guide | What it covers |
| --- | --- |
| [Configuration](docs/customization.md) | Company identity, logos, and the Acme setup example |
| [Deployment](docs/deployment.md) | GitHub Pages, Azure, and site access controls |
| [Submissions](docs/submissions.md) | No-Git forms, local file import, and maintainer review |
| [Adding a plugin](docs/contributing-a-plugin.md) | Manifests, source locations, and catalog updates |
| [Organization rollout](docs/setup-org-enterprise.md) | Registering and distributing the marketplace |
| [Fabric collection](docs/fabric-catalog.md) | Included Microsoft Fabric bundles and prerequisites |

## Contributing

Use **Bun only**. Read [AGENTS.md](AGENTS.md) for development commands and
[the validation guide](docs/validation.md) for checks. Acme browser acceptance
tests run against both root and GitHub Pages hosting paths.
