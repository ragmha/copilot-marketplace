// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { cspDirectives } from "./src/lib/csp.mjs";

// `BASE_PATH` is set by the GitHub Pages workflow so the site works from
// https://<org>.github.io/<repo>/ as well as from a local dev server.
const base = process.env.BASE_PATH || "/";

export default defineConfig({
  base,
  output: "static",
  // Astro 7 defaults to JSX whitespace rules; retain HTML-aware inline spacing.
  compressHTML: true,
  integrations: [react()],
  // Shiki's inline styles conflict with the CSP; the site renders no Markdown.
  markdown: { syntaxHighlight: false },
  security: {
    // Emitted as <meta http-equiv> so GitHub Pages, which cannot set headers, is covered.
    csp: {
      directives: cspDirectives,
      scriptDirective: { resources: ["'self'"] },
      // Server-rendered gradients and React Flow node positions use style="" attributes,
      // so only attributes allow inline styles; <style> elements stay hash-restricted.
      styleDirective: {
        resources: [
          { resource: "'self'", kind: "element" },
          { resource: "'unsafe-inline'", kind: "attribute" },
        ],
      },
    },
  },
  vite: {
    // Fixture builds share dependencies, but must not invalidate the live server's cache.
    cacheDir: fileURLToPath(new URL("./.astro/vite", import.meta.url)),
    plugins: [tailwindcss()],
  },
});
