import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { addAttribute } from "astro/runtime/server/index.js";
import { buildEntry, repoRoot, sourceFor } from "../scripts/lib/marketplace.mjs";
import { validateSubmission } from "../src/lib/submission.ts";

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const manifest = read("./fixtures/acme/plugins/release-captain/plugin.json");
const pluginSchema = read("../schemas/plugin.schema.json");
const ajv = new Ajv({ allErrors: true, allowUnionTypes: true, strict: false });
addFormats(ajv);
const validatePlugin = ajv.compile(pluginSchema);
const validateMarketplace = ajv.compile(read("../schemas/marketplace.schema.json"));
const entry = buildEntry({ slug: manifest.name, manifest });
const catalog = (plugin) => ({ name: "security-tests", owner: { name: "Tests" }, plugins: [plugin] });

const build = await Bun.build({
  entrypoints: [join(repoRoot, "src", "lib", "marketplace.ts")],
  target: "bun",
  define: {
    "import.meta.env.BASE_URL": '"/"',
    "import.meta.env.PUBLIC_MARKETPLACE_REPO": '""',
  },
});
if (!build.success) throw new AggregateError(build.logs, "Could not load marketplace rendering helpers.");
const code = Buffer.from(await build.outputs[0].text()).toString("base64");
const { normalize, pluginSourceHref } = await import(`data:text/javascript;base64,${code}`);
const plugin = normalize(catalog(entry))[0];

const unsafeRepositories = [
  "javascript:void(0)",
  "JaVaScRiPt:void(0)",
  "java\nscript:void(0)",
  "data:text/html,<p>inert</p>",
  "http://example.test/plugin",
  "file:///tmp/plugin",
  "//example.test/plugin",
  "https:example.test/plugin",
  "https://",
  "https://reviewer:example@example.test/plugin",
  "https://reviewer@example.test/plugin",
  "https://@example.test/plugin",
  "https://example.test\\@untrusted.test/plugin",
  "https://example.test/plugin\n",
  " https://example.test/plugin",
];

test("both schemas reject executable, credentialed, and malformed repository URLs", () => {
  for (const repository of unsafeRepositories) {
    expect(validatePlugin({ ...manifest, repository })).toBe(false);
    expect(validateMarketplace(catalog({ ...entry, repository }))).toBe(false);
    expect(validateMarketplace(catalog({ ...entry, source: repository }))).toBe(false);
  }
});

test("generation rejects unsafe repositories even with an explicit GitHub source", () => {
  for (const repository of unsafeRepositories) {
    for (const source of [undefined, { source: "github", repo: "acme/plugin" }]) {
      const invalid = { ...manifest, repository, source };
      expect(() => sourceFor(invalid)).toThrow(/HTTPS/);
      expect(() => buildEntry({ slug: manifest.name, manifest: invalid })).toThrow(/HTTPS/);
    }
  }
});

test("Source links fail explicitly instead of rendering unsafe repository URLs", () => {
  for (const repository of unsafeRepositories) {
    for (const source of [
      undefined,
      "https://example.test/plugin",
      { source: "github", repo: "acme/plugin" },
      { source: "github", repo: "acme/plugin", ref: "main", path: "plugins/tools" },
    ]) {
      expect(() => pluginSourceHref({ ...plugin, repository, source })).toThrow(/HTTPS/);
    }
  }
});

test("submission validation uses the same repository URL boundary", () => {
  const draft = {
    name: "Review tool", slug: "review-tool", kind: "plugin", description: "Review changes.",
    instructions: "", author: "", category: "", version: "", acknowledged: true,
  };
  for (const repository of unsafeRepositories) {
    expect(validateSubmission({ ...draft, repository }, ["plugin"], [])
      .some((error) => error.field === "repository")).toBe(true);
  }
});

test.each([
  "https://github.com/acme/plugin",
  "https://github.com/acme/plugin.git",
  "HTTPS://github.com/acme/plugin",
  "https://example.test:8443/team/plugin.git",
  "https://example.test/team/plugin?ref=main&compare=base#readme",
  "https://example.test/@team/plugin",
])("valid repository URL stays usable: %s", (repository) => {
  const candidate = { ...manifest, repository };
  expect(validatePlugin(candidate)).toBe(true);
  const generated = buildEntry({ slug: manifest.name, manifest: candidate });
  expect(validateMarketplace(catalog(generated))).toBe(true);
  expect(pluginSourceHref({ ...plugin, repository, source: generated.source })).toBe(repository);
});

test("GitHub source detection does not turn query strings into repository names", () => {
  const repository = "https://github.com/acme/plugin?ref=main&compare=base";
  expect(sourceFor({ repository })).toBe(repository);
  expect(sourceFor({ repository: "https://github.com/acme/plugin.git/" })).toEqual({
    source: "github", repo: "acme/plugin",
  });
});

test("pinned packages and component links preserve the existing source location", () => {
  const source = {
    source: "github", repo: "acme/bundles", path: "plugins/tools",
    sha: "a".repeat(40), ref: "feature/review",
  };
  const pinned = { ...plugin, source };
  expect(pluginSourceHref(pinned)).toBe(`https://github.com/acme/bundles/tree/${source.sha}/plugins/tools`);
  expect(pluginSourceHref(pinned, { name: "review", kind: "skill", path: "skills/review/SKILL.md" }))
    .toBe(`https://github.com/acme/bundles/blob/${source.sha}/plugins/tools/skills/review/SKILL.md`);
  expect(pluginSourceHref({ ...pinned, source: { ...source, sha: undefined } }))
    .toBe("https://github.com/acme/bundles/tree/feature%2Freview/plugins/tools");
});

test.each(["content", "href", "data-search", "title"])("Astro keeps URL-like %s values inside their attribute", async (key) => {
  for (const value of [
    'https://example.test/?x=&"><script type="application/json" data-security-probe="attribute">"inert"</script><meta data-rest="',
    'http://example.test/?x=&" data-security-probe="attribute',
    'HTTPS://example.test/?q=&quot;&copy=1&name="release notes"',
    'Ordinary "quoted" text & literal &quot; entities',
  ]) {
    const values = [];
    const unexpectedElements = [];
    const response = new HTMLRewriter()
      .on("div", { element(element) { values.push(element.getAttribute(key)); } })
      .on("[data-security-probe]", { element(element) { unexpectedElements.push(element.tagName); } })
      .transform(new Response(`<div${addAttribute(value, key)}></div>`));
    await response.text();
    // HTMLRewriter returns raw attribute entities; the browser suite checks decoded values.
    expect(values).toEqual([value.replaceAll("&", "&#38;").replaceAll('"', "&#34;")]);
    expect(unexpectedElements).toEqual([]);
  }
});
