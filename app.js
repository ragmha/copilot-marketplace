const state = { plugins: [], category: "All", query: "" };
const cliCommand = "copilot plugin marketplace add https://github.com/your-org/copilot-marketplace";
const settings = {
  app: JSON.stringify({ extraKnownMarketplaces: { "copilot-marketplace": { source: { source: "github", repo: "your-org/copilot-marketplace" } } } }, null, 2),
  cloud: JSON.stringify({ enabledPlugins: ["release-captain@copilot-marketplace", "review-companion@copilot-marketplace"], extraKnownMarketplaces: ["copilot-marketplace"] }, null, 2)
};

const $ = (id) => document.getElementById(id);

function pluginCard(plugin) {
  return `<article class="plugin-card">
    <div class="plugin-top"><div class="plugin-icon">${plugin.icon || "✦"}</div><span class="badge">${plugin.category}</span></div>
    <h3>${plugin.name}</h3>
    <p>${plugin.description}</p>
    <div class="plugin-footer"><span>v${plugin.version} · ${plugin.author}</span><a href="${plugin.repository}" target="_blank" rel="noreferrer">View plugin ↗</a></div>
  </article>`;
}

function filteredPlugins() {
  return state.plugins.filter((plugin) => {
    const matchesCategory = state.category === "All" || plugin.category === state.category;
    const haystack = `${plugin.name} ${plugin.description} ${plugin.category} ${plugin.author}`.toLowerCase();
    return matchesCategory && haystack.includes(state.query.toLowerCase());
  });
}

function render() {
  const visible = filteredPlugins();
  $("plugin-grid").innerHTML = visible.map(pluginCard).join("");
  $("result-count").textContent = `${visible.length} ${visible.length === 1 ? "plugin" : "plugins"}`;
  $("empty-state").hidden = visible.length !== 0;
}

function renderFilters() {
  const categories = ["All", ...new Set(state.plugins.map((plugin) => plugin.category))];
  $("filters").innerHTML = categories.map((category) => `<button class="filter ${category === state.category ? "active" : ""}" type="button" data-category="${category}">${category}</button>`).join("");
}

function copyText(text, label) {
  navigator.clipboard.writeText(text).then(() => {
    $("copy-status").textContent = `${label} copied to your clipboard.`;
  }).catch(() => {
    $("copy-status").textContent = `Copy failed. Use this value manually: ${text}`;
  });
}

function initInstallControls() {
  $("install-toggle").addEventListener("click", () => {
    const menu = $("install-menu");
    menu.hidden = !menu.hidden;
    $("install-toggle").setAttribute("aria-expanded", String(!menu.hidden));
  });
  $("app-install").addEventListener("click", () => copyText(settings.app, "GitHub Copilot app settings"));
  $("cli-copy").addEventListener("click", () => copyText(cliCommand, "Copilot CLI command"));
  $("install-menu").addEventListener("click", (event) => {
    const button = event.target.closest("[data-copy]");
    if (!button) return;
    copyText(settings[button.dataset.copy], button.textContent);
    $("install-menu").hidden = true;
    $("install-toggle").setAttribute("aria-expanded", "false");
  });
}

async function loadCatalog() {
  try {
    const response = await fetch("marketplace.json");
    if (!response.ok) throw new Error(`Catalog request failed with ${response.status}`);
    const catalog = await response.json();
    if (!Array.isArray(catalog.plugins)) throw new Error("Catalog must include a plugins array");
    state.plugins = catalog.plugins;
    $("featured-grid").innerHTML = state.plugins.filter((plugin) => plugin.featured).slice(0, 3).map(pluginCard).join("");
    renderFilters();
    render();
  } catch (error) {
    console.error(error);
    $("featured-grid").innerHTML = "";
    $("error-state").hidden = false;
  }
}

$("search").addEventListener("input", (event) => {
  state.query = event.target.value.trim();
  render();
});
 $("filters").addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  state.category = button.dataset.category;
  renderFilters();
  render();
});
initInstallControls();
loadCatalog();
