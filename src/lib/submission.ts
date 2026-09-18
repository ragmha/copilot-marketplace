import { parseRepositoryUrl, repositoryUrlMessage } from "./repository-url.mjs";

export type Submission = {
  name: string;
  slug: string;
  kind: string;
  description: string;
  repository: string;
  instructions: string;
  author: string;
  category: string;
  version: string;
  acknowledged: boolean;
};

export type SubmissionError = { field: keyof Submission; message: string };
export const issueTemplate = "new-plugin.yml";
export const submissionFieldIds = {
  name: "name",
  slug: "slug",
  kind: "capability-kind",
  description: "description",
  repository: "repository",
  instructions: "instructions",
  author: "author",
  category: "category",
  version: "version",
} as const;

export function skillSlug(name: string): string {
  return name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64).replace(/-$/, "");
}

export function validateSubmission(
  draft: Submission,
  kinds: readonly string[],
  existingNames: readonly string[],
): SubmissionError[] {
  const errors: SubmissionError[] = [];
  const add = (field: keyof Submission, message: string) => errors.push({ field, message });
  if (!draft.name.trim() || draft.name.length > 80 || /[\r\n]/.test(draft.name)) add("name", "Give it a short name, up to 80 characters.");
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(draft.slug) || draft.slug.length > 64) {
    add("slug", "Use a short identifier with lowercase letters, numbers, and single hyphens.");
  } else if (existingNames.includes(draft.slug)) {
    add("slug", "That identifier is already in the catalog. Choose a different one for a new submission.");
  }
  if (!kinds.includes(draft.kind)) add("kind", "Choose what you are sharing.");
  if (!draft.description.trim() || draft.description.length > 1024) add("description", "Describe what it does and when to use it, up to 1,024 characters.");
  if (!draft.repository.trim() && !draft.instructions.trim()) add("instructions", "Add a repository link or write the instructions for your skill.");
  if (draft.repository.trim()) {
    try {
      parseRepositoryUrl(draft.repository);
      if (draft.repository.length > 500) {
        add("repository", "Keep the repository link under 500 characters.");
      }
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;
      add("repository", repositoryUrlMessage);
    }
  }
  if (draft.instructions.length > 20000) add("instructions", "Keep the instructions under 20,000 characters, or link to a repository.");
  if (draft.author.length > 120) add("author", "Keep the name or team under 120 characters.");
  if (draft.category.length > 80) add("category", "Keep the use case under 80 characters.");
  if (draft.version && !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?$/.test(draft.version)) add("version", "Use a version like 1.0.0, or leave it blank for a maintainer.");
  if (!draft.acknowledged) add("acknowledged", "Confirm that the request is appropriate to share and contains no secrets or customer data.");
  return errors;
}

export function skillDraft(draft: Submission): string {
  if (draft.kind !== "skill") return draft.instructions;
  const body = draft.instructions.endsWith("\n") ? draft.instructions : `${draft.instructions}\n`;
  return `---\nname: ${JSON.stringify(draft.slug)}\ndescription: ${JSON.stringify(draft.description.trim())}\n---\n\n${body}`;
}

export function submissionPreview(draft: Submission): string {
  if (draft.instructions.trim()) return skillDraft(draft);
  return [
    `# ${draft.name.trim() || "Submission"}`,
    draft.description.trim(),
    `Type: ${draft.kind}`,
    `Identifier: ${draft.slug}`,
    `Source: ${draft.repository.trim() || "A maintainer will help package this draft."}`,
    ...(draft.author.trim() ? [`Owner: ${draft.author.trim()}`] : []),
    ...(draft.category.trim() ? [`Use case: ${draft.category.trim()}`] : []),
  ].join("\n\n");
}

export function submissionLink(repository: string, draft: Submission) {
  if (!/^(?!\.{1,2}\/)[A-Za-z0-9_.-]+\/(?!\.{1,2}$)[A-Za-z0-9_.-]+$/.test(repository) || /\s/.test(repository)) {
    throw new Error("Submission destination must be a GitHub owner/repository.");
  }
  const url = new URL(`https://github.com/${repository}/issues/new`);
  url.searchParams.set("template", issueTemplate);
  url.searchParams.set("title", `[${draft.kind}] ${draft.name.trim()}`);
  for (const [field, id] of Object.entries(submissionFieldIds)) {
    const value = field === "instructions"
      ? (draft.instructions.trim() ? skillDraft(draft) : "")
      : draft[field as keyof typeof submissionFieldIds].trim();
    if (value) url.searchParams.set(id, value);
  }
  // Long drafts use an explicit copy/paste handoff instead of a fragile giant URL.
  const copyRequired = url.href.length > 7000;
  if (copyRequired) url.searchParams.delete(submissionFieldIds.instructions);
  if (url.href.length > 7000) {
    throw new RangeError("The summary and optional fields are too long for a prefilled link. Move longer details into the instructions field.");
  }
  return { url: url.href, copyRequired, draft: submissionPreview(draft) };
}
