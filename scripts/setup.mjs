import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadConfig, repoRoot } from "./lib/config.mjs";
import { buildMarketplace, pathsFor, serialize, writeMarketplace } from "./lib/marketplace.mjs";

export const setupHelp = `Configure marketplace.config.json and regenerate both catalogs.

Usage:
  bun run setup --organization Acme --repository acme/copilot-marketplace [options]

Required:
  --organization NAME   Company display name and catalog owner
  --repository REPO     GitHub owner/repository, not a URL

Options:
  --name KEY            Marketplace registration key (default: current key)
  --title TITLE         Site title (default: "<organization> Marketplace")
  --logo PATH           Light logo relative to public/ (default: current logo)
  --logo-dark PATH      Dark logo relative to public/ (default: current dark logo)
  --force               Allow replacing an already configured identity
  --help                Show this help without writing files

Place supplied logos under public/branding/ before running setup.
Version, description, and omitted logos are preserved. Template/example owner
emails are removed; changing an existing organization also clears its email.
Plugin repositories are never rewritten. See docs/customization.md.
`;

export function parseSetupArgs(args) {
  const valueOptions = new Set(["organization", "repository", "name", "title", "logo", "logo-dark"]);
  const flagOptions = new Set(["force", "help"]);
  const options = {};
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    const key = argument.startsWith("--") ? argument.slice(2) : "";
    if (!valueOptions.has(key) && !flagOptions.has(key)) {
      throw new Error(`Unknown argument "${argument}". Run "bun run setup --help".`);
    }
    if (Object.hasOwn(options, key)) throw new Error(`Duplicate argument --${key}. Supply it once.`);
    if (flagOptions.has(key)) {
      options[key] = true;
    } else {
      const value = args[++index];
      if (!value || value.startsWith("--") || !value.trim()) {
        throw new Error(`Missing value for --${key}. Run "bun run setup --help".`);
      }
      options[key] = value;
    }
  }
  if (!options.help) {
    for (const key of ["organization", "repository"]) {
      if (!options[key]) throw new Error(`Required argument --${key} is missing. Run "bun run setup --help".`);
    }
  }
  return options;
}

function ownerEmailFor(current, organization) {
  const email = current.owner.email;
  if (!email) return undefined;
  const domain = email.slice(email.lastIndexOf("@") + 1).toLowerCase();
  const placeholder = /(^|\.)(example\.(com|org|net)|example|invalid|test|localhost)$/.test(domain);
  const changingOrganization = !current.repository.startsWith("your-org/") &&
    current.branding.organization !== organization;
  return placeholder || changingOrganization ? undefined : email;
}

/** Noninteractive entry point; rootDir isolates callers and tests from this checkout. */
export function setup(args, rootDir = repoRoot) {
  const options = parseSetupArgs(args);
  if (options.help) return { help: setupHelp };

  const current = loadConfig(rootDir);
  if (!current.repository.startsWith("your-org/") && !options.force) {
    throw new Error(
      `This marketplace is already configured for "${current.repository}". ` +
        'Review marketplace.config.json and pass --force to intentionally replace its identity.',
    );
  }

  const email = ownerEmailFor(current, options.organization);
  const candidate = {
    ...current,
    name: options.name ?? current.name,
    repository: options.repository,
    owner: { name: options.organization, ...(email ? { email } : {}) },
    branding: {
      ...current.branding,
      organization: options.organization,
      title: options.title ?? `${options.organization} Marketplace`,
      ...(options.logo !== undefined ? { logo: options.logo } : {}),
      ...(options["logo-dark"] !== undefined ? { logoDark: options["logo-dark"] } : {}),
    },
  };

  // Validate assets and prepare the complete catalog before touching any file.
  const marketplace = buildMarketplace(candidate, rootDir);
  writeFileSync(pathsFor(rootDir).configFile, serialize(candidate));
  writeMarketplace(marketplace, rootDir);
  return {
    config: candidate,
    marketplace,
    removedOwnerEmail: current.owner.email !== undefined && email === undefined,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = setup(process.argv.slice(2));
    if (result.help) {
      console.log(result.help);
    } else {
      console.log(
        `Configured ${result.config.branding.title} (${result.config.name}) at ${result.config.repository}.\n` +
          "Wrote marketplace.config.json and regenerated both catalogs. Plugin repositories are unchanged.",
      );
      if (result.removedOwnerEmail) {
        console.log("Removed the placeholder/previous organization's owner.email. Set a reviewed contact in the config if needed.");
      }
    }
  } catch (error) {
    console.error(`Setup failed: ${error.message}`);
    process.exitCode = 1;
  }
}
