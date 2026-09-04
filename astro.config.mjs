// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

// `BASE_PATH` is set by the GitHub Pages workflow so the site works from
// https://<org>.github.io/<repo>/ as well as from a local dev server.
const base = process.env.BASE_PATH || "/";

export default defineConfig({
  base,
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
