import { expect, test } from "bun:test";
import { maxImportBytes, parseSubmissionFile } from "../src/lib/submission-import.ts";

const kinds = ["plugin", "skill", "agent", "prompt", "hook", "mcp-server", "extension"];

test("imports real YAML frontmatter and preserves the Markdown body", () => {
  const result = parseSubmissionFile("SKILL.md", "\uFEFF---\r\nname: deal-health-check\r\ndescription: >\r\n  Review a deal\r\n  when asked.\r\n---\r\n    Keep indentation.\r\n# Steps\r\nAsk for context.\r\n", kinds);
  expect(result.name).toBe("deal-health-check");
  expect(result.slug).toBe("deal-health-check");
  expect(result.kind).toBe("skill");
  expect(result.description).toBe("Review a deal when asked.\n");
  expect(result.instructions).toBe("    Keep indentation.\n# Steps\nAsk for context.\n");
});

test("imports only metadata from plugin.json, never MCP commands or executable settings", () => {
  const result = parseSubmissionFile("plugin.json", JSON.stringify({
    name: "team-tools", description: "Team workflows.", version: "1.2.0",
    repository: "https://github.com/acme/team-tools", author: { name: "Acme" },
    category: "Operations", directory: { type: "plugin" },
    mcpServers: { remote: { command: "untrusted-command" } },
    hooks: { command: "another-untrusted-command" },
  }), kinds);
  expect(result).toEqual({
    name: "team-tools", slug: "team-tools", kind: "plugin", description: "Team workflows.",
    version: "1.2.0", repository: "https://github.com/acme/team-tools",
    author: "Acme", category: "Operations", instructions: "",
  });
  expect(JSON.stringify(result)).not.toContain("untrusted");
});

test.each([
  "name: one\nname: two\ndescription: test",
  "name: &label one\ndescription: *label",
  "name: !!js/function function(){}\ndescription: test",
  "name: [one]\ndescription: test",
  "name: one",
])("rejects ambiguous or unsupported skill metadata", (header) => {
  expect(() => parseSubmissionFile("SKILL.md", `---\n${header}\n---\nBody`, kinds)).toThrow();
});

test("does not convert unreferenced YAML aliases or arbitrary objects", () => {
  const result = parseSubmissionFile("SKILL.md", "---\nname: safe-name\ndescription: Example.\nextra: &x [one]\nunused: [*x, *x, *x]\n---\nInstructions", kinds);
  expect(result.name).toBe("safe-name");
  expect(result).not.toHaveProperty("extra");
});

test.each(["archive.zip", "folder", "image.svg"])("rejects unsupported import %s", (name) => {
  expect(() => parseSubmissionFile(name, "content", kinds)).toThrow("not supported");
});

test("rejects oversized files, headers, and instruction bodies before applying any data", () => {
  expect(() => parseSubmissionFile("SKILL.md", "x".repeat(maxImportBytes + 1), kinds)).toThrow("128 KiB");
  expect(() => parseSubmissionFile("SKILL.md", `---\nname: one\ndescription: ${"x".repeat(17000)}\n---\nBody`, kinds)).toThrow("header is too large");
  expect(() => parseSubmissionFile("SKILL.md", `---\nname: one\ndescription: test\n---\n${"x".repeat(20001)}`, kinds)).toThrow("20,000");
});

test.each(["not json", "[]", "null", '{"name":false}', '{"description":"missing name"}'])("rejects invalid plugin manifests", (content) => {
  expect(() => parseSubmissionFile("plugin.json", content, kinds)).toThrow();
});

test("JSON prototype keys are not copied into the form", () => {
  const result = parseSubmissionFile("plugin.json", '{"name":"test","__proto__":{"polluted":true}}', kinds);
  expect(Object.hasOwn(result, "__proto__")).toBe(false);
  expect({}.polluted).toBeUndefined();
});
