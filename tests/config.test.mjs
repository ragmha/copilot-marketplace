import { afterEach, describe, expect, test } from "bun:test";
import {
  existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig, repoRoot, validateConfig } from "../scripts/lib/config.mjs";
import {
  buildMarketplace, loadPlugins, pathsFor, serialize, writeMarketplace,
} from "../scripts/lib/marketplace.mjs";
import { parseSetupArgs, setup } from "../scripts/setup.mjs";

const roots = new Set();
const template = {
  name: "copilot-marketplace",
  repository: "your-org/copilot-marketplace",
  version: "1.0.0",
  owner: { name: "Developer Experience", email: "copilot-marketplace@example.com" },
  branding: {
    organization: "Your organization",
    title: "Copilot Marketplace",
    description: "Internal Copilot plugins for everyday engineering workflows.",
  },
};
const acmeArgs = [
  "--organization", "Acme",
  "--repository", "acme/copilot-marketplace",
  "--name", "acme-tools",
];

function fixture(config = structuredClone(template)) {
  const root = mkdtempSync(join(tmpdir(), "marketplace-config-"));
  roots.add(root);
  mkdirSync(join(root, "public", "branding"), { recursive: true });
  writeFileSync(pathsFor(root).configFile, serialize(config));
  for (const [name, repository] of [
    ["release-captain", "https://github.com/your-org/release-captain"],
    ["partner-tools", "https://github.com/third-party/partner-tools"],
  ]) {
    const dir = join(root, "plugins", name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "plugin.json"), serialize({
      name,
      description: `${name} test plugin`,
      version: "1.0.0",
      author: { name: "Plugin maintainer" },
      repository,
      category: "Delivery",
      directory: { type: "plugin", updated: "2026-09-01" },
    }));
  }
  writeMarketplace(buildMarketplace(config, root), root);
  return root;
}

function addLogo(root, path = "branding/acme.svg") {
  writeFileSync(join(root, "public", ...path.split("/")), "local asset fixture");
  return path;
}

function snapshot(root) {
  const paths = pathsFor(root);
  return [paths.configFile, paths.marketplaceFile, paths.siteCopy]
    .map((path) => readFileSync(path, "utf8"));
}

afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots.clear();
});

test("plugin art always uses two distinct valid chart tokens, including high-bit hashes", async () => {
  const build = await Bun.build({
    entrypoints: [join(repoRoot, "src", "lib", "marketplace.ts")],
    target: "bun",
    define: {
      "import.meta.env.BASE_URL": '"/"',
      "import.meta.env.PUBLIC_MARKETPLACE_REPO": '""',
    },
  });
  expect(build.success).toBe(true);
  const source = Buffer.from(await build.outputs[0].text()).toString("base64");
  const { pluginArt } = await import(`data:text/javascript;base64,${source}`);
  const names = [
    ...loadPlugins().map((plugin) => plugin.slug),
    ...Array.from({ length: 128 }, (_, index) => `plugin-art-${index}`),
  ];
  for (const name of names) {
    const art = pluginArt(name);
    const tokens = /^linear-gradient\(\d+deg, var\(--chart-([1-5])\), var\(--chart-([1-5])\)\)$/.exec(art.gradient);
    expect(tokens).not.toBeNull();
    expect(tokens[1]).not.toBe(tokens[2]);
    expect(art).toEqual(pluginArt(name));
  }
});

