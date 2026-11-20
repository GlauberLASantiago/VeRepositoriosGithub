"use strict";

const byId = id => document.getElementById(id);
const account = byId("account");
const filter = byId("filter");
const missingOnly = byId("missing-only");
const order = byId("order");
const results = byId("results");
const statusLine = byId("status");
const dateFormat = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "numeric" });
const nameOrder = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });
const defaultAccount = account.defaultValue;
let request;
let repos = [];
let owner = "";
let feedbackAction;
const cards = new Map();
let coverUpdateFrame;

function readPreference(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function savePreference(key, value) {
  try { localStorage.setItem(key, value); } catch { /* O catálogo funciona sem armazenamento. */ }
}

function setTheme(dark) {
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  byId("theme").setAttribute("aria-pressed", String(dark));
}

const theme = readPreference("theme");
setTheme(theme ? theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches);
byId("theme").addEventListener("click", () => {
  setTheme(document.documentElement.dataset.theme !== "dark");
  savePreference("theme", document.documentElement.dataset.theme);
});

function setView(view) {
  results.classList.toggle("list", view === "list");
  for (const id of ["grid", "list"]) byId(id).setAttribute("aria-pressed", String(id === view));
}

setView(readPreference("pages-view") === "list" ? "list" : "grid");
for (const id of ["grid", "list"]) {
  byId(id).addEventListener("click", () => {
    setView(id);
    savePreference("pages-view", id);
  });
}

function feedback(message = "", label, action) {
  byId("feedback").hidden = !message;
  byId("message").textContent = message;
  byId("action").hidden = !label;
  byId("action").textContent = label || "";
  feedbackAction = action;
}
byId("action").addEventListener("click", () => feedbackAction?.());

function normalize(text) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function siteAddress(repo) {
  const host = repo.owner.login.toLowerCase() + ".github.io";
  return "https://" + host + "/" + (repo.name.toLowerCase() === host ? "" : encodeURIComponent(repo.name) + "/");
}

function webAddress(value, base) {
  try {
    const url = new URL(value, base);
    if (["https:", "http:"].includes(url.protocol) && !url.username && !url.password) return url.href;
  } catch { /* Endereço inválido informado pelo site. */ }
  return null;
}

async function readCover(repo, signal) {
  const response = await fetch(siteAddress(repo), {
    credentials: "omit", referrerPolicy: "no-referrer",
    signal: AbortSignal.any([signal, AbortSignal.timeout(15000)])
  });
  if (!response.ok || !/text\/html|application\/xhtml\+xml/i.test(response.headers.get("content-type") || "")) {
    throw new Error("Página HTML indisponível");
  }
  // O template mantém o HTML externo inerte enquanto lemos os metadados.
  const template = document.createElement("template");
  template.innerHTML = await response.text();
  const html = template.content;
  const base = webAddress(html.querySelector("base[href]")?.getAttribute("href") || response.url, response.url) || response.url;
  const tags = Array.from(html.querySelectorAll("meta[property], meta[name]"));
  const keys = ["og:image:secure_url", "og:image", "og:image:url", "twitter:image", "twitter:image:src"];
  const values = keys.flatMap(key => tags.filter(tag =>
    [tag.getAttribute("property"), tag.name].some(name => name?.trim().toLowerCase() === key)
  ).map(tag => tag.content.trim()).filter(Boolean));
  const images = [...new Set(values.map(value => webAddress(value, base)).filter(Boolean))];
  return { state: images.length ? "found" : values.length ? "unknown" : "missing", images };
}

function updateCover(card, repo) {
  const box = card.querySelector(".cover");
  const label = box.querySelector(".cover-label");
  const cover = repo.cover;
  const labels = { pending: "Verificando capa…", missing: "Sem capa", unknown: "Não foi possível verificar" };
  label.hidden = cover.state === "found";
  label.textContent = labels[cover.state] || "";
  if (cover.state !== "found") return;
  const image = document.createElement("img");
  image.alt = "";
  image.loading = "lazy";
  image.decoding = "async";
  image.referrerPolicy = "no-referrer";
  let candidate = 0;
  image.onerror = () => {
    if (++candidate < cover.images.length) {
      image.src = cover.images[candidate];
      return;
    }
    image.remove();
    cover.state = "unknown";
    updateCover(card, repo);
    if (cards.get(repo) === card) scheduleCoverUpdate();
  };
  image.src = cover.images[0];
  box.append(image);
}

function updateCoverSummary() {
  const summary = byId("cover-summary");
  summary.hidden = !repos.length;
  const counts = { found: 0, missing: 0, unknown: 0, pending: 0 };
  for (const repo of repos) counts[repo.cover.state]++;
  const parts = [counts.found + " com capa", counts.missing + " sem capa"];
  if (counts.unknown) parts.push(counts.unknown + " sem verificação");
  if (counts.pending) parts.push("Verificando " + counts.pending + "…");
  summary.textContent = parts.join(" · ");
}

function scheduleCoverUpdate() {
  if (coverUpdateFrame) return;
  coverUpdateFrame = requestAnimationFrame(() => {
    coverUpdateFrame = 0;
    if (missingOnly.checked) render();
    else updateCoverSummary();
  });
}

async function scanCovers(items, signal) {
  const queue = [...items].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).values();
  async function worker() {
    for (const repo of queue) {
      if (signal.aborted) return;
      try { repo.cover = await readCover(repo, signal); }
      catch { repo.cover = { state: "unknown" }; }
      if (signal.aborted) return;
      const card = cards.get(repo);
      if (card) updateCover(card, repo);
      scheduleCoverUpdate();
    }
  }
  await Promise.all(Array.from({ length: Math.min(5, items.length) }, worker));
}

