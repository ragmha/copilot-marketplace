# Deploy the marketplace website

This template has two GitHub Actions deployment paths: **GitHub Pages** and
**Azure Static Web Apps**. Both publish Astro's static `dist/` directory.
There is no server, API, runtime data fetching, or SPA routing fallback.
Azure resources must already exist before the Azure workflow runs. Infrastructure
provisioning with Azure Developer CLI (`azd`) is a future slice; this repository
does not provide an `azd up` deployment path.

Website hosting and authentication are independent of native Git-based
marketplace installation. Copilot clients still read
`.github/plugin/marketplace.json` from the GitHub repository using their own
repository access. Website sign-in does not grant access to that repository or
to a plugin's source repository, and hosting the website on Azure does not
change the Git-based installation address.

## Choose visibility before enabling deployment

**Do not deploy a sensitive catalog until its intended audience and access
controls are explicitly approved.** A private or internal source repository
does not automatically make its website private. Plugin names, descriptions,
repository URLs, generated HTML, `marketplace.json`, and bundled assets can all
disclose catalog information.

GitHub Pages visibility depends on your account, plan, and enterprise policy.
Azure Static Web Apps sites are public by default; this template does not
configure authentication. Decide between a public, nonsensitive catalog and an
approved restricted site before enabling either target. During setup, set
`DEPLOY_TARGET=none` to prevent these workflows from building or deploying.
Leaving it unset selects Pages for compatibility with existing installations.

## Select one deployment target

In GitHub, open **Settings > Secrets and variables > Actions > Variables** and
create the **repository variable** `DEPLOY_TARGET`. Do not put the selector in a
deployment environment: it must be available when the build job is evaluated.

| `DEPLOY_TARGET` value | Selected workflow |
| --- | --- |
| Unset or empty | `.github/workflows/pages.yml` (existing default) |
| `github-pages` | `.github/workflows/pages.yml` |
| `azure` | `.github/workflows/azure-static-web-apps.yml` |
| Any other value, including `none` | Neither; both workflows' jobs are skipped |

Use the lowercase values above. GitHub Actions expression string comparisons
are case-insensitive; whitespace is not trimmed.

Both workflows listen for branch pushes and manual `workflow_dispatch` runs.
Their jobs require the selected target and
`github.ref == refs/heads/<github.event.repository.default_branch>`.
A shell guard also checks the exact, case-sensitive branch ref before checkout.
There is no hardcoded branch name. Feature-branch pushes or manual runs cannot
publish production, and there are no tag, pull-request, or preview deployments.
A skipped run is not a deployment.

To run manually, first ensure the workflow is on the default branch, then open
**Actions > the selected deployment workflow > Run workflow** and select the
repository's **default branch** in the branch dropdown. Dispatching the other
workflow does not override `DEPLOY_TARGET`. Changing the variable alone does not
trigger a run; push to the default branch or dispatch its workflow.

The deploy jobs use separate GitHub environments and concurrency groups:
`github-pages` and `azure-static-web-apps`. Deployments to each target are
serialized without cancelling an in-progress deployment. Skipped feature-branch
runs do not cancel production deployments. Builds can run concurrently; Actions
does not guarantee the ordering of queued deployments.