describe("validated customer configuration", () => {
  test("loads a config without logos from an explicit root", () => {
    const root = fixture();
    expect(loadConfig(root)).toEqual(template);
    expect(loadConfig(root).branding.logo).toBeUndefined();
    expect(loadConfig(root).branding.logoDark).toBeUndefined();
  });

  test("generates Acme identity from config, never the old catalog", () => {
    const root = fixture();
    const config = {
      ...template,
      name: "acme-tools",
      repository: "Acme/engineering-marketplace",
      version: "2.3.4-rc.1+build.7",
      owner: { name: "Acme Developer Experience", email: "engineering@acme.com" },
      branding: {
        organization: "Acme",
        title: "Acme Marketplace",
        description: "Approved Acme engineering tools.",
      },
    };
    writeFileSync(pathsFor(root).configFile, serialize(config));
    const catalog = buildMarketplace(undefined, root);
    expect(catalog.name).toBe("acme-tools");
    expect(catalog.owner).toEqual(config.owner);
    expect(catalog.metadata).toEqual({
      repository: "https://github.com/Acme/engineering-marketplace",
      version: "2.3.4-rc.1+build.7",
      description: "Approved Acme engineering tools.",
    });
    writeMarketplace(catalog, root);
    const [, canonical, publicCopy] = snapshot(root);
    expect(canonical).toBe(publicCopy);
    expect(JSON.parse(canonical)).toEqual(catalog);
  });

  test.each([
    { logo: "branding/acme.svg" },
    { logo: "branding/acme.png" },
    { logo: "branding/acme.jpeg", logoDark: "branding/acme-dark.webp" },
    { logo: "branding/acme.JPG", logoDark: "branding/acme-dark.SVG" },
    { logoDark: "branding/acme-dark.svg" },
  ])("accepts optional local logo variants %j", (logos) => {
    const root = fixture();
    for (const path of Object.values(logos)) addLogo(root, path);
    const config = { ...template, branding: { ...template.branding, ...logos } };
    expect(validateConfig(config, root).branding).toEqual(config.branding);
  });

  test.each([
    "https://github.com/acme/tools", "acme", "acme/tools/extra", "acme\\tools",
    "/acme/tools", "acme/..", "acme/.", "../tools", "acme/tools?x", "acme/tools\n",
  ])("rejects invalid repository %j", (repository) => {
    expect(() => validateConfig({ ...template, repository })).toThrow("/repository");
  });

  test.each(["Acme-tools", "acme_tools", "acme tools", "-acme", "acme--tools", "", "a".repeat(65), "acme\n"])(
    "rejects invalid marketplace key %j",
    (name) => expect(() => validateConfig({ ...template, name })).toThrow("/name"),
  );

  test.each(["1.2", "01.2.3", "1.2.3-01", "1.2.3-", "1.2.3+a..b", "v1.2.3", "1.2.3\n"])(
    "rejects invalid semantic version %j",
    (version) => expect(() => validateConfig({ ...template, version })).toThrow("/version"),
  );

  test.each([
    "https://example.com/acme.svg", "data:image/svg+xml,logo", "//example.com/acme.svg",
    "/branding/acme.svg", "C:/branding/acme.svg", "branding\\acme.svg",
    "../acme.svg", "branding/../acme.svg", "./branding/acme.svg", "branding//acme.svg",
    "branding/%2e%2e/acme.svg", "branding/%252e%252e/acme.svg",
    "branding/%2E%2E%2Facme.svg", "branding/%5c..%5cacme.svg", "%2fbranding/acme.svg",
    "branding/acme.svg?v=1", "branding/acme.svg#logo", "branding/acme.svg%3fversion=1",
    "branding/acme.svg\n", "branding/acme.gif", "branding/acme.html",
  ])("rejects unsafe or unsupported logo path %j", (logo) => {
    expect(() => validateConfig({
      ...template,
      branding: { ...template.branding, logo },
    })).toThrow("/branding/logo");
  });

  test("rejects missing logos and directories masquerading as files", () => {
    const root = fixture();
    for (const field of ["logo", "logoDark"]) {
      expect(() => validateConfig({
        ...template,
        branding: { ...template.branding, [field]: "branding/missing.svg" },
      }, root)).toThrow(`Place a readable logo file at ${join(root, "public", "branding", "missing.svg")}`);
    }
    mkdirSync(join(root, "public", "branding", "folder.svg"));
    expect(() => validateConfig({
      ...template,
      branding: { ...template.branding, logo: "branding/folder.svg" },
    }, root)).toThrow("not a file");
  });

  test("rejects a logo directory link escaping public", () => {
    const root = fixture();
    const outside = join(root, "outside");
    mkdirSync(outside);
    writeFileSync(join(outside, "acme.svg"), "outside asset");
    symlinkSync(outside, join(root, "public", "linked"), process.platform === "win32" ? "junction" : "dir");
    expect(() => validateConfig({
      ...template,
      branding: { ...template.branding, logo: "linked/acme.svg" },
    }, root)).toThrow("resolves outside public/");
  });

  test("rejects unknown config fields and invalid email", () => {
    expect(() => validateConfig({ ...template, unexpected: true })).toThrow("additional properties");
    expect(() => validateConfig({
      ...template, branding: { ...template.branding, remoteLogo: "https://example.com/logo.svg" },
    })).toThrow("additional properties");
    expect(() => validateConfig({
      ...template, owner: { name: "Acme", email: "not-an-email" },
    })).toThrow("/owner/email");
  });

  test("reports malformed and missing config files explicitly", () => {
    const root = fixture();
    writeFileSync(pathsFor(root).configFile, "{");
    expect(() => loadConfig(root)).toThrow("Invalid JSON");
    rmSync(pathsFor(root).configFile);
    expect(() => loadConfig(root)).toThrow("Cannot read");
  });
});

