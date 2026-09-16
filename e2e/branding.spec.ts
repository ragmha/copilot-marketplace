import { test, expect, type Page } from "@playwright/test";
import type { Marketplace } from "../src/lib/marketplace";

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

test("Acme identity, logos, catalog, and install commands agree", async ({ page, request, baseURL }) => {
  if (!baseURL) throw new Error("Missing template test base URL.");
  const base = new URL(baseURL).pathname;
  await page.goto("./");
  await expect(page).toHaveTitle("Acme Marketplace");
  expect(await page.locator("main > section").evaluateAll((sections) =>
    sections.map((section) => section.id),
  )).toEqual(["top", "quickstart", "catalog"]);
  await expect(page.locator("[data-brand-title]")).toHaveText("Acme Marketplace");
  await expect(page.locator("[data-brand-organization]")).toHaveText("Acme");
  await expect(page.locator("[data-brand-home]")).toHaveAttribute("href", base);
  await expect(page.locator("footer")).toContainText("Acme");
  await expect(page.locator("body")).not.toContainText("your-org");
  const lightLogo = page.locator('[data-company-logo="light"]');
  await expect(lightLogo).toBeVisible();
  await expect(lightLogo).toHaveAttribute("src", `${base}branding/acme.svg`);
  await expect(lightLogo).toHaveAttribute("alt", "Acme logo");
  await expect(lightLogo).toHaveJSProperty("naturalWidth", 138);
  await expect(page.getByRole("link", { name: "Submit a skill", exact: true }).first()).toHaveAttribute(
    "href", `${base}submit/`,
  );
  await page.getByRole("button", { name: "Toggle dark mode" }).click();
  const darkLogo = page.locator('[data-company-logo="dark"]');
  await expect(darkLogo).toBeVisible();
  await expect(lightLogo).toBeHidden();
  await expect(darkLogo).toHaveAttribute("src", `${base}branding/acme-dark.svg`);
  await expect(darkLogo).toHaveJSProperty("naturalWidth", 138);

  const response = await request.get("marketplace.json");
  expect(response.ok()).toBe(true);
  const catalog: Marketplace = await response.json();
  expect(catalog.name).toBe("acme-tools");
  expect(catalog.owner.name).toBe("Acme");
  expect(catalog.metadata.repository).toBe("https://github.com/acme/copilot-marketplace");
  expect(catalog.plugins).toHaveLength(2);
  await expect(page.locator('[data-name="release-captain"] [data-install]')).toHaveAttribute(
    "data-install", "copilot plugin install release-captain@acme-tools",
  );
  await page.getByRole("tab", { name: "Copilot CLI", exact: true }).click();
  await expect(page.locator("#install-code-cli")).toContainText("copilot plugin marketplace add acme/copilot-marketplace");
});

test("grouped discovery and navigation retain the hosting base", async ({ page, baseURL }) => {
  if (!baseURL) throw new Error("Missing template test base URL.");
  const base = new URL(baseURL).pathname;
  const visibleCards = page.locator("#plugin-grid .plugin-card:visible");
  await page.goto("./");
  await expect(page.locator("#result-count")).toHaveText("2 of 2 entries");
  await expect(page.locator("[data-catalog-group]:visible")).toHaveCount(2);
  await page.locator("#search").fill("runbooks");
  await expect(visibleCards).toHaveCount(1);
  await expect(visibleCards.first()).toHaveAttribute("data-type", "mcp-server");
  await page.reload();
  await expect(page.locator("#search")).toHaveValue("runbooks");
  await expect(visibleCards).toHaveCount(1);
  await page.locator("#clear-search").click();
  await page.locator('#categories [data-category="Delivery"]').click();
  await expect(visibleCards).toHaveCount(1);
  await expect(page.locator("[data-catalog-group]:visible")).toHaveCount(1);
  await page.locator("#type").selectOption("mcp-server");
  await expect(page.locator("#empty-state")).toBeVisible();
  await page.locator("#empty-state [data-reset-catalog]").click();
  await expect(visibleCards).toHaveCount(2);
  await page.locator('[data-name="release-captain"] [data-plugin-link]').click();
  await expect(page).toHaveURL(`${baseURL}plugins/release-captain/`);
  await expect(page).toHaveTitle("release-captain · Acme Marketplace");
  await expect(page.locator("[data-brand-home]")).toHaveAttribute("href", base);
  await expect(page.locator("[data-copy-text]")).toHaveAttribute("data-copy-text", "copilot plugin install release-captain@acme-tools");
  await page.locator("#search").fill("runbooks");
  await page.locator("#search").press("Enter");
  await expect(page).toHaveURL(`${baseURL}?q=runbooks#catalog`);
  await expect(visibleCards).toHaveCount(1);
});

