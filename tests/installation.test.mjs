import { expect, test } from "bun:test";
import { createInstallGuides } from "../src/lib/installation.ts";

const identity = { name: "acme-tools", repository: "acme/copilot-marketplace" };

test("installation methods are exactly APM, Copilot CLI, and VS Code", () => {
  expect(createInstallGuides(identity).map((guide) => guide.label)).toEqual(["APM", "Copilot CLI", "VS Code"]);
});

test("APM registers the custom name and uses the catalog instead of installing the registry repo", () => {
  const apm = createInstallGuides(identity, "fabric-skills")[0];
  expect(apm.primary.code).toBe(
    "apm marketplace add acme/copilot-marketplace --name acme-tools --ref HEAD\napm install fabric-skills@acme-tools --target copilot",
  );
  expect(apm.primary.code).not.toContain("apm install acme/copilot-marketplace");
});

test("CLI instructions register and install the selected plugin", () => {
  expect(createInstallGuides(identity, "powerbi-authoring")[1].primary.code).toBe(
    "copilot plugin marketplace add acme/copilot-marketplace\ncopilot plugin install powerbi-authoring@acme-tools",
  );
});

test("VS Code settings use the adopter identity and only the requested plugin", () => {
  const settings = JSON.parse(createInstallGuides(identity, "fabric-skills")[2].primary.code);
  expect(settings.extraKnownMarketplaces).toEqual({
    "acme-tools": { source: { source: "github", repo: "acme/copilot-marketplace" } },
  });
  expect(settings.enabledPlugins).toEqual({ "fabric-skills@acme-tools": true });
});

test("marketplace quickstart does not enable a sample plugin", () => {
  const guides = createInstallGuides(identity);
  expect(guides[0].primary.code).toContain("apm marketplace browse acme-tools");
  expect(guides[1].primary.code).toContain("copilot plugin marketplace browse acme-tools");
  expect(JSON.parse(guides[2].primary.code).enabledPlugins).toBeUndefined();
  expect(JSON.stringify(guides)).not.toContain("release-captain");
});
