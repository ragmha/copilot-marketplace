// Keeps bun.lock registry-neutral. Registry tarball URLs become "", which Bun
// resolves through the reader's configured registry, and SHA-1 integrity is
// upgraded only to a published SHA-512 that matches the downloaded tarball.
// `--check` is offline and only verifies the URL and integrity shape.
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const SHA512 = /^sha512-[A-Za-z0-9+/]{86}==$/;
const SHA1 = /^sha1-[A-Za-z0-9+/]{27}=$/;
const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const LINE = /^    ("(?:[^"\\]|\\.)*"): (\[.*\]),$/;

function host(url) {
  try {
    return new URL(url).host || "(no host)";
  } catch {
    return "(unparseable URL)";
  }
}

function parseEntry(keyRaw, raw, lineNumber) {
  let key;
  let tuple;
  try {
    key = JSON.parse(keyRaw);
    tuple = JSON.parse(raw);
  } catch {
    throw new Error(`bun.lock:${lineNumber}: package entry is not valid JSON`);
  }
  const registry = Array.isArray(tuple) && tuple.length === 4
    && typeof tuple[0] === "string" && typeof tuple[1] === "string"
    && tuple[2] !== null && typeof tuple[2] === "object" && !Array.isArray(tuple[2])
    && typeof tuple[3] === "string";
  // Git, GitHub, tarball, file, link, workspace, and root entries use other shapes.
  if (!registry) return { key, lineNumber, registry: false };

  const at = tuple[0].lastIndexOf("@");
  const name = tuple[0].slice(0, at);
  const version = tuple[0].slice(at + 1);
  if (at <= 0 || !VERSION.test(version)) {
    throw new Error(`bun.lock:${lineNumber}: "${key}" has an unsupported registry resolution "${tuple[0]}"`);
  }
  const prefix = `[${JSON.stringify(tuple[0])}, ${JSON.stringify(tuple[1])}, `;
  const suffix = `, ${JSON.stringify(tuple[3])}]`;
  if (!raw.startsWith(prefix) || !raw.endsWith(suffix)) {
    throw new Error(`bun.lock:${lineNumber}: "${key}" uses an unsupported tuple layout`);
  }
  return {
    key, keyRaw, lineNumber, registry: true, name, version,
    id: `${name}@${version}`, url: tuple[1], integrity: tuple[3],
    middle: raw.slice(prefix.length, raw.length - suffix.length),
  };
}

export function parseLockfile(text) {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(eol);
  const start = lines.indexOf('  "packages": {');
  if (start < 0) throw new Error('bun.lock: no "packages" section; unsupported lockfile format');
  const entries = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line === "  }" || line === "  },") return { eol, lines, entries };
    if (line.trim() === "") continue;
    const match = LINE.exec(line);
    if (!match) throw new Error(`bun.lock:${i + 1}: unsupported package line format`);
    entries.push({ ...parseEntry(match[1], match[2], i + 1), index: i });
  }
  throw new Error('bun.lock: unterminated "packages" section');
}

export function checkLockfile(text) {
  const { entries } = parseLockfile(text);
  const issues = [];
  const counts = { registry: 0, sha512: 0, sha1: 0, exempt: 0 };
  for (const entry of entries) {
    if (!entry.registry) {
      counts.exempt++;
      continue;
    }
    counts.registry++;
    if (entry.url !== "") {
      issues.push(`${entry.id}: tarball URL is pinned to ${host(entry.url)}; Bun should resolve it through the configured registry ("")`);
    }
    if (SHA512.test(entry.integrity)) counts.sha512++;
    else if (SHA1.test(entry.integrity)) counts.sha1++;
    else issues.push(`${entry.id}: missing or unsupported integrity "${entry.integrity}"`);
  }
  return { issues, counts };
}

function portableUrl(entry) {
  if (entry.url === "") return "";
  let parsed;
  try {
    parsed = new URL(entry.url);
  } catch {
    throw new Error(`${entry.id}: tarball URL is not a valid URL`);
  }
  const file = `/${entry.name}/-/${entry.name.split("/").pop()}-${entry.version}.tgz`;
  const standard = (parsed.protocol === "https:" || parsed.protocol === "http:")
    && parsed.pathname.endsWith(file) && !parsed.search && !parsed.hash;
  if (!standard) {
    throw new Error(`${entry.id}: refusing to rewrite non-standard tarball URL on ${host(entry.url)}`);
  }
  return "";
}

const digest = (algorithm, bytes) => `${algorithm}-${createHash(algorithm).update(bytes).digest("base64")}`;

async function publishedIntegrity(id, sha1, dist, download) {
  if (!dist || typeof dist !== "object" || Array.isArray(dist)) {
    throw new Error(`${id}: registry metadata has no dist object`);
  }
  const hex = Buffer.from(sha1.slice(5), "base64").toString("hex");
  if (dist.shasum !== hex) {
    throw new Error(`${id}: published shasum ${dist.shasum ?? "(missing)"} does not match lockfile ${sha1}`);
  }
  if (dist.integrity !== undefined && typeof dist.integrity !== "string") {
    throw new Error(`${id}: published integrity is not a string`);
  }
  const tokens = (dist.integrity ?? "").split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    if (token.startsWith("sha1-") && token !== sha1) {
      throw new Error(`${id}: published integrity ${token} disagrees with lockfile ${sha1}`);
    }
  }
  const sha512 = tokens.filter((token) => token.startsWith("sha512-"));
  if (sha512.length === 0) return null;
  if (sha512.length > 1 || !SHA512.test(sha512[0])) {
    throw new Error(`${id}: published SHA-512 integrity is malformed`);
  }
  if (typeof dist.tarball !== "string") throw new Error(`${id}: registry metadata has no tarball URL`);

  let bytes;
  try {
    bytes = await download(dist.tarball);
  } catch (error) {
    throw new Error(`${id}: tarball download from ${host(dist.tarball)} failed: ${error.message}`);
  }
  if (digest("sha1", bytes) !== sha1) {
    throw new Error(`${id}: downloaded tarball does not match lockfile ${sha1}`);
  }
  if (digest("sha512", bytes) !== sha512[0]) {
    throw new Error(`${id}: downloaded tarball does not match published ${sha512[0]}`);
  }
  return sha512[0];
}

