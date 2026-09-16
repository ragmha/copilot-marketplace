import { isMap, isScalar, parseDocument } from "yaml";
import { skillSlug, type Submission } from "./submission";

export const maxImportBytes = 128 * 1024;
export type ImportedSubmission = Omit<Submission, "acknowledged">;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textField(value: Record<string, unknown>, key: string, required = false): string {
  const field = value[key];
  if (field === undefined && !required) return "";
  if (typeof field !== "string" || (required && !field.trim())) {
    throw new Error(`The imported ${key} field must be text${required ? " and cannot be empty" : ""}.`);
  }
  return field;
}

export function parseSubmissionFile(
  filename: string,
  content: string,
  kinds: readonly string[],
): ImportedSubmission {
  if (new TextEncoder().encode(content).byteLength > maxImportBytes) {
    throw new Error("Choose a text file no larger than 128 KiB.");
  }
  const empty = { repository: "", instructions: "", author: "", category: "", version: "" };
  if (/\.md$/i.test(filename)) {
    const text = content.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
    const match = /^---\n([\s\S]*?)\n---(?:\n|$)([\s\S]*)$/.exec(text);
    if (!match) throw new Error("SKILL.md needs YAML frontmatter between --- lines, with a name and description.");
    if (match[1].length > 16 * 1024) throw new Error("The YAML header is too large. Keep detailed instructions below the frontmatter.");
    if (match[2].length > 20000) throw new Error("The instructions exceed 20,000 characters. Link the repository instead of importing this file.");
    const document = parseDocument(match[1], { schema: "core", uniqueKeys: true, stringKeys: true, prettyErrors: false });
    if (document.errors.length || document.warnings.length || !isMap(document.contents)) {
      throw new Error("The SKILL.md frontmatter is invalid or uses unsupported YAML tags. Check its name and description.");
    }
    // Read scalar metadata only; never expand aliases or construct arbitrary YAML objects.
    const scalar = (key: string) => {
      const node = document.get(key, true);
      if (!isScalar(node) || typeof node.value !== "string" || !node.value.trim()) {
        throw new Error(`SKILL.md needs a plain-text ${key}, not an alias or object.`);
      }
      return node.value;
    };
    const name = scalar("name");
    return { ...empty, name, slug: skillSlug(name), kind: "skill", description: scalar("description"), instructions: match[2] };
  }
  if (/\.json$/i.test(filename)) {
    let value: unknown;
    try {
      value = JSON.parse(content.replace(/^\uFEFF/, ""));
    } catch {
      throw new Error("The file is not valid JSON. Choose a plugin.json manifest.");
    }
    if (!record(value)) throw new Error("plugin.json must contain a manifest object.");
    const name = textField(value, "name", true);
    const directory = record(value.directory) ? value.directory : {};
    const kind = textField(directory, "type") || "plugin";
    if (!kinds.includes(kind)) throw new Error("The manifest contains an unknown capability type.");
    const author = typeof value.author === "string"
      ? value.author : record(value.author) ? textField(value.author, "name") : "";
    return {
      ...empty, name, slug: skillSlug(name), kind,
      description: textField(value, "description"),
      repository: textField(value, "repository"),
      version: textField(value, "version"),
      category: textField(value, "category"), author,
    };
  }
  throw new Error("Choose one SKILL.md or plugin.json text file. ZIPs and folders are not supported.");
}
