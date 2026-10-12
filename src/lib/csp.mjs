// Shared by astro.config.mjs (meta policy) and the Azure header consistency test.
// Astro appends script-src and style-src with per-page hashes.
export const cspDirectives = [
  "default-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "img-src 'self'",
  "connect-src 'self'",
];

// Browsers enforce every delivered policy, so the header must not restrict scripts
// or styles (it cannot know the per-page hashes). It omits default-src, which would
// otherwise become the script fallback, and adds frame-ancestors, which meta ignores.
export const headerPolicy = [
  ...cspDirectives.filter((directive) => !directive.startsWith("default-src ")),
  "frame-ancestors 'none'",
].join("; ");
