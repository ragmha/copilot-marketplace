import { test, expect, type Page } from "@playwright/test";
import swa from "../public/staticwebapp.config.json" with { type: "json" };

const violations = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }, testInfo) => {
  const found: string[] = [];
  violations.set(page, found);
  page.on("pageerror", (error) => found.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (/content security policy|refused to (execute|load|apply|evaluate)/i.test(message.text())) {
      found.push(`console: ${message.text()}`);
    }
  });
  await page.exposeFunction("__reportCspViolation", (report: string) => found.push(report));
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) => {
      const report = (window as unknown as { __reportCspViolation: (report: string) => void }).__reportCspViolation;
      report(`violation: ${event.violatedDirective} ${event.blockedURI} ${event.sourceFile}:${event.lineNumber}`);
    });
  });
  // Root hosting mirrors Azure Static Web Apps, which also sends the header policy;
  // the Pages project relies on the meta policy alone, as GitHub Pages does.
  if (testInfo.project.name === "root") {
    await page.route("**/*", async (route) => {
      if (route.request().resourceType() !== "document") return route.fallback();
      const response = await route.fetch();
      await route.fulfill({ response, headers: { ...response.headers(), ...swa.globalHeaders } });
    });
  }
});

test.afterEach(async ({ page }) => {
  expect(violations.get(page)).toEqual([]);
});

async function expectMetaPolicy(page: Page) {
  const meta = page.locator('meta[http-equiv="content-security-policy"]');
  await expect(meta).toHaveCount(1);
  const policy = await meta.getAttribute("content") ?? "";
  const scripts = policy.split(";").find((directive) => directive.trim().startsWith("script-src ")) ?? "";
  expect(policy).toContain("default-src 'self'");
  expect(policy).toContain("object-src 'none'");
  expect(scripts).toMatch(/'sha256-[A-Za-z0-9+/=]+'/);
  expect(policy).not.toContain("'unsafe-eval'");
  expect(scripts).not.toContain("'unsafe-inline'");
}

for (const theme of ["light", "dark"] as const) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
    });

    test("key pages run under the content security policy", async ({ page }) => {
      const html = page.locator("html");
      const other = theme === "light" ? "dark" : "light";

      await page.goto("./");
      await expectMetaPolicy(page);
      await expect(html).toHaveClass(theme === "dark" ? /\bdark\b/ : /^(?!.*\bdark\b)/);
      await page.getByRole("button", { name: "Toggle dark mode" }).click();
      await expect(html).toHaveClass(other === "dark" ? /\bdark\b/ : /^(?!.*\bdark\b)/);
      await page.getByRole("button", { name: "Toggle dark mode" }).click();
      await page.locator("#search").fill("runbooks");
      await expect(page.locator("#plugin-grid .plugin-card:visible")).toHaveCount(1);
      await page.locator("#clear-search").click();
      await page.locator("#type").selectOption("mcp-server");
      await expect(page.locator("#plugin-grid .plugin-card:visible")).toHaveCount(1);

      await page.goto("./plugins/release-captain/");
      await expectMetaPolicy(page);
      await page.getByRole("tab", { name: "Copilot CLI", exact: true }).click();
      await expect(page.locator("#install-code-cli")).toContainText("copilot plugin install release-captain@acme-tools");

      await page.goto("./plugins/internal-docs/");
      await expectMetaPolicy(page);
      await expect(page.locator("main").getByText("Sample", { exact: true }).first()).toBeVisible();

      await page.goto("./submit/");
      await expectMetaPolicy(page);
      await page.locator("#submit-name").fill("Deal health check");
      await expect(page.locator("#submission-preview")).not.toHaveText("Fill in the form to preview your draft.");

      await page.goto("./learn/plugins/");
      await expectMetaPolicy(page);
      await page.locator("#anatomy").scrollIntoViewIfNeeded();
      await expect(page.locator("#anatomy astro-island[ssr]")).toHaveCount(0);
      await expect(page.locator("#anatomy .react-flow__edge").first()).toBeVisible();
      await expect(page.locator("#anatomy .react-flow")).toHaveClass(new RegExp(`\\b${theme}\\b`));
      await page.getByRole("button", { name: "Toggle dark mode" }).click();
      await expect(page.locator("#anatomy .react-flow")).toHaveClass(new RegExp(`\\b${other}\\b`));
    });
  });
}
