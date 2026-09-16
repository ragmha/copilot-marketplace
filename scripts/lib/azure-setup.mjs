import { createHash } from "node:crypto";

export const githubEnvironment = "azure-static-web-apps";
export const deploymentWorkflow = "azure-static-web-apps.yml";
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

export function azureSetupPlan(config, options) {
  if (!/^[a-z0-9][a-z0-9-]{1,22}[a-z0-9]$/.test(options.environment ?? "")) {
    throw new Error("Use an environment name of 3-24 lowercase letters, numbers, and hyphens.");
  }
  if (!uuid.test(options.subscription ?? "")) throw new Error("Supply the Azure subscription ID as a UUID.");
  if (!/^[a-z][a-z0-9]{1,39}$/.test(options.location ?? "")) {
    throw new Error("Supply an Azure region name such as westeurope or eastus2.");
  }
  const repository = config.repository;
  if (!/^(?!\.{1,2}\/)[A-Za-z0-9_.-]+\/(?!\.{1,2}$)[A-Za-z0-9_.-]+$/.test(repository) || /\s/.test(repository)) {
    throw new Error("Configure a GitHub owner/repository in marketplace.config.json first.");
  }
  const subscription = options.subscription.toLowerCase();
  const binding = createHash("sha256")
    .update(JSON.stringify([repository.toLowerCase(), options.environment, subscription, options.location]))
    .digest("hex");
  return {
    repository,
    environment: options.environment,
    subscription,
    location: options.location,
    dryRun: options.dryRun === true,
    placeholder: repository.toLowerCase().startsWith("your-org/"),
    binding,
    githubEnvironment,
  };
}

