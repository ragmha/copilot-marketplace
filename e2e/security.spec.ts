import { test, expect } from "@playwright/test";
import releaseCaptain from "../tests/fixtures/acme/plugins/release-captain/plugin.json" with { type: "json" };

test("URL-like plugin descriptions remain text in generated pages", async ({ page }) => {
  await page.goto("./");
  await expect(page.locator("[data-security-probe]")).toHaveCount(0);
  await expect(page.locator('[data-name="release-captain"]')).toContainText(releaseCaptain.description);

  await page.goto("./plugins/release-captain/");
  await expect(page.locator('meta[name="description"]')).toHaveCount(1);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", releaseCaptain.description);
  await expect(page.locator("[data-security-probe]")).toHaveCount(0);
  await expect(page.locator("main")).toContainText(releaseCaptain.description);
});
