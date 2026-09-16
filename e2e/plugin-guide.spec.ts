import { test, expect } from "@playwright/test";

test("the plugin guide leads with the diagram on desktop and mobile in both themes", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem("theme", "light"));
  await page.goto("./learn/plugins/");
  const diagram = page.getByRole("img", { name: /^Diagram:/ });
  const firstContent = page.locator('main h2, main p, main dl, main [role="img"]').first();
  await expect(firstContent).toHaveAttribute("role", "img");
  await expect(page.locator("#anatomy astro-island[ssr]")).toHaveCount(0);
  await expect(page.locator("#anatomy .react-flow__edge").first()).toBeVisible();
  await expect(page.locator("#anatomy figcaption")).toContainText("Copilot-style example");

  for (const viewport of [{ width: 1280, height: 720 }, { width: 375, height: 812 }, { width: 320, height: 812 }]) {
    await page.setViewportSize(viewport);
    for (const mode of ["light", "dark"]) {
      await expect(page.locator("#anatomy .react-flow")).toHaveClass(new RegExp(`\\b${mode}\\b`));
      await expect(diagram).toBeInViewport({ ratio: 1 });
      await expect.poll(() => diagram.evaluate((element) => {
        const frame = element.getBoundingClientRect();
        const nodes = [...element.querySelectorAll(".react-flow__node")];
        return nodes.length > 0 && nodes.every((node) => {
          const bounds = node.getBoundingClientRect();
          return bounds.left >= frame.left && bounds.right <= frame.right
            && bounds.top >= frame.top && bounds.bottom <= frame.bottom;
        });
      })).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.getByRole("button", { name: "Toggle dark mode" }).click();
    }
  }
  expect(errors).toEqual([]);
});

test("portable format essentials are visible with optional technical details", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("theme", "light"));
  await page.goto("./learn/plugins/");
  const standard = page.getByRole("region", { name: "Portable Agent Plugins", exact: true });
  await expect(standard.locator("dl").first().getByRole("term")).toHaveText([
    "plugin.json",
    "skills/<name>/SKILL.md",
    "mcp.json",
  ]);
  await expect(standard).toContainText("Client-specific capabilities are not portable v1 components.");
  await expect(standard.getByRole("link", { name: "Agent Plugins 1.0.0 standard", exact: true })).toHaveAttribute(
    "href", "https://agent-plugins.org/specification",
  );
  const details = page.locator("#portable-format-details");
  await expect(details).not.toHaveAttribute("open");
  await expect(page.locator("#portable-manifest")).toBeHidden();
  await details.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(details).toHaveAttribute("open", "");
  expect(JSON.parse(await page.locator("#portable-manifest").innerText())).toEqual({
    $schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
    name: "starter-tools",
  });
  await expect(details).toContainText("com.example.client/");
  await expect(details).toContainText("PLUGIN_DATA");
  await expect(details.getByRole("link", { name: "Canonical JSON schemas", exact: true })).toHaveAttribute(
    "href", "https://agent-plugins.org/schemas",
  );
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Toggle dark mode" }).click();
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
