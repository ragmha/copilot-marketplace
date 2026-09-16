import { test, expect, type Page } from "@playwright/test";

const pageErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem("theme", "light"));
});
test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page)).toEqual([]);
});

test("nontechnical submissions preview safely and open the adopter's GitHub issue form", async ({ page, baseURL }) => {
  if (!baseURL) throw new Error("Missing template test base URL.");
  await page.goto("./submit/");
  await expect(page).toHaveTitle("Submit a skill · Acme Marketplace");
  await expect(page.locator("#submission-errors")).toBeHidden();
  await page.getByRole("button", { name: "Review on GitHub", exact: true }).click();
  await expect(page.locator("#submission-errors")).toBeVisible();
  await expect(page.locator("#submission-errors")).toBeFocused();
  await page.locator("#submit-name").fill("Quarterly review");
  await expect(page.locator("#submit-slug")).toHaveValue("quarterly-review");
  await page.locator("#submit-description").fill("Prepare a team review when asked for quarterly planning.");
  await page.locator("#submit-instructions").fill("Ask for the team goals.\n<img src=x onerror=alert(1)>\nSummarize progress.");
  await expect(page.locator("#submission-preview")).toContainText("<img src=x onerror=alert(1)>");
  await expect(page.locator("#submission-preview img")).toHaveCount(0);
  await page.locator("#submit-acknowledged").check();
  await page.route("https://github.com/acme/copilot-marketplace/issues/new?**", (route) =>
    route.fulfill({ contentType: "text/html", body: "<title>Mock GitHub review</title>" }),
  );
  await page.getByRole("button", { name: "Review on GitHub", exact: true }).click();
  await expect(page).toHaveTitle("Mock GitHub review");
  const url = new URL(page.url());
  expect(url.searchParams.get("template")).toBe("new-plugin.yml");
  expect(url.searchParams.get("name")).toBe("Quarterly review");
  expect(url.searchParams.get("slug")).toBe("quarterly-review");
  expect(url.searchParams.get("capability-kind")).toBe("skill");
  expect(url.searchParams.get("instructions")).toContain('name: "quarterly-review"');
  expect(url.searchParams.has("checks")).toBe(false);
});

test("long submission drafts require a copy handoff and remain usable on mobile", async ({ page, baseURL }) => {
  if (!baseURL) throw new Error("Missing template test base URL.");
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("./submit/");
  await page.locator("#submit-name").fill("Review assistant");
  await page.locator("#submit-description").fill("Review project plans.");
  const instructions = `${"Ask for context and summarize next steps.\n".repeat(220)}THE END`;
  await page.locator("#submit-instructions").fill(instructions);
  await page.locator("#submit-acknowledged").check();
  await page.getByRole("button", { name: "Review on GitHub", exact: true }).click();
  await expect(page).toHaveURL(`${baseURL}submit/`);
  await expect(page.locator("#submission-copy-fallback")).toBeVisible();
  await expect(page.locator("#submission-fallback-link")).not.toHaveAttribute("href");
  await expect(page.locator("#submission-preview")).toContainText("THE END");
  await page.locator("#draft-copied").check();
  const href = await page.locator("#submission-fallback-link").getAttribute("href");
  expect(href).toBeTruthy();
  expect(new URL(href ?? "").searchParams.has("instructions")).toBe(false);
  await page.locator("#submit-description").fill("An updated summary.");
  await expect(page.locator("#submission-copy-fallback")).toBeHidden();
  await expect(page.locator("#submission-fallback-link")).not.toHaveAttribute("href");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("local file import is previewed, explicitly applied, and never uploaded", async ({ page }) => {
  await page.goto("./submit/");
  await page.waitForLoadState("networkidle");
  const requests: string[] = [];
  page.on("request", (request) => requests.push(`${request.method()} ${request.url()}`));
  await page.locator("#submit-name").fill("My current draft");
  await page.locator("#submit-description").fill("Keep this until I approve replacement.");
  const skill = {
    name: "SKILL.md", mimeType: "text/markdown",
    buffer: Buffer.from('---\nname: imported-skill\ndescription: "Summarize a project."\n---\nAsk for context.\n<script>window.__importExecuted=true</script>'),
  };
  await page.locator("#submission-file").setInputFiles(skill);
  await expect(page.locator("#import-review")).toBeVisible();
  await expect(page.locator("#submit-name")).toHaveValue("My current draft");
  await page.getByRole("button", { name: "Cancel import", exact: true }).click();
  await expect(page.locator("#submit-name")).toHaveValue("My current draft");
  await page.locator("#submission-file").setInputFiles(skill);
  await page.getByRole("button", { name: "Use these details", exact: true }).click();
  await expect(page.locator("#submit-name")).toHaveValue("imported-skill");
  await expect(page.locator("#submit-description")).toHaveValue("Summarize a project.");
  await expect(page.locator("#submit-instructions")).toHaveValue(/<script>/);
  await expect(page.locator("#submit-acknowledged")).not.toBeChecked();
  expect(await page.evaluate(() => Object.hasOwn(window, "__importExecuted"))).toBe(false);
  const drop = await page.evaluateHandle(() => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([JSON.stringify({
      name: "imported-plugin", description: "Shared tools.", version: "1.2.0",
      repository: "https://github.com/acme/imported-plugin", author: { name: "Acme" },
      mcpServers: { tool: { command: "do-not-run" } },
    })], "plugin.json", { type: "application/json" }));
    return transfer;
  });
  await page.locator("#import-drop-zone").dispatchEvent("drop", { dataTransfer: drop });
  await page.getByRole("button", { name: "Use these details", exact: true }).click();
  await expect(page.locator("#submit-kind")).toHaveValue("plugin");
  await expect(page.locator("#submit-repository")).toHaveValue("https://github.com/acme/imported-plugin");
  await expect(page.locator("#submit-instructions")).toHaveValue("");
  expect(requests).toEqual([]);
});

test("rejected local files leave the submission draft unchanged", async ({ page }) => {
  await page.goto("./submit/");
  await page.locator("#submit-name").fill("Keep my work");
  await page.locator("#submission-file").setInputFiles({
    name: "plugin.json", mimeType: "application/json", buffer: Buffer.from("{ invalid"),
  });
  await expect(page.locator("#import-status")).toContainText("not valid JSON");
  await expect(page.locator("#submit-name")).toHaveValue("Keep my work");
  await expect(page.locator("#import-review")).toBeHidden();
  await page.locator("#submission-file").setInputFiles({
    name: "SKILL.md", mimeType: "text/markdown", buffer: Buffer.alloc(128 * 1024 + 1, "x"),
  });
  await expect(page.locator("#import-status")).toContainText("128 KiB");
  await expect(page.locator("#submit-name")).toHaveValue("Keep my work");
});
