import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { cspDirectives, headerPolicy } from "../src/lib/csp.mjs";

const swa = JSON.parse(readFileSync(new URL("../public/staticwebapp.config.json", import.meta.url), "utf8"));
const headers = swa.globalHeaders;

test("Azure header policy matches the shared CSP directives", () => {
  expect(headers["Content-Security-Policy"]).toBe(headerPolicy);
});

test("the header adds frame-ancestors but never restricts or loosens scripts and styles", () => {
  const names = headerPolicy.split("; ").map((directive) => directive.split(" ")[0]);
  expect(names).toContain("frame-ancestors");
  for (const name of ["default-src", "script-src", "script-src-elem", "style-src", "style-src-elem"]) {
    expect(names).not.toContain(name);
  }
});

test("no policy allows inline or evaluated scripts", () => {
  for (const policy of [headerPolicy, cspDirectives.join("; ")]) {
    expect(policy).not.toContain("'unsafe-inline'");
    expect(policy).not.toContain("'unsafe-eval'");
  }
  expect(cspDirectives).toContain("default-src 'self'");
  expect(cspDirectives).toContain("object-src 'none'");
});

test("Azure sets the companion security headers", () => {
  expect(headers["X-Content-Type-Options"]).toBe("nosniff");
  expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["Permissions-Policy"]).toMatch(/camera=\(\)/);
});