Create and protect the selected environment in **Settings > Environments**
before the first run. Restrict its **Deployment branches and tags** to the
default branch, and configure required reviewers where your GitHub plan
supports them. Update that branch rule after a default-branch rename. The YAML
references the environment but does not configure approvals or branch rules;
an automatically created environment has no protection rules. Environment and
reviewer availability varies by plan and repository visibility; see
[GitHub's environment setup guidance](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments).
Protect workflow changes with repository review rules as well.

Selecting a different target or `none` does not unpublish an existing site,
revoke its access, or stop an already running deployment. Before switching,
finish or cancel pending runs and review whether the old site should remain
accessible. Neither workflow enables Pages, changes site visibility, or creates
Azure resources.

## Shared build contract and local configuration

Each deployment build uses Bun and the committed lockfile:

```sh
bun install --frozen-lockfile
bun run validate
bun run marketplace:check
bun run build
```

Validation and catalog synchronization must pass before the build and upload.
Deployment never regenerates the catalog to conceal a stale commit. Correct
`marketplace.config.json` or manifests locally, run `bun run marketplace`, and commit the regenerated catalog
before retrying. There is no npm, yarn, pnpm, or Oryx build in either path.

**Configure customer identity before deployment.** Set
`marketplace.config.json.repository` to your actual GitHub `owner/repository`,
not the website URL. Configure the company, title, description and optional
logos in the same file, then run `bun run marketplace`. The
[customization guide](customization.md) has the full settings mapping and
logo rules. For example, after placing an approved logo at
`public/branding/acme.svg`:

```sh
bun run setup --organization Acme --repository acme/copilot-marketplace --name acme-tools --logo branding/acme.svg
```

Setup saves the config and regenerates both catalogs without changing plugin
repository URLs or deployment settings. It does not provision resources.

Both workflows set `PUBLIC_MARKETPLACE_REPO: ${{ github.repository }}` on the
build step so installation snippets and repository links identify the
customer's repository. This is a **non-secret, build-time `owner/repository`
value**, not the website URL. It does not require an Actions secret or a separate
repository variable. The override does **not** change the config, registration
key, or generated catalog metadata: keep the checked-in config consistent with
the real repository first. Never put credentials in `PUBLIC_*` values: they
may be included in browser-delivered files.

Local development and builds default to the repository in the config; no
`PUBLIC_MARKETPLACE_REPO` override is needed. For example, in PowerShell:

```powershell
$env:BASE_PATH = "/"
bun run dev
```

Only set `$env:PUBLIC_MARKETPLACE_REPO = "acme/alternate-marketplace"` when you
intentionally want build-time links/snippets to point somewhere else. It
cannot fix catalog identity or substitute for `marketplace.config.json`.

Run `bun run build` in that shell for the corresponding production build.
For a local Pages subpath check, set `BASE_PATH` to your repository path, such
as `/acme-marketplace/`, before building. Logo config paths remain
`branding/acme.svg`, without this prefix: the site adds the build base to local
assets and links. The same config supports root hosting and Pages subpaths.
Restart the dev server or rebuild after changing these values.

The Pages workflow obtains `BASE_PATH` from `actions/configure-pages` so
repository sites, root sites, and configured custom domains use the Pages
metadata rather than an assumed path. The Azure workflow explicitly builds
with `BASE_PATH=/`. Do not upload a Pages-subpath build to Azure unchanged.

## GitHub Pages setup

GitHub Pages is available for public repositories on GitHub Free, and for
private repositories on supported paid plans such as Pro, Team, and Enterprise.
**Publishing from a private repository is not the same as private hosting.**
On GitHub.com, private Pages access control requires GitHub Enterprise Cloud
and an organization-owned project site published from a private or internal
repository; it is not available for an organization site. Enterprise Managed
Users have additional visibility restrictions. Check your enterprise policy
and [GitHub's Pages visibility documentation](https://docs.github.com/en/enterprise-cloud@latest/pages/getting-started-with-github-pages/changing-the-visibility-of-your-github-pages-site).

1. Review the catalog's audience, your Pages plan, and the permitted site
   visibility. Keep deployment disabled with `DEPLOY_TARGET=none` until ready.
2. In **Settings > Pages**, choose **GitHub Actions** as the build and deployment
   source. Explicitly select the required site visibility where available.
   If private Pages is unavailable, do not publish sensitive content there.
3. Configure the `github-pages` environment and its default-branch restriction
   and required reviewers as described above.
4. Set the repository variable `DEPLOY_TARGET` to `github-pages`. Leaving it
   unset also selects Pages, but an explicit value is clearer for a new setup.
5. Push the configured site to the default branch or dispatch the Pages workflow
   on that branch. Approve the deployment if the environment requires it.
   The workflow's deployment environment links to the published site.

The workflow uses the built-in GitHub token and Pages OIDC permissions; no
personal access token is needed. `actions/configure-pages` has
`enablement: false`, so an unconfigured Pages site fails rather than being
silently enabled. Build and deploy permissions are scoped to their jobs.

## Azure Static Web Apps setup

Prerequisites are an Azure subscription, permission to create or use the
chosen Static Web Apps resource, and permission to configure the GitHub
repository's variables, secrets, and environment. Resource creation and any
associated billing are customer setup steps, not actions performed by this
workflow.

1. Keep `DEPLOY_TARGET=none` while preparing the resource and reviewing
   visibility. Choose explicitly whether this will be a public, nonsensitive
   site or a tenant-restricted internal site. The latter requires the additional
   setup below **before any sensitive catalog is deployed**.
2. In the Azure portal, create a **Static Web App** with the intended
   subscription, resource group, name, hosting plan, and region. Under
   **Deployment details**, choose **Source: Other**, not GitHub. This is the
   [documented custom pipeline setup](https://learn.microsoft.com/azure/static-web-apps/external-providers)
   and avoids generating a second repository workflow. Select **Azure deployment
   token** as the deployment authorization policy. For an existing app, check
   **Settings > Configuration > Deployment configuration** for that policy.
   Free can host a public static catalog; custom authentication requires
   **Standard**.
3. After the resource is ready, open its **Overview > Manage deployment token**
   and copy the token for that specific app. In GitHub, configure the
   `azure-static-web-apps` environment, restrict it to the default branch, and
   configure required reviewers where supported.
4. Add an **environment secret** named exactly
   `AZURE_STATIC_WEB_APPS_API_TOKEN` to `azure-static-web-apps`, containing that
   app's deployment token. A repository Actions secret with the same name also
   works, but has broader availability; prefer the protected environment.
   The deployment action alone receives this secret, never the Bun build or
   a `PUBLIC_*` environment variable. Do not paste it into source, logs,
   `staticwebapp.config.json`, or local frontend configuration.
5. If the app was previously connected through the portal's GitHub integration,
   review and disable or remove its generated
   `azure-static-web-apps-<random-name>.yml` workflow before enabling this one.
   Keep only this template's deployment workflow active for that app. A second
   portal-generated workflow can independently deploy or rebuild with Oryx/npm,
   regardless of this template's selector.
6. Complete the chosen access controls, then set the repository variable
   `DEPLOY_TARGET=azure`. Push to the default branch or dispatch
   **Deploy marketplace to Azure Static Web Apps** on that branch, and approve
   its environment deployment if required. Use the URL recorded on the
   `azure-static-web-apps` deployment environment.

The build job uploads a `dist/` artifact; the deploy job downloads that exact
artifact from the same workflow run. `Azure/static-web-apps-deploy@v1` uploads
it with `app_location: dist`, `skip_app_build: true`, and
`output_location: ""`, following the
[prebuilt deployment contract](https://learn.microsoft.com/azure/static-web-apps/build-configuration#skip-building-front-end-app).
`api_location: ""` and `skip_api_build: true` ensure no API build or deployment.
`production_branch` comes from the repository's default branch. There is no
Azure login, service-principal secret, OIDC setup, or Oryx/npm rebuild.
A missing deployment token is an error, not a successful no-op. If the token
is reset, update the same GitHub secret before retrying; see
[deployment token management](https://learn.microsoft.com/azure/static-web-apps/deployment-token-management).

### Tenant-restricted Entra option: separate, required setup for internal Azure hosting

The Azure workflow does **not** configure this option. A sign-in button or the
built-in `authenticated` role alone does not restrict access to your tenant.
The preconfigured Microsoft Entra provider permits any Microsoft account to
sign in, and the preconfigured GitHub provider is also enabled by default; see
[authentication defaults](https://learn.microsoft.com/azure/static-web-apps/authentication-authorization).

For an approved internal deployment, have your identity/site administrator use
the **Standard** plan and complete Microsoft's
[custom Microsoft Entra provider configuration](https://learn.microsoft.com/azure/static-web-apps/authentication-custom?tabs=aad).
Use a single-tenant app registration and the intended tenant-specific
`openIdIssuer`, not `common` or `organizations`. Configure the documented
callback URLs and any user/group assignment restrictions required by your
policy. Custom registration disables the preconfigured providers; do not add
another provider that would bypass the intended audience restrictions.

Store identity-provider credentials in Azure application settings or approved
secret references, not the repository or frontend build. Add the reviewed
provider and authorization configuration in `public/staticwebapp.config.json`;
Astro copies it to the root of `dist/`, where the prebuilt deployment action
expects it. This template deliberately supplies no partial authentication
sample or identity application.

Authorization must protect **all content routes** using an appropriate
catch-all route rule, not just the homepage or `/plugins/*`. This includes
`/marketplace.json`, generated HTML and direct `index.html` URLs, scripts,
images, and other assets. Configure the authentication endpoints and redirects
according to the linked guidance without opening content exceptions. Hiding
cards, protecting only a sign-in page, or excluding JSON/assets from protection
does not secure the catalog.

Validate with nonsensitive content first: an anonymous visitor and a user
outside the intended tenant must not retrieve protected pages, JSON, or assets;
an authorized user must be able to load them and follow plugin deep links.
Review guest access and assignment policy as part of defining the audience.
Only then approve deployment of the sensitive catalog.

## Multi-page routing and post-deployment checks

Astro generates real files such as `dist/plugins/<name>/index.html`.
GitHub Pages and Azure Static Web Apps serve directory index files, so
`/plugins/<name>/` works on a fresh navigation, not only after visiting the
homepage. On Pages the URL includes the configured base path. Azure's
[default index-file handling](https://learn.microsoft.com/azure/static-web-apps/configuration#trailing-slash)
also serves `/plugins/<name>` without a fallback rewrite.

No `public/staticwebapp.config.json` is needed for this default public hosting
profile. If you add one for the reviewed authentication setup, keep it in
`public/` so it reaches `dist/`. Do not add `navigationFallback` or a catch-all
rewrite to `/index.html`: that would turn missing plugin pages into the
homepage instead of preserving the multi-page site's URLs and 404 behavior.
Azure configuration is not interpreted by GitHub Pages; Pages access controls
must be configured in GitHub itself.

After your first authorized deployment, verify the homepage, a direct plugin
URL and browser refresh, assets, `marketplace.json`, and installation snippets.
Check a nonexistent plugin URL returns 404, and repeat audience/access checks
against direct content URLs. Local build success is not evidence that live
hosting, custom domains, approvals, or authentication have been verified.
