## What changed

<!-- One or two sentences. -->

## Checklist

- [ ] `bun run validate` passes
- [ ] `bun run marketplace:check` passes (generated files are committed)
- [ ] `bun run build` passes

### Adding or changing a plugin

- [ ] The manifest lives at `plugins/<name>/plugin.json` and `name` matches the directory
- [ ] `repository` points at the plugin's own repository, not this one
- [ ] `directory.updated` is today's date
- [ ] I regenerated the catalog with `bun run marketplace` rather than editing it by hand

#### Security and supply-chain review

- [ ] I reviewed the linked repository and the pinned commit, not only the manifest
- [ ] I checked hooks and exactly what they run
- [ ] I reviewed MCP launch commands, especially unpinned `npx -y <package>@latest`, `uvx`, shell scripts, and downloaded binaries
- [ ] I reviewed remote endpoints and the data sent to them
- [ ] I reviewed telemetry and its opt-out or consent behavior
- [ ] I reviewed authentication, permissions, and secret handling
- [ ] `source.sha` points at a reviewed commit
