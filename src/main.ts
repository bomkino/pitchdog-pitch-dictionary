import "./styles.css";
import { fuzzySearch } from "./search.ts";
import { CATEGORIES, TERMS, usEnglish, type Category, type PitchTerm } from "./terms.ts";
import { connectionDegree, constellationFor, mountConstellation, type GalaxyController } from "./constellation.ts";
import { announce, attachReveal, bindTheme, escapeHTML, footer, header, initialiseThreadCursor, landAtTop, type ProductMeta } from "./ui.ts";

const META: ProductMeta = { name: "Pitch Dictionary.", eyebrow: `${TERMS.length} words, no fog`, storageKey: "pitch-dictionary.theme" };
const app = document.querySelector<HTMLDivElement>("#app")!;
if (!app) throw new Error("Pitch Dictionary could not find its stage.");
document.body.dataset.product = "pitch-dictionary";

const state: { query: string; category: Category | "All"; letter: string; visible: number; surpriseIndex: number; active?: string } = {
  query: "",
  category: "All",
  letter: "",
  visible: 24,
  surpriseIndex: -1,
};

const SURPRISE_TERMS = ["pitch", "proof-point", "cold-open", "consent", "runway", "whitespace", "scope-creep", "series-engine", "decision-owner"] as const;
let heroGalaxy: GalaxyController | undefined;
let detailGalaxy: GalaxyController | undefined;
let dialogReturnFocus: HTMLElement | undefined;
let searchAnnouncementTimer = 0;

function filtered(): PitchTerm[] {
  let terms = fuzzySearch(TERMS, state.query);
  if (state.category !== "All") terms = terms.filter((term) => term.category === state.category);
  if (state.letter) terms = terms.filter((term) => term.label.toLocaleUpperCase("en").startsWith(state.letter));
  return terms;
}

