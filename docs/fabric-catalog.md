# Microsoft Fabric packages

The catalog includes the two active native plugin bundles published by
[Microsoft Skills for Fabric](https://github.com/microsoft/skills-for-fabric).
Their content is not copied into this repository.

| Entry | Skills | Agents | MCP configurations |
| --- | --- | --- | --- |
| `fabric-skills` | 23 | 4 | 3 |
| `powerbi-authoring` | 5 | 0 | 1 |

The bundles contain 27 distinct skills; `semantic-model-authoring` appears in
both. Deprecated aliases are not registered as additional packages. Native
plugin installation installs an entire bundle, not an individual skill.

## Source snapshot

Both entries record upstream version `0.3.16` at commit
`24cc0d296e5e8523cc6a92e1342bc1791d7deb85`. Each source points to its actual
`plugins/<name>` directory, not the repository root. `sha` pins Copilot's source;
`ref` carries the same commit for consumers that use Git refs.

The component names and paths come from that commit's plugin manifests and
package tree. The site lists every bundled skill, agent, and MCP configuration,
links to the pinned source files, and includes component names in catalog search.
These are source inventories, not security audit results.

Review the upstream README and MCP setup instructions before installation.
Fabric access and authentication are required for live resource operations.
The Power BI package launches its modeling MCP using
`@microsoft/powerbi-modeling-mcp@latest`; pinning the repository does **not**
pin that separately acquired runtime dependency.

## Updating

Review a new upstream release, then update the version, commit fields, component
inventory, counts, and prerequisites in each local registry manifest. Run
`bun run marketplace`, `bun run validate`, and the tests. Do not edit the
generated catalog directly or silently follow the upstream default branch.

APM is an optional installation method in the site. Its tab consumes the
configured marketplace and named bundle; it does not install this registry
repository as if it contained skill implementations. Upstream's separate
single-skill APM workflow is documented in its README and has additional
scope/MCP behavior; it is not presented here as a native per-skill plugin install.
