import { afterEach, expect, test } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  buildMarketplace, installableMarketplace, loadPlugins, pathsFor, repoRoot,
  serialize, sourceIssues, writeMarketplace,
} from "../scripts/lib/marketplace.mjs";

const roots = new Set();
const sha = "a".repeat(40);
const base = {
  name: "test-plugin", description: "Test plugin.", version: "1.0.0",
  author: { name: "Tests" }, repository: "https://github.com/acme/test-plugin",
  category: "Delivery", directory: { type: "plugin", updated: "2026-10-09" },
};
const github = { source: "github", repo: "acme/test-plugin" };
const url = { source: "url", url: "https://example.test/plugins.git" };
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validatePlugin = ajv.compile(JSON.parse(readFileSync(join(repoRoot, "schemas", "plugin.schema.json"), "utf8")));
const validateMarketplace = ajv.compile(JSON.parse(readFileSync(join(repoRoot, "schemas", "marketplace.schema.json"), "utf8")));

afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots.clear();
});

test.each([undefined, github, url])("real remote source %j requires an explicit commit pin", (source) => {
  const manifest = { ...base, source };
  expect(sourceIssues(manifest).join(" ")).toContain('Plugin "test-plugin" requires a 40-hex source.sha');
  expect(sourceIssues({ ...manifest, directory: { ...base.directory, sample: false } })).toHaveLength(1);
  expect(sourceIssues({ ...manifest, directory: { ...base.directory, sample: true } })).toEqual([]);
});

test.each([github, url])("both source kinds enforce exactly 40 hex characters: %j", (source) => {
  for (const pin of [sha, sha.toUpperCase(), "0123456789abcdef".repeat(2) + "01234567"]) {
    const manifest = { ...base, source: { ...source, sha: pin } };
    expect(sourceIssues(manifest)).toEqual([]);
    expect(validatePlugin(manifest)).toBe(true);
  }
  for (const pin of ["", "main", "a".repeat(39), "a".repeat(41), "g".repeat(40), `${sha}\n`]) {
    const manifest = { ...base, source: { ...source, sha: pin } };
    expect(sourceIssues(manifest)).toHaveLength(1);
    expect(validatePlugin(manifest)).toBe(false);
  }
});

test("sample is boolean and both schemas keep directory closed", () => {
  for (const sample of [true, false]) {
    const manifest = { ...base, directory: { ...base.directory, sample } };
    expect(validatePlugin(manifest)).toBe(true);
    expect(validateMarketplace({ name: "tests", owner: base.author, plugins: [{ ...manifest, source: github }] })).toBe(true);
  }
  for (const directory of [{ ...base.directory, sample: "true" }, { ...base.directory, unknown: true }]) {
    expect(validatePlugin({ ...base, directory })).toBe(false);
    expect(validateMarketplace({ name: "tests", owner: base.author, plugins: [{ ...base, source: github, directory }] })).toBe(false);
  }
});

test("the real catalog preserves both existing pins and all 18 placeholders stay site-only", () => {
  const site = buildMarketplace();
  const installable = installableMarketplace(site);
  expect(site.plugins).toHaveLength(20);
  expect(site.plugins.filter((entry) => entry.directory.sample)).toHaveLength(18);
  expect(installable.plugins.map((entry) => entry.name)).toEqual(["fabric-skills", "powerbi-authoring"]);
  expect(installable.plugins.every((entry) => entry.source.sha === "24cc0d296e5e8523cc6a92e1342bc1791d7deb85")).toBe(true);
  for (const { manifest } of loadPlugins()) {
    expect(sourceIssues(manifest)).toEqual([]);
    expect(manifest.directory.sample === true).toBe(manifest.repository.includes("/your-org/"));
  }
  expect(installableMarketplace({ ...site, plugins: site.plugins.filter((entry) => entry.directory.sample) }).plugins).toEqual([]);
});

function fixture(manifest) {
  const root = mkdtempSync(join(tmpdir(), "marketplace-pins-"));
  roots.add(root);
  for (const path of ["scripts", "schemas", "src", "marketplace.config.json"]) {
    cpSync(join(repoRoot, path), join(root, path), { recursive: true });
  }
  symlinkSync(join(repoRoot, "node_modules"), join(root, "node_modules"), process.platform === "win32" ? "junction" : "dir");
  mkdirSync(join(root, "plugins", base.name), { recursive: true });
  writeFileSync(join(root, "plugins", base.name, "plugin.json"), serialize(manifest));
  writeMarketplace(buildMarketplace(undefined, root), root);
  return root;
}

function validate(root) {
  const result = spawnSync(process.execPath, [join(root, "scripts", "validate.mjs")], {
    cwd: root, encoding: "utf8", timeout: 30_000,
  });
  if (result.error) throw result.error;
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

test("validator rejects an otherwise synchronized unpinned real plugin by name", () => {
  const root = fixture(base);
  const result = validate(root);
  expect(result.status).toBe(1);
  expect(result.output).toContain('Plugin "test-plugin" requires a 40-hex source.sha');
});

test("validator accepts pinned Git URL entries and detects stale site data", () => {
  const root = fixture({ ...base, source: { ...url, sha } });
  expect(validate(root).status).toBe(0);
  const paths = pathsFor(root);
  const site = JSON.parse(readFileSync(paths.siteCopy, "utf8"));
  site.plugins[0].description = "Stale";
  writeFileSync(paths.siteCopy, serialize(site));
  const result = validate(root);
  expect(result.status).toBe(1);
  expect(result.output).toContain("including sample exclusions");
});

test("validator accepts a samples-only site and rejects samples leaked into the client catalog", () => {
  const root = fixture({ ...base, directory: { ...base.directory, sample: true } });
  expect(validate(root).status).toBe(0);
  const paths = pathsFor(root);
  cpSync(paths.siteCopy, paths.marketplaceFile);
  expect(validate(root).status).toBe(1);
  const result = spawnSync(process.execPath, [join(root, "scripts", "generate-marketplace.mjs"), "--check"], {
    cwd: root, encoding: "utf8", timeout: 30_000,
  });
  if (result.error) throw result.error;
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("Out of date");
});