function render(): void {
  document.title = "Pitch Dictionary — plain English for pitch work";
  app.innerHTML = `${header(META)}<main id="main">
    <section class="dictionary-hero" id="word-galaxy">
      <div class="dictionary-hero__copy">
        <p class="scope-tag">Film · advertising · startups · rooms · rights</p>
        <p class="kicker">Clear the doubt. Keep your place.</p>
        <h1 data-page-heading tabindex="-1">Pitch language. In orbit.</h1>
        <p>Search ${TERMS.length} terms—or travel from one idea to the next. Hover for a quick meaning. Choose a star to make it the centre.</p>
        <div class="hero-actions">
          <a class="primary-action" href="#dictionary-search">Find a word <span aria-hidden="true">↓</span></a>
          <button class="sky-action" id="begin-voyage" type="button">Enter the word galaxy ↗</button>
        </div>
      </div>
      <div class="constellation-stage" id="constellation-preview"></div>
      <p class="galaxy-position" aria-hidden="true"><span id="galaxy-position">Pitch · ${connectionDegree(TERMS.find((term) => term.id === "pitch")!, TERMS)} routes</span> · one word at a time</p>
    </section>

    <section class="galaxy-legend" id="constellations" data-reveal>
      <div><p class="kicker">How this sky works</p><h2>Connections have consequences.</h2></div>
      <p>Big stars have more useful routes. Bright paths are close editorial relationships. Faint stars sit farther out—but can still get you somewhere worth going.</p>
      <ul>
        <li><i class="legend-star legend-star--large" aria-hidden="true"></i><span><strong>Gravity</strong> follows how connected a term is.</span></li>
        <li><i class="legend-star legend-star--bright" aria-hidden="true"></i><span><strong>Light</strong> follows how close the relationship is.</span></li>
        <li><i class="legend-line" aria-hidden="true"></i><span><strong>Paths</strong> come from visible editorial links—not hidden AI.</span></li>
      </ul>
    </section>

    <section class="dictionary-work" id="dictionary-search">
      <div class="search-intro" data-reveal><p class="kicker">Need the direct route?</p><h2>What is getting in the way?</h2><p>Try <button type="button" data-suggest="loglne">“loglne”</button>, <button type="button" data-suggest="RTB">“RTB”</button>, <button type="button" data-suggest="unpaid pitch">“unpaid pitch”</button>, or <button type="button" id="surprise-term">surprise me</button>.</p></div>
      <div class="search-box"><label for="term-search">Search ${TERMS.length} pitch terms</label><div><input id="term-search" type="search" autocomplete="off" spellcheck="false" placeholder="Type a word, meaning, acronym, or glorious misspelling…" value="${escapeHTML(state.query)}"><kbd>/</kbd></div><p>Fuzzy search checks names, aliases, meanings, categories, and near-matches. Your query stays here.</p></div>
      <div class="category-strip" aria-label="Browse by category"><button type="button" data-category="All" aria-pressed="${state.category === "All"}">All <span>${TERMS.length}</span></button>${CATEGORIES.map((category) => `<button type="button" data-category="${category}" aria-pressed="${state.category === category}">${usEnglish(category)} <span>${TERMS.filter((term) => term.category === category).length}</span></button>`).join("")}</div>
      <div class="alphabet-strip" aria-label="Browse alphabetically"><button type="button" data-letter="" aria-pressed="${!state.letter}">Any</button>${"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letter) => `<button type="button" data-letter="${letter}" aria-pressed="${state.letter === letter}" ${TERMS.some((term) => term.label.toUpperCase().startsWith(letter)) ? "" : "disabled"}>${letter}</button>`).join("")}</div>
      <div id="results">${resultsMarkup()}</div>
    </section>

    <dialog class="term-dialog" id="term-dialog" aria-labelledby="term-dialog-title">
      <div class="term-detail__top"><span id="term-dialog-category"></span><button type="button" id="close-term" aria-label="Close definition">×</button></div>
      <div class="term-detail-layout">
        <article class="term-copy" id="term-copy"></article>
        <section class="term-observatory" aria-labelledby="term-observatory-title">
          <div class="term-observatory__intro"><p class="kicker">The neighboring ideas</p><h3 id="term-observatory-title">Travel the thought.</h3><p>Choose another star. The definition changes; your place in the galaxy does not.</p></div>
          <div class="constellation-stage constellation-stage--detail" id="detail-constellation"></div>
          <div class="constellation-list" id="detail-routes" aria-label="Related terms"></div>
        </section>
      </div>
      <p class="definition-boundary">A plain-language working definition—not legal, financial, medical, or universal industry advice.</p>
    </dialog>
  </main>${footer("Pitch Dictionary")}`;

  bindTheme(META.storageKey);
  bindStaticEvents();
  attachReveal();
  landAtTop();
  mountHeroGalaxy();
}

function resultsMarkup(): string {
  const all = filtered();
  const shown = all.slice(0, state.visible);
  const description = state.query ? `${all.length} ${all.length === 1 ? "match" : "matches"} for “${escapeHTML(state.query)}”` : `${all.length} useful terms`;
  return `<div class="results-heading"><div><p class="kicker">${state.category === "All" ? "Across the work" : escapeHTML(usEnglish(state.category))}</p><h3>${description}</h3></div>${state.query || state.category !== "All" || state.letter ? '<button type="button" id="clear-filters">Clear filters</button>' : ""}</div>
  ${shown.length ? `<div class="term-grid">${shown.map(termCard).join("")}</div>${all.length > shown.length ? `<button class="load-more" id="load-more" type="button">Show ${Math.min(24, all.length - shown.length)} more <span>${shown.length} / ${all.length}</span></button>` : ""}` : `<div class="no-results"><strong>No confident match.</strong><p>Try fewer words or browse a category. The dictionary would rather admit it than serve random fog.</p></div>`}`;
}

function termCard(term: PitchTerm): string {
  return `<button class="term-card" type="button" data-open-term="${term.id}"><span>${escapeHTML(usEnglish(term.category))}</span><strong>${escapeHTML(term.label)}</strong><p>${escapeHTML(term.plain)}</p><i aria-hidden="true">↗</i></button>`;
}