export function githubRepositoryFromRemote(remote) {
  const match = /^(?:https:\/\/github\.com\/|git@github\.com:)([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?$/.exec(remote);
  if (!match) throw new Error("origin must be an HTTPS or SSH GitHub.com repository without embedded credentials.");
  return match[1];
}

export function checkEnvironmentPolicy(environment, policies, branch) {
  if (environment.deployment_branch_policy?.custom_branch_policies !== true ||
      environment.deployment_branch_policy?.protected_branches !== false ||
      policies.total_count !== 1 ||
      policies.branch_policies?.length !== 1 ||
      policies.branch_policies[0].name !== branch ||
      policies.branch_policies[0].type !== "branch") {
    throw new Error(
      `Protect ${githubEnvironment} with exactly one deployment branch rule for "${branch}". ` +
      "Existing environment protection rules will not be overwritten by setup.",
    );
  }
}

export function checkAzureOutputs(values, plan) {
  for (const name of ["AZURE_CLIENT_ID", "AZURE_TENANT_ID"]) {
    if (!uuid.test(values[name] ?? "")) throw new Error(`Provisioning did not return a valid ${name}.`);
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(values.AZURE_RESOURCE_GROUP ?? "") ||
      !/^[a-zA-Z0-9-]+$/.test(values.AZURE_STATIC_WEB_APP_NAME ?? "")) {
    throw new Error("Provisioning did not return the Static Web App name and resource group.");
  }
  const id = `/subscriptions/${plan.subscription}/resourceGroups/${values.AZURE_RESOURCE_GROUP}/providers/Microsoft.Web/staticSites/${values.AZURE_STATIC_WEB_APP_NAME}`;
  if (values.AZURE_STATIC_WEB_APP_ID?.toLowerCase() !== id.toLowerCase() ||
      !/^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.azurestaticapps\.net\/?$/.test(values.AZURE_WEB_URL ?? "")) {
    throw new Error("The returned Static Web App does not match the selected subscription or expected Azure hostname.");
  }
}

export function describeAzureSetup(plan) {
  return [
    `Repository: ${plan.repository}`,
    `Azure subscription: ${plan.subscription}`,
    `Azure region: ${plan.location}`,
    `azd environment: ${plan.environment}`,
    "Resources: a dedicated resource group, Free Static Web App, and deployment managed identity.",
    `Trust: GitHub environment "${githubEnvironment}", restricted to the repository's default branch.`,
    "Access: Contributor on this Static Web App only; no subscription-wide pipeline role or client secret.",
    "Publication: a PUBLIC demo site. Do not deploy confidential catalog data.",
    "Setup pauses deployment, provisions with azd, saves non-secret GitHub variables, then enables Azure CI/CD.",
    "Existing websites are not unpublished. Existing environment reviewers and protection rules are preserved.",
    "No commit, push, repository creation, or plugin installation is performed.",
  ].join("\n");
}

/**
 * All external effects go through the injected driver, so tests exercise the
 * complete approval/order/failure behavior without Azure or GitHub writes.
 */
export async function configureAzure(plan, driver) {
  driver.log(describeAzureSetup(plan));
  if (plan.dryRun) {
    driver.log("Dry run only: no login, remote checks, files, resources, or repository settings changed.");
    return { status: "dry-run" };
  }
  if (plan.placeholder) throw new Error('Run "bun run setup" with your actual organization/repository first.');

  const repoPath = `repos/${plan.repository}`;
  const environmentPath = `${repoPath}/environments/${githubEnvironment}`;
  const git = (args) => driver.run("git", args).trim();
  if (git(["status", "--porcelain=v1"])) throw new Error("Commit and push your reviewed configuration and workflows before Azure setup.");
  if (githubRepositoryFromRemote(git(["remote", "get-url", "origin"])).toLowerCase() !== plan.repository.toLowerCase()) {
    throw new Error("origin does not match marketplace.config.json. Use your organization's adopted repository.");
  }
  const repo = driver.api("GET", repoPath);
  if (repo.full_name?.toLowerCase() !== plan.repository.toLowerCase() || repo.permissions?.admin !== true) {
    throw new Error("Sign in with GitHub repository admin permission to configure deployment environments.");
  }
  const branch = repo.default_branch;
  if (!branch || git(["branch", "--show-current"]) !== branch) {
    throw new Error("Run Azure setup from the repository's default branch.");
  }
  const refPath = `${repoPath}/git/ref/heads/${encodeURIComponent(branch)}`;
  const head = git(["rev-parse", "HEAD"]);
  const checkRemote = () => {
    if (driver.api("GET", refPath).object?.sha !== head) {
      throw new Error("The local commit differs from the remote default branch. Synchronize and review it before setup.");
    }
  };
  checkRemote();
  if (driver.api("GET", `${repoPath}/actions/permissions`).enabled !== true) {
    throw new Error("Enable GitHub Actions in your repository before setup.");
  }
  if (driver.api("GET", `${repoPath}/actions/oidc/customization/sub`).use_default !== true) {
    throw new Error("This setup requires GitHub's default OIDC subject format. Ask your administrator to adapt the trust for customized claims.");
  }
  const environment = driver.api("GET", environmentPath, undefined, true);
  const policyPath = `${environmentPath}/deployment-branch-policies`;
  if (environment) checkEnvironmentPolicy(environment, driver.api("GET", `${policyPath}?per_page=100`), branch);
  const variables = environment ? driver.api("GET", `${environmentPath}/variables?per_page=100`) : { total_count: 0, variables: [] };
  if (!Array.isArray(variables.variables) || variables.total_count > variables.variables.length) {
    throw new Error("Cannot safely inspect all deployment environment variables.");
  }
  const existing = Object.fromEntries(variables.variables.map((entry) => [entry.name, entry.value]));
  if (existing.AZURE_SETUP_BINDING && existing.AZURE_SETUP_BINDING !== plan.binding) {
    throw new Error("This GitHub environment is bound to a different Azure setup. Migrate it explicitly instead of repointing deployment.");
  }
  if (!existing.AZURE_SETUP_BINDING && Object.keys(existing).some((name) => name.startsWith("AZURE_"))) {
    throw new Error("Existing Azure environment variables were not created by this setup. Use the manual migration guidance.");
  }
  const selector = driver.api("GET", `${repoPath}/actions/variables/DEPLOY_TARGET`, undefined, true);
  if (selector?.value?.toLowerCase() === "azure" && existing.AZURE_AUTH_MODE !== "oidc") {
    throw new Error("An existing token deployment is active. Keep that path or migrate it manually; setup will not replace it.");
  }
  driver.run("azd", ["auth", "login", "--check-status"]);
  driver.run("bun", ["run", "validate"], { inherit: true });
  driver.run("bun", ["run", "marketplace:check"], { inherit: true });
  driver.log(`Default branch: ${branch}. Current DEPLOY_TARGET: ${selector?.value || "(Pages default)"}.`);

  if (!await driver.confirm(`Provision this PUBLIC demo and configure CI/CD for ${plan.repository}?`, `set up ${plan.repository}`)) {
    return { status: "cancelled" };
  }

  // Only activate the new target after provisioning, outputs, and GitHub policies are verified.
  driver.run("gh", ["variable", "set", "DEPLOY_TARGET", "--repo", plan.repository, "--body", "none"]);
  try {
    if (!environment) {
      driver.api("PUT", environmentPath, {
        deployment_branch_policy: { protected_branches: false, custom_branch_policies: true },
      });
      driver.api("POST", policyPath, { name: branch, type: "branch" });
    }
    const azd = (args, options) => driver.run("azd", [...args, "--environment", plan.environment, "--no-prompt"], options);
    const inputs = {
      AZURE_SUBSCRIPTION_ID: plan.subscription,
      AZURE_LOCATION: plan.location,
      AZURE_GITHUB_REPOSITORY: plan.repository,
      AZURE_PUBLICATION: "public-demo",
    };
    if (driver.hasLocalEnvironment(plan.environment)) {
      for (const [name, value] of Object.entries(inputs)) {
        if (azd(["env", "get-value", name]).trim() !== value) {
          throw new Error(`Local azd environment differs at ${name}. Use the original inputs or a new environment name.`);
        }
      }
    } else {
      driver.run("azd", ["env", "new", plan.environment, "--subscription", plan.subscription, "--location", plan.location, "--no-prompt"], { inherit: true });
      for (const [name, value] of Object.entries(inputs)) azd(["env", "set", name, value]);
    }
    azd(["provision", "--preview"], { inherit: true });
    if (!await driver.confirm("Apply the Azure changes shown above, including the resource-scoped deployment role?", "provision")) {
      driver.log("Stopped before provisioning. DEPLOY_TARGET remains none; the GitHub environment and local azd settings may exist.");
      return { status: "paused" };
    }
    azd(["provision"], { inherit: true });
    const outputs = Object.fromEntries([
      "AZURE_RESOURCE_GROUP", "AZURE_STATIC_WEB_APP_NAME", "AZURE_STATIC_WEB_APP_ID",
      "AZURE_CLIENT_ID", "AZURE_TENANT_ID", "AZURE_WEB_URL",
    ].map((name) => [name, azd(["env", "get-value", name]).trim()]));
    checkAzureOutputs(outputs, plan);
    const saved = {
      ...outputs,
      AZURE_SUBSCRIPTION_ID: plan.subscription,
      AZURE_LOCATION: plan.location,
      AZURE_ENV_NAME: plan.environment,
      AZURE_AUTH_MODE: "oidc",
      AZURE_SETUP_BINDING: plan.binding,
    };
    for (const [name, value] of Object.entries(saved)) {
      driver.run("gh", ["variable", "set", name, "--repo", plan.repository, "--env", githubEnvironment, "--body", value]);
    }
    checkEnvironmentPolicy(driver.api("GET", environmentPath), driver.api("GET", `${policyPath}?per_page=100`), branch);
    checkRemote();
    if (!await driver.confirm(
      "Enable Azure deployment on future default-branch pushes? The site will be public when published.",
      "enable azure",
    )) {
      driver.log("Infrastructure and CI/CD variables are ready. DEPLOY_TARGET remains none; no website content was deployed.");
      return { status: "paused", url: outputs.AZURE_WEB_URL };
    }
    driver.run("gh", ["variable", "set", "DEPLOY_TARGET", "--repo", plan.repository, "--body", "azure"]);
  } catch (error) {
    throw new Error(
      `Azure setup stopped: ${error.message}\nDEPLOY_TARGET was paused. Review any resources/settings already created before retrying; nothing is automatically deleted.`,
      { cause: error },
    );
  }
  const workflowUrl = `https://github.com/${plan.repository}/actions/workflows/${deploymentWorkflow}`;
  if (await driver.confirm("Start the first public website deployment now?", "deploy")) {
    driver.run("gh", ["workflow", "run", deploymentWorkflow, "--repo", plan.repository, "--ref", branch]);
    driver.log(`Deployment requested. Check its result at ${workflowUrl}`);
    return { status: "dispatched", workflowUrl };
  }
  driver.log(`CI/CD configured. No deployment started. Future default-branch pushes deploy; run manually at ${workflowUrl}`);
  return { status: "configured", workflowUrl };
}
