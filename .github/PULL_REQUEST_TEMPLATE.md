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
