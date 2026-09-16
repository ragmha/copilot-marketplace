import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  issueTemplate, skillDraft, skillSlug, submissionFieldIds, submissionLink, validateSubmission,
} from "../src/lib/submission.ts";

const kinds = ["plugin", "skill", "agent", "prompt", "hook", "mcp-server", "extension"];
const draft = {
  name: "Deal health check", slug: "deal-health-check", kind: "skill",
  description: 'Review a deal and explain "next steps".',
  repository: "", instructions: "    Preserve this indentation.\nAsk for the deal context.\n",
  author: "", category: "", version: "", acknowledged: true,
};

test("friendly names produce a bounded editable identifier", () => {
  expect(skillSlug("  Déal Health / Check! ")).toBe("deal-health-check");
  expect(skillSlug("A".repeat(100))).toHaveLength(64);
  expect(skillSlug("日本語")).toBe("");
});

test("a skill draft is enough without a repository, version, or email", () => {
  expect(validateSubmission(draft, kinds, [])).toEqual([]);
  expect(validateSubmission({ ...draft, instructions: "", repository: "https://github.com/acme/deal-skill" }, kinds, [])).toEqual([]);
});

test("missing instructions, duplicate identifiers, and unacknowledged sharing are explicit errors", () => {
  const errors = validateSubmission({ ...draft, instructions: "", acknowledged: false }, kinds, ["deal-health-check"]);
  expect(errors.map((error) => error.field)).toEqual(["slug", "instructions", "acknowledged"]);
});

test.each(["javascript:alert(1)", "http://example.test/code", "https://user:password@example.test/code"])("rejects unsafe repository input %s", (repository) => {
  expect(validateSubmission({ ...draft, repository }, kinds, []).some((error) => error.field === "repository")).toBe(true);
});

test("skill frontmatter is valid YAML and the instruction body is not reformatted", () => {
  const text = skillDraft(draft);
  const frontmatter = text.split("---\n")[1];
  expect(Bun.YAML.parse(frontmatter)).toEqual({ name: draft.slug, description: draft.description });
  expect(text).toEndWith(draft.instructions);
});

test("prefills match the actual issue template field ids without checking GitHub confirmations", () => {
  const template = Bun.YAML.parse(readFileSync(new URL(`../.github/ISSUE_TEMPLATE/${issueTemplate}`, import.meta.url), "utf8"));
  const ids = template.body.map((field) => field.id).filter(Boolean);
  expect(new Set(ids).size).toBe(ids.length);
  for (const id of Object.values(submissionFieldIds)) expect(ids).toContain(id);
  const result = submissionLink("acme/copilot-marketplace", draft);
  const url = new URL(result.url);
  expect(url.origin).toBe("https://github.com");
  expect(url.pathname).toBe("/acme/copilot-marketplace/issues/new");
  expect(url.searchParams.get("template")).toBe("new-plugin.yml");
  expect(url.searchParams.get("capability-kind")).toBe("skill");
  expect(url.searchParams.get("instructions")).toBe(skillDraft(draft));
  expect(url.searchParams.has("checks")).toBe(false);
  expect(result.copyRequired).toBe(false);
});

test("special characters cannot inject labels, templates, or redirects into the URL", () => {
  const url = new URL(submissionLink("acme/tools", { ...draft, description: "A&B #x ?labels=approved&template=other.yml" }).url);
  expect(url.searchParams.get("template")).toBe(issueTemplate);
  expect(url.searchParams.has("labels")).toBe(false);
  expect(url.searchParams.get("description")).toContain("&template=other.yml");
});

test("large instructions are preserved for a deliberate copy handoff", () => {
  const long = { ...draft, instructions: `${"Detailed instructions.\n".repeat(500)}THE END` };
  const result = submissionLink("acme/tools", long);
  expect(result.copyRequired).toBe(true);
  expect(result.url.length).toBeLessThanOrEqual(7000);
  expect(new URL(result.url).searchParams.has("instructions")).toBe(false);
  expect(result.draft).toContain(long.instructions);
});

test("oversize summary metadata is not silently lost", () => {
  expect(() => submissionLink("acme/tools", { ...draft, description: "日本語".repeat(340) })).toThrow(RangeError);
});

test("invalid destinations cannot redirect away from the configured GitHub repository", () => {
  for (const repository of ["https://evil.test", "acme/..", "acme/repo/extra", "acme/repo\n"]) {
    expect(() => submissionLink(repository, draft)).toThrow();
  }
});
