import { readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export function readJson(path) {
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch (error) {
    throw new Error(`Cannot read ${path}: ${error.message}`, { cause: error });
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON in ${path}: ${error.message}`, { cause: error });
  }
}

const ajv = new Ajv({ allErrors: true, allowUnionTypes: true, strict: false, verbose: true });
addFormats(ajv);
const validateSchema = ajv.compile(readJson(join(repoRoot, "schemas", "site-config.schema.json")));

function isWithin(root, target) {
  const path = relative(root, target);
  return path !== "" && path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}

function validateLogo(path, field, rootDir) {
  const publicDir = join(rootDir, "public");
  const asset = join(publicDir, ...path.split("/"));
  let realPublic;
  let realAsset;
  try {
    realPublic = realpathSync(publicDir);
    realAsset = realpathSync(asset);
    if (!statSync(realAsset).isFile()) {
      throw new Error("the asset is not a file");
    }
  } catch (error) {
    throw new Error(
      `marketplace.config.json /branding/${field}: cannot use "${path}". ` +
        `Place a readable logo file at ${asset} before configuring it (${error.message}).`,
      { cause: error },
    );
  }

  if (!isWithin(realpathSync(rootDir), realPublic) || !isWithin(realPublic, realAsset)) {
    throw new Error(
      `marketplace.config.json /branding/${field}: "${path}" resolves outside public/. ` +
        "Copy the logo into public/ instead of linking to an outside file.",
    );
  }
}

/** Validate without changing the candidate or writing files. */
export function validateConfig(config, rootDir = repoRoot) {
  if (!validateSchema(config)) {
    const errors = validateSchema.errors.map((error) => {
      const hint = error.parentSchema.description;
      return `  - ${error.instancePath || "(root)"} ${error.message}${hint ? `. ${hint}` : ""}`;
    });
    throw new Error(`marketplace.config.json failed validation:\n${errors.join("\n")}`);
  }

  for (const field of ["logo", "logoDark"]) {
    if (config.branding[field] !== undefined) validateLogo(config.branding[field], field, rootDir);
  }
  return config;
}

export function loadConfig(rootDir = repoRoot) {
  return validateConfig(readJson(join(rootDir, "marketplace.config.json")), rootDir);
}
