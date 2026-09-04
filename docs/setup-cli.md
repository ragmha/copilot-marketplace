# Copilot CLI setup

## Add the marketplace

```sh
copilot plugin marketplace add your-org/copilot-marketplace
```

The argument is `OWNER/REPO`, **not** a URL. A full git URL is only for hosts
other than github.com; a filesystem path works for a local marketplace.

## Browse and install

```sh
copilot plugin marketplace list                    # marketplaces you have added
copilot plugin marketplace browse copilot-marketplace
copilot plugin install release-captain@copilot-marketplace
```

Inside an interactive session the same commands exist as slash commands, e.g.
`/plugin install release-captain@copilot-marketplace`.

## Manage

```sh
copilot plugin list
copilot plugin update release-captain
copilot plugin uninstall release-captain
```

## Remove the marketplace

```sh
copilot plugin marketplace remove copilot-marketplace
```

Takes the **marketplace name**, not `OWNER/REPO`. Add `--force` if plugins from
it are still installed.

## Troubleshooting

**"marketplace not found"** — the repository must be readable by your account
and must have `.github/plugin/marketplace.json` on its default branch.

**A plugin installs but does nothing** — plugin content lives in the plugin's own
repository, listed as `repository` in the catalog. Check that repository is
readable by you too.

**Changes not showing up** — re-run `copilot plugin marketplace browse` to
refresh, and `copilot plugin update <name>` for an installed plugin.