describe("noninteractive setup", () => {
  test("writes the Acme config and both catalogs without rewriting plugin repositories", () => {
    const root = fixture();
    const originals = loadPlugins(root).map((plugin) => readFileSync(plugin.manifestPath, "utf8"));
    addLogo(root);
    addLogo(root, "branding/acme-dark.svg");
    const { config, marketplace, removedOwnerEmail } = setup([
      ...acmeArgs, "--title", "Acme Engineering",
      "--logo", "branding/acme.svg", "--logo-dark", "branding/acme-dark.svg",
    ], root);
    expect(config).toEqual({
      ...template,
      name: "acme-tools",
      repository: "acme/copilot-marketplace",
      owner: { name: "Acme" },
      branding: {
        ...template.branding,
        organization: "Acme",
        title: "Acme Engineering",
        logo: "branding/acme.svg",
        logoDark: "branding/acme-dark.svg",
      },
    });
    expect(removedOwnerEmail).toBe(true);
    expect(loadConfig(root)).toEqual(config);
    const [, canonical, publicCopy] = snapshot(root);
    expect(canonical).toBe(publicCopy);
    expect(JSON.parse(canonical)).toEqual(marketplace);
    expect(marketplace.plugins.map((plugin) => plugin.repository)).toEqual([
      "https://github.com/third-party/partner-tools",
      "https://github.com/your-org/release-captain",
    ]);
    expect(marketplace.plugins.map((plugin) => plugin.source.repo)).toEqual([
      "third-party/partner-tools", "your-org/release-captain",
    ]);
    expect(loadPlugins(root).map((plugin) => readFileSync(plugin.manifestPath, "utf8"))).toEqual(originals);
  });

  test("defaults title and preserves the key, version, description and reviewed email", () => {
    const root = fixture({
      ...template,
      name: "existing-key",
      version: "3.0.0",
      owner: { name: "Developer Experience", email: "developer-experience@acme.com" },
    });
    const { config } = setup(["--organization", "Acme", "--repository", "acme/tools"], root);
    expect(config.name).toBe("existing-key");
    expect(config.version).toBe("3.0.0");
    expect(config.branding.title).toBe("Acme Marketplace");
    expect(config.branding.description).toBe(template.branding.description);
    expect(config.owner.email).toBe("developer-experience@acme.com");
  });

  test.each([
    { args: ["--organization", "Acme", "--repository", "https://github.com/acme/tools"], error: "/repository" },
    { args: ["--organization", "Acme", "--repository", "acme/tools", "--name", "Bad Key"], error: "/name" },
    { args: [...acmeArgs, "--logo", "branding/missing.svg"], error: "/branding/logo" },
    { args: [...acmeArgs, "--logo", "branding/../acme.svg"], error: "/branding/logo" },
    { args: [...acmeArgs, "--logo-dark", "branding/missing-dark.svg"], error: "/branding/logoDark" },
  ])("prevalidation leaves all existing files unchanged for %j", ({ args, error }) => {
    const root = fixture();
    const before = snapshot(root);
    expect(() => setup(args, root)).toThrow(error);
    expect(snapshot(root)).toEqual(before);
  });

  test("missing dark logo does not write a valid light-logo candidate", () => {
    const root = fixture();
    addLogo(root);
    const before = snapshot(root);
    expect(() => setup([
      ...acmeArgs, "--logo", "branding/acme.svg", "--logo-dark", "branding/missing.svg",
    ], root)).toThrow("/branding/logoDark");
    expect(snapshot(root)).toEqual(before);
  });

  test("invalid plugin JSON is discovered before writing the config", () => {
    const root = fixture();
    writeFileSync(join(root, "plugins", "release-captain", "plugin.json"), "{");
    const before = snapshot(root);
    expect(() => setup(acmeArgs, root)).toThrow("Invalid JSON");
    expect(snapshot(root)).toEqual(before);
  });

  test("protects configured identities, including an identical repeated invocation", () => {
    const root = fixture();
    setup(acmeArgs, root);
    const before = snapshot(root);
    expect(() => setup(acmeArgs, root)).toThrow("--force");
    expect(snapshot(root)).toEqual(before);
    const { config } = setup([
      "--organization", "Contoso", "--repository", "contoso/tools", "--force",
    ], root);
    expect(config.branding.title).toBe("Contoso Marketplace");
    expect(config.name).toBe("acme-tools");
    expect(config.repository).toBe("contoso/tools");
    expect(snapshot(root)[1]).toBe(snapshot(root)[2]);
  });

  test("keeps reviewed email for the same company but clears it for a different company", () => {
    const root = fixture({
      ...template,
      repository: "acme/tools",
      owner: { name: "Acme", email: "platform@acme.com" },
      branding: { ...template.branding, organization: "Acme" },
    });
    expect(setup([...acmeArgs, "--force"], root).config.owner.email).toBe("platform@acme.com");
    expect(setup([
      "--organization", "Contoso", "--repository", "contoso/tools", "--force",
    ], root).config.owner.email).toBeUndefined();
  });

  test("preserves optional logo fields that are not supplied again", () => {
    const root = fixture();
    addLogo(root);
    addLogo(root, "branding/acme-dark.svg");
    setup([
      ...acmeArgs, "--logo", "branding/acme.svg", "--logo-dark", "branding/acme-dark.svg",
    ], root);
    const { config } = setup([...acmeArgs, "--force"], root);
    expect(config.branding.logo).toBe("branding/acme.svg");
    expect(config.branding.logoDark).toBe("branding/acme-dark.svg");
  });

  test.each(["contact@EXAMPLE.COM", "contact@sub.example.org", "contact@acme.test", "contact@acme.invalid"])(
    "removes placeholder email %s",
    (email) => {
      const root = fixture({ ...template, owner: { name: "Template", email } });
      expect(setup(acmeArgs, root).config.owner.email).toBeUndefined();
    },
  );

  test("help does not need a config or write any files", () => {
    const root = mkdtempSync(join(tmpdir(), "marketplace-config-"));
    roots.add(root);
    expect(setup(["--help"], root).help).toContain("--logo-dark");
    expect(existsSync(pathsFor(root).configFile)).toBe(false);
    expect(existsSync(pathsFor(root).marketplaceFile)).toBe(false);
  });

  test.each([
    [], ["--organization", "Acme"], ["--repository", "acme/tools"],
    ["--organization"], ["--organization", "--repository", "acme/tools"],
    ["--organization", " ", "--repository", "acme/tools"],
    [...acmeArgs, "--unknown"], [...acmeArgs, "--organization", "Other"],
    [...acmeArgs, "--force", "--force"], ["--help", "--help"],
    [...acmeArgs, "--logo"], [...acmeArgs, "extra"], ["--organization=Acme"],
  ].map((args) => ({ args })))("rejects missing, unknown or duplicate arguments %j", ({ args }) => {
    expect(() => parseSetupArgs(args)).toThrow();
  });
});