function buildCard(repo) {
  if (cards.has(repo)) return cards.get(repo);
  const card = byId("card").content.firstElementChild.cloneNode(true);
  const login = repo.owner.login;
  const site = card.querySelector(".site");
  site.textContent = repo.name;
  site.href = siteAddress(repo);
  site.setAttribute("aria-label", "Abrir site " + repo.name);
  const code = card.querySelector(".code");
  code.href = "https://github.com/" + encodeURIComponent(login) + "/" + encodeURIComponent(repo.name);
  code.setAttribute("aria-label", "Ver código de " + repo.name);
  card.querySelector(".description").textContent = repo.description || "Sem descrição.";
  card.querySelector(".lang").textContent = repo.language || "";
  const stars = card.querySelector(".stars");
  stars.textContent = "☆ " + repo.stargazers_count;
  stars.setAttribute("aria-label", repo.stargazers_count + " estrelas");
  card.querySelector(".date").textContent = "Atualizado em " + dateFormat.format(new Date(repo.updated_at));
  cards.set(repo, card);
  updateCover(card, repo);
  return card;
}

function render() {
  const term = normalize(filter.value);
  const visible = repos.filter(repo => (!missingOnly.checked || repo.cover.state === "missing") &&
    normalize(repo.name + " " + (repo.description || "")).includes(term));
  visible.sort((a, b) => {
    if (order.value === "az") return nameOrder.compare(a.name, b.name);
    if (order.value === "za") return nameOrder.compare(b.name, a.name);
    return order.value === "old" ? a.updated_at.localeCompare(b.updated_at) : b.updated_at.localeCompare(a.updated_at);
  });
  const total = repos.length + (repos.length === 1 ? " site" : " sites");
  statusLine.textContent = (term || missingOnly.checked ? visible.length + " de " : "") + total + " de @" + owner;
  updateCoverSummary();
  // Mantém o foco e as imagens já carregadas quando a verificação adiciona resultados.
  const visibleCards = visible.map(buildCard);
  const keep = new Set(visibleCards);
  for (const card of Array.from(results.children)) {
    if (!keep.has(card)) card.remove();
  }
  visibleCards.forEach((card, index) => {
    const current = results.children[index];
    if (current !== card) results.insertBefore(card, current || null);
  });
  if (!repos.length) {
    feedback("Este perfil ainda não tem repositórios públicos com GitHub Pages ativo.");
  } else if (!visible.length && missingOnly.checked && repos.some(repo => repo.cover.state === "pending")) {
    feedback("Buscando sites sem capa…");
  } else if (!visible.length) {
    feedback("Nenhum site corresponde ao filtro.", "Limpar filtro", () => {
      filter.value = "";
      missingOnly.checked = false;
      render();
      filter.focus();
    });
  } else {
    feedback();
  }
}

