import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { buildEntry, componentIssues, sourceFor } from "../scripts/lib/marketplace.mjs";

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const fabric = read("../plugins/fabric-skills/plugin.json");
const powerbi = read("../plugins/powerbi-authoring/plugin.json");
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(read("../schemas/plugin.schema.json"));
const sha = "24cc0d296e5e8523cc6a92e1342bc1791d7deb85";

test.each([fabric, powerbi])("published package $name keeps its exact source directory and commit", (manifest) => {
  expect(validate(manifest)).toBe(true);
  expect(componentIssues(manifest)).toEqual([]);
  const entry = buildEntry({ slug: manifest.name, manifest });
  expect(entry.source).toEqual({
    source: "github", repo: "microsoft/skills-for-fabric",
    path: `plugins/${manifest.name}`, ref: sha, sha,
  });
  expect(entry.version).toBe("0.3.16");
  expect(entry.directory.components).toEqual(manifest.directory.components);
});

test("the two active bundles include the full 27-skill union without deprecated aliases", () => {
  expect(fabric.directory.contains).toEqual({ skills: 23, agents: 4, mcpServers: 3 });
  expect(powerbi.directory.contains).toEqual({ skills: 5, mcpServers: 1 });
  const skills = [fabric, powerbi].flatMap((plugin) => plugin.directory.components.filter((entry) => entry.kind === "skill").map((entry) => entry.name));
  expect(new Set(skills).size).toBe(27);
  expect(skills.filter((name) => name === "semantic-model-authoring")).toHaveLength(2);
  expect([fabric.name, powerbi.name]).toEqual(["fabric-skills", "powerbi-authoring"]);
});

test("root-repository sources remain backward compatible", () => {
  expect(sourceFor({ repository: "https://github.com/acme/plugin.git" })).toEqual({ source: "github", repo: "acme/plugin" });
  expect(sourceFor({ repository: "https://example.test/plugin.git" })).toBe("https://example.test/plugin.git");
});

test("inventories reject wrong counts and duplicate names", () => {
  const wrong = structuredClone(fabric);
  wrong.directory.contains.skills = 1;
  expect(componentIssues(wrong).join(" ")).toContain("does not match");
  wrong.directory.components.push(wrong.directory.components[0]);
  expect(componentIssues(wrong).join(" ")).toContain("Duplicate component");
});

test.each(["../plugin", "plugins/../plugin", "/plugin", "plugins\\plugin", "plugins/%2e%2e/plugin"])("rejects unsafe package path %s", (path) => {
  const invalid = structuredClone(fabric);
  invalid.source.path = path;
  expect(validate(invalid)).toBe(false);
});

test("rejects short commit pins and keeps runtime dependency caveats visible", () => {
  const invalid = structuredClone(fabric);
  invalid.source.sha = "24cc0d2";
  expect(validate(invalid)).toBe(false);
  expect(powerbi.directory.notes.join(" ")).toContain("@latest");
  expect(powerbi.directory.notes.join(" ")).toContain("does not pin");
});
