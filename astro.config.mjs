// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

// `BASE_PATH` is set by the GitHub Pages workflow so the site works from
// https://<org>.github.io/<repo>/ as well as from a local dev server.
const base = process.env.BASE_PATH || "/";

export default defineConfig({
  base,
  integrations: [react()],
  vite: {
    // Fixture builds share dependencies, but must not invalidate the live server's cache.
    cacheDir: fileURLToPath(new URL("./.astro/vite", import.meta.url)),
    plugins: [tailwindcss()],
  },
});