function mountHeroGalaxy(): void {
  heroGalaxy?.destroy();
  const stage = document.querySelector<HTMLElement>("#constellation-preview");
  const pitch = TERMS.find((term) => term.id === "pitch");
  if (!stage || !pitch) return;
  heroGalaxy = mountConstellation(stage, pitch, TERMS, {
    variant: "hero",
    onCenterChange: (term, _previous, cause) => {
      const position = document.querySelector<HTMLElement>("#galaxy-position");
      const degree = connectionDegree(term, TERMS);
      if (position) position.textContent = `${term.label} · ${degree} ${degree === 1 ? "route" : "routes"}`;
      if (cause !== "initial") announce(`Now orbiting ${term.label}. ${term.plain}`);
    },
    onOpenDefinition: (term) => openTerm(term.id),
  });
}

function renderTermCopy(term: PitchTerm): void {
  const copy = document.querySelector<HTMLElement>("#term-copy");
  const category = document.querySelector<HTMLElement>("#term-dialog-category");
  const routes = document.querySelector<HTMLElement>("#detail-routes");
  if (!copy || !category || !routes) return;
  const confused = term.oftenConfusedWith.map((ref) => TERMS.find((item) => item.id === ref)).filter(Boolean) as PitchTerm[];
  const related = constellationFor(term, TERMS, 10);
  category.textContent = usEnglish(term.category);
  copy.innerHTML = `<h2 id="term-dialog-title" tabindex="-1">${escapeHTML(term.label)}</h2>${term.aliases.length ? `<p class="aliases">Also: ${term.aliases.map(escapeHTML).join(", ")}</p>` : ""}<p class="plain-definition">${escapeHTML(term.plain)}</p><div class="definition-pair"><section><p class="kicker">Why it matters</p><p>${escapeHTML(term.whyItMatters)}</p></section><section><p class="kicker">What it changes</p><p>${escapeHTML(term.changes)}</p></section></div>${confused.length ? `<section class="term-links"><p class="kicker">Often confused with</p>${confused.map((item) => `<button type="button" data-related="${item.id}">${escapeHTML(item.label)} ↗</button>`).join("")}</section>` : ""}`;
  routes.innerHTML = related.map((item) => `<button type="button" data-related="${item.id}"><span>${escapeHTML(item.label)}</span><span aria-hidden="true">↗</span></button>`).join("");
  state.active = term.id;
  document.querySelectorAll<HTMLButtonElement>("[data-related]").forEach((button) => button.addEventListener("click", (event) => detailGalaxy?.travelTo(button.dataset.related ?? "", event.detail === 0 ? "keyboard" : "pointer")));
  copy.classList.remove("term-copy--arriving");
  requestAnimationFrame(() => copy.classList.add("term-copy--arriving"));
}

function openTerm(id: string): void {
  const term = TERMS.find((item) => item.id === id);
  const dialog = document.querySelector<HTMLDialogElement>("#term-dialog");
  const stage = document.querySelector<HTMLElement>("#detail-constellation");
  if (!term || !dialog || !stage) return;

  if (dialog.open) {
    detailGalaxy?.travelTo(id, "programmatic");
    return;
  }

  dialogReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
  renderTermCopy(term);
  dialog.showModal();
  document.body.classList.add("dialog-open");
  dialog.scrollTo({ top: 0, behavior: "auto" });
  detailGalaxy?.destroy();
  detailGalaxy = mountConstellation(stage, term, TERMS, {
    variant: "detail",
    onCenterChange: (next, _previous, cause) => {
      if (cause === "initial") return;
      const scrollTop = dialog.scrollTop;
      renderTermCopy(next);
      requestAnimationFrame(() => { dialog.scrollTop = scrollTop; });
      announce(`Travelled to ${next.label}. ${next.plain}`);
    },
  });
  requestAnimationFrame(() => document.querySelector<HTMLElement>("#term-dialog-title")?.focus({ preventScroll: true }));
}

function updateResults(focus = false, announceImmediately = true): void {
  const results = document.querySelector<HTMLElement>("#results");
  if (!results) return;
  results.innerHTML = resultsMarkup();
  bindResultEvents();
  const count = filtered().length;
  clearTimeout(searchAnnouncementTimer);
  const report = () => announce(`${count} ${count === 1 ? "term" : "terms"} found.`);
  if (announceImmediately) report();
  else searchAnnouncementTimer = window.setTimeout(report, 180);
  if (focus) results.querySelector<HTMLElement>("button")?.focus();
}