async function pool(items, limit, worker) {
  let next = 0;
  const run = async () => {
    while (next < items.length) await worker(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
}

export async function normalizeLockfile(text, { lookup, download, concurrency = 8, attempts = 3 }) {
  const { eol, lines, entries } = parseLockfile(text);
  const errors = [];
  const registry = entries.filter((entry) => entry.registry);
  const urls = new Map();
  const pending = new Map();

  for (const entry of registry) {
    try {
      urls.set(entry, portableUrl(entry));
    } catch (error) {
      errors.push(error.message);
    }
    if (SHA1.test(entry.integrity)) {
      const seen = pending.get(entry.id);
      if (seen && seen.sha1 !== entry.integrity) errors.push(`${entry.id}: lockfile lists conflicting SHA-1 values`);
      else pending.set(entry.id, { name: entry.name, version: entry.version, sha1: entry.integrity });
    } else if (!SHA512.test(entry.integrity)) {
      errors.push(`${entry.id}: missing or unsupported integrity "${entry.integrity}"`);
    }
  }

  const upgrades = new Map();
  const retained = [];
  if (errors.length === 0) {
    await pool([...pending], concurrency, async ([id, { name, version, sha1 }]) => {
      try {
        let dist;
        // Proxies drop some concurrent connections; retry, but surface the final failure.
        for (let attempt = 1; ; attempt++) {
          try {
            dist = await lookup(name, version);
            break;
          } catch (error) {
            if (attempt >= attempts) {
              throw new Error(`${id}: registry metadata lookup failed after ${attempts} attempt${attempts === 1 ? "" : "s"}: ${error.message}`);
            }
          }
        }
        const sha512 = await publishedIntegrity(id, sha1, dist, download);
        if (sha512) upgrades.set(id, sha512);
        else retained.push(id);
      } catch (error) {
        errors.push(error.message);
      }
    });
  }
  if (errors.length) {
    throw new Error(`bun.lock was not normalized (${errors.length} problem${errors.length === 1 ? "" : "s"}):\n  ${errors.sort().join("\n  ")}`);
  }

  let rewritten = 0;
  for (const entry of registry) {
    const url = urls.get(entry);
    const integrity = upgrades.get(entry.id) ?? entry.integrity;
    if (url === entry.url && integrity === entry.integrity) continue;
    if (url !== entry.url) rewritten++;
    lines[entry.index] = `    ${entry.keyRaw}: [${JSON.stringify(entry.id)}, ${JSON.stringify(url)}, ${entry.middle}, ${JSON.stringify(integrity)}],`;
  }
  const next = lines.join(eol);
  const { issues } = checkLockfile(next);
  if (issues.length) throw new Error(`normalized bun.lock still fails the check:\n  ${issues.join("\n  ")}`);
  return {
    text: next,
    summary: { urls: rewritten, upgraded: upgrades.size, retained: retained.sort() },
  };
}

export function bunInfoLookup(cwd) {
  return (name, version) => new Promise((resolveDist, reject) => {
    execFile("bun", ["info", `${name}@${version}`, "dist", "--json"], { cwd, maxBuffer: 1 << 20 }, (error, stdout, stderr) => {
      if (error) {
        const detail = String(stderr).trim().split(/\r?\n/)[0] || error.message;
        reject(new Error(`bun info exited ${error.code ?? "abnormally"}: ${detail}`));
        return;
      }
      try {
        resolveDist(JSON.parse(stdout));
      } catch {
        reject(new Error("bun info did not return JSON dist metadata"));
      }
    });
  });
}

export async function downloadTarball(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

if (import.meta.main) {
  const cwd = process.cwd();
  const file = resolve(cwd, "bun.lock");
  try {
    const text = readFileSync(file, "utf8");
    if (process.argv.includes("--check")) {
      const { issues, counts } = checkLockfile(text);
      if (issues.length) {
        console.error(`bun.lock is not registry-neutral (${issues.length} problem${issues.length === 1 ? "" : "s"}):\n  ${issues.join("\n  ")}\nRun \`bun run lockfile:normalize\` and commit the result.`);
        process.exit(1);
      }
      console.log(`bun.lock is registry-neutral: ${counts.registry} registry packages (${counts.sha512} SHA-512, ${counts.sha1} SHA-1 without published SHA-512), ${counts.exempt} non-registry entries.`);
    } else {
      const { text: next, summary } = await normalizeLockfile(text, { lookup: bunInfoLookup(cwd), download: downloadTarball });
      if (next !== text) writeFileSync(file, next);
      console.log(`Normalized bun.lock: ${summary.urls} tarball URLs made registry-neutral, ${summary.upgraded} SHA-1 entries upgraded to published SHA-512, ${summary.retained.length} SHA-1 entries retained because the registry publishes no SHA-512.`);
    }
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