test("mobile branding and keyboard search remain usable", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("./");
  await expect(page.locator('[data-company-logo="light"]')).toBeVisible();
  const layout = await page.evaluate(() => ({
    viewport: window.innerWidth,
    pageWidth: document.documentElement.scrollWidth,
    searchBottom: document.getElementById("search")?.getBoundingClientRect().bottom,
    sections: Array.from(document.querySelectorAll("main > section"), (section) => ({
      id: section.id,
      top: section.getBoundingClientRect().top,
      bottom: section.getBoundingClientRect().bottom,
    })),
  }));
  expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewport);
  expect(layout.searchBottom).toBeLessThan(812);
  expect(layout.sections.map((section) => section.id)).toEqual(["top", "quickstart", "catalog"]);
  expect(layout.sections[1].top).toBeGreaterThanOrEqual(layout.sections[0].bottom);
  expect(layout.sections[2].top).toBeGreaterThanOrEqual(layout.sections[1].bottom);
  await page.keyboard.press("/");
  await expect(page.locator("#search")).toBeFocused();
  await page.locator("#search").fill("release notes");
  await expect(page.locator("#plugin-grid .plugin-card:visible")).toHaveCount(1);
  await page.locator("#search").press("Enter");
  await expect(page.locator("#result-count")).toContainText('matching "release notes"');
});

test("the branded plugin guide is separate and works on both hosting paths", async ({ page, baseURL }) => {
  if (!baseURL) throw new Error("Missing template test base URL.");
  const guide = `${baseURL}learn/plugins/`;
  await page.goto("./");
  await expect(page.locator("astro-island")).toHaveCount(0);
  await expect(page.locator("#anatomy")).toHaveCount(0);
  await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "What is a plugin?", exact: true }).click();
  await expect(page).toHaveURL(guide);
  await expect(page).toHaveTitle("What is a plugin? · Acme Marketplace");
  await expect(page.getByRole("heading", { name: "What is a plugin?", exact: true, level: 1 })).toBeVisible();
  await expect(page.locator("[data-brand-organization]")).toHaveText("Acme");
  await page.locator("#anatomy").scrollIntoViewIfNeeded();
  await expect(page.locator("#anatomy .react-flow")).toBeVisible();
  await expect(page.locator("astro-island[ssr]")).toHaveCount(0);
  await page.reload();
  await expect(page).toHaveURL(guide);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole("button", { name: "Toggle dark mode" }).click();
  await expect(page.locator('[data-company-logo="dark"]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator("#search").fill("runbooks");
  await page.locator("#search").press("Enter");
  await expect(page).toHaveURL(`${baseURL}?q=runbooks#catalog`);
  await expect(page.locator("#plugin-grid .plugin-card:visible")).toHaveCount(1);
  await page.goto(`${baseURL}plugins/release-captain/`);
  await page.getByRole("link", { name: "what a plugin is", exact: true }).click();
  await expect(page).toHaveURL(guide);
});

test("installation tabs expose only the requested methods and support keyboard and copy", async ({ page }) => {
  await page.goto("./plugins/release-captain/");
  const tabs = page.getByRole("tablist", { name: "Installation method" }).getByRole("tab");
  await expect(tabs).toHaveText(["APM", "Copilot CLI", "VS Code"]);
  await expect(page.getByRole("tabpanel", { name: "APM", exact: true })).toBeVisible();
  await expect(page.locator("#install-code-apm")).toContainText("apm install release-captain@acme-tools --target copilot");
  await tabs.first().focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Copilot CLI", exact: true })).toBeFocused();
  await expect(page.getByRole("tabpanel", { name: "Copilot CLI", exact: true })).toBeVisible();
  await expect(page.locator("#install-code-cli")).toContainText("copilot plugin install release-captain@acme-tools");
  await page.keyboard.press("End");
  await expect(page.getByRole("tab", { name: "VS Code", exact: true })).toHaveAttribute("aria-selected", "true");
  const settings = JSON.parse(await page.locator("#install-code-vscode").innerText());
  expect(settings.enabledPlugins).toEqual({ "release-captain@acme-tools": true });
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (text: string) => { document.documentElement.dataset.copied = text; } },
    });
  });
  await page.getByRole("button", { name: "Copy VS Code instructions", exact: true }).click();
  expect(JSON.parse(await page.locator("html").getAttribute("data-copied") ?? "{}")).toEqual(settings);
  await expect(page.locator("#install-copy-status")).toHaveText("Copied.");
  for (const width of [375, 320]) {
    await page.setViewportSize({ width, height: 812 });
    for (const method of ["APM", "Copilot CLI", "VS Code"]) {
      await page.getByRole("tab", { name: method, exact: true }).click();
      await expect(page.getByRole("tabpanel", { name: method, exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
});