function bindResultEvents(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-open-term]").forEach((button) => button.addEventListener("click", () => openTerm(button.dataset.openTerm ?? "")));
  document.querySelector("#load-more")?.addEventListener("click", () => { state.visible += 24; updateResults(); });
  document.querySelector("#clear-filters")?.addEventListener("click", () => {
    state.query = "";
    state.category = "All";
    state.letter = "";
    state.visible = 24;
    const input = document.querySelector<HTMLInputElement>("#term-search");
    if (input) input.value = "";
    document.querySelectorAll("[aria-pressed]").forEach((node) => node.setAttribute("aria-pressed", "false"));
    document.querySelector('[data-category="All"]')?.setAttribute("aria-pressed", "true");
    document.querySelector('[data-letter=""]')?.setAttribute("aria-pressed", "true");
    updateResults();
  });
}

function bindStaticEvents(): void {
  document.querySelector(".brand")?.addEventListener("click", (event) => { event.preventDefault(); landAtTop(); });
  document.querySelector("#begin-voyage")?.addEventListener("click", () => {
    const compact = matchMedia("(max-width: 900px)").matches;
    if (compact) document.querySelector("#constellation-preview")?.scrollIntoView({
      block: "start",
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
    requestAnimationFrame(() => heroGalaxy?.focusCenter());
  });
  const input = document.querySelector<HTMLInputElement>("#term-search");
  input?.addEventListener("input", () => { state.query = input.value; state.visible = 24; updateResults(false, false); });
  document.querySelectorAll<HTMLButtonElement>("[data-suggest]").forEach((button) => button.addEventListener("click", () => {
    if (!input) return;
    input.value = button.dataset.suggest ?? "";
    state.query = input.value;
    state.visible = 24;
    updateResults();
    input.focus();
    document.querySelector("#dictionary-search")?.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }));
  document.querySelectorAll<HTMLButtonElement>("[data-category]").forEach((button) => button.addEventListener("click", () => {
    state.category = button.dataset.category as Category | "All";
    state.visible = 24;
    document.querySelectorAll("[data-category]").forEach((node) => node.setAttribute("aria-pressed", String(node === button)));
    updateResults();
  }));
  document.querySelectorAll<HTMLButtonElement>("[data-letter]").forEach((button) => button.addEventListener("click", () => {
    state.letter = button.dataset.letter ?? "";
    state.visible = 24;
    document.querySelectorAll("[data-letter]").forEach((node) => node.setAttribute("aria-pressed", String(node === button)));
    updateResults();
  }));
  document.querySelector("#surprise-term")?.addEventListener("click", () => {
    state.surpriseIndex = (state.surpriseIndex + 1) % SURPRISE_TERMS.length;
    openTerm(SURPRISE_TERMS[state.surpriseIndex]!);
  });
  bindResultEvents();

  const dialog = document.querySelector<HTMLDialogElement>("#term-dialog");
  dialog?.querySelector("#close-term")?.addEventListener("click", () => dialog.close());
  dialog?.addEventListener("close", () => {
    detailGalaxy?.destroy();
    detailGalaxy = undefined;
    document.body.classList.remove("dialog-open");
    state.active = undefined;
    dialogReturnFocus?.focus({ preventScroll: true });
    dialogReturnFocus = undefined;
  });
  dialog?.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  document.addEventListener("keydown", (event) => {
    const active = document.activeElement;
    const editing = active instanceof HTMLElement && (active.matches("input, textarea, select") || active.isContentEditable);
    const isSearchShortcut = event.key === "/" || event.code === "Slash";
    if (isSearchShortcut && !dialog?.open && !editing) {
      event.preventDefault();
      input?.focus();
      // Some browsers finish a focused button's default key handling after
      // dispatch. Reassert once on the next task if that stole focus back.
      window.setTimeout(() => {
        if (!dialog?.open && document.activeElement !== input) input?.focus();
      }, 0);
    }
  }, { capture: true });
}

history.scrollRestoration = "manual";
initialiseThreadCursor();
render();
window.addEventListener("pagehide", () => { heroGalaxy?.destroy(); detailGalaxy?.destroy(); }, { once: true });