function profileName(value) {
  const match = value.trim().match(/^(?:(?:https?:\/\/)?(?:www\.)?github\.com\/|@)?([a-z0-9][a-z0-9_-]{0,38})\/?$/i);
  return match?.[1];
}

function apiMessage(response) {
  if (response.status === 404) return "Perfil não encontrado. Confira o nome e busque novamente.";
  if (response.status === 429 || (response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0")) {
    const reset = Number(response.headers.get("x-ratelimit-reset"));
    return "O GitHub limitou as consultas." + (reset ? " Tente novamente após " + new Date(reset * 1000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) + "." : " Tente novamente mais tarde.");
  }
  return "O GitHub retornou o erro " + response.status + ". Tente novamente.";
}

async function search(login) {
  request?.abort();
  const controller = new AbortController();
  request = controller;
  repos = [];
  cards.clear();
  cancelAnimationFrame(coverUpdateFrame);
  coverUpdateFrame = 0;
  missingOnly.checked = false;
  byId("cover-summary").hidden = true;
  filter.value = "";
  results.replaceChildren();
  feedback();
  byId("tools").hidden = true;
  byId("profile").hidden = true;
  statusLine.textContent = "Buscando sites de @" + login + "…";
  const collected = [];
  let canonicalLogin = login;
  try {
    let page = 1;
    let hasNext;
    do {
      const response = await fetch("https://api.github.com/users/" + encodeURIComponent(login) + "/repos?per_page=100&sort=full_name&page=" + page, { signal: controller.signal });
      if (!response.ok) throw new Error(apiMessage(response));
      const batch = await response.json();
      if (controller.signal.aborted) return;
      if (batch.length) canonicalLogin = batch[0].owner.login;
      collected.push(...batch.filter(repo => repo.has_pages));
      hasNext = /rel="next"/.test(response.headers.get("link") || "");
      page++;
    } while (hasNext);
    owner = canonicalLogin;
    repos = collected;
    for (const repo of repos) repo.cover = { state: "pending" };
    const profile = byId("profile");
    profile.href = "https://github.com/" + encodeURIComponent(owner);
    profile.hidden = false;
    byId("tools").hidden = !repos.length;
    render();
    scanCovers(repos, controller.signal);
    if (location.protocol === "https:" || location.protocol === "http:") {
      const url = new URL(location.href);
      url.searchParams.set("perfil", owner);
      history.replaceState(null, "", url);
    }
  } catch (error) {
    if (controller.signal.aborted) return;
    statusLine.textContent = "A busca por @" + login + " não foi concluída.";
    feedback(error instanceof TypeError ? "Confira sua conexão com a internet e tente novamente." : error.message, "Tentar novamente", () => search(login));
  }
}

function submitSearch() {
  const login = profileName(account.value);
  if (!login) {
    account.setCustomValidity("Digite um nome de usuário, @usuário ou link de perfil do GitHub.");
    account.reportValidity();
    return;
  }
  account.value = login;
  search(login);
}

account.addEventListener("input", () => account.setCustomValidity(""));
byId("search").addEventListener("submit", event => {
  event.preventDefault();
  submitSearch();
});
filter.addEventListener("input", render);
missingOnly.addEventListener("change", render);
order.addEventListener("change", render);

account.value = new URLSearchParams(location.search).get("perfil") || defaultAccount;
submitSearch();
