import { defineConfig, devices } from "@playwright/test";

const hosts = [
  { name: "root", port: 4541, base: "/" },
  { name: "pages", port: 4542, base: "/acme-marketplace/" },
];

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  globalTimeout: 300_000,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    launchOptions: { timeout: 30_000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: hosts.map((host) => ({
    name: host.name,
    use: { baseURL: `http://127.0.0.1:${host.port}${host.base}` },
  })),
  webServer: hosts.map((host) => ({
    command: `node scripts/serve-template-fixture.mjs ${host.name}`,
    url: `http://127.0.0.1:${host.port}${host.base}`,
    reuseExistingServer: false,
    timeout: 180_000,
    gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
  })),
});
