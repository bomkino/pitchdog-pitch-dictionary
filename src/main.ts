import "./styles.css";
import { fuzzySearch } from "./search.ts";
import { CATEGORIES, TERMS, usEnglish, type Category, type PitchTerm } from "./terms.ts";
import { initialiseWordDrop } from "./physics.ts";
import { constellationFor, mountConstellation } from "./constellation.ts";
import { announce, attachReveal, bindTheme, escapeHTML, footer, header, initialiseThreadCursor, landAtTop, type ProductMeta } from "./ui.ts";

const META: ProductMeta = { name: "Pitch Dictionary.", eyebrow: `${TERMS.length} words, no fog`, storageKey: "pitch-dictionary.theme" };
const app = document.querySelector<HTMLDivElement>("#app")!;
if (!app) throw new Error("Pitch Dictionary could not find its stage.");
document.body.dataset.product = "pitch-dictionary";
const state: { query: string; category: Category | "All"; letter: string; visible: number; active?: string } = { query: "", category: "All", letter: "", visible: 24 };
let detailConstellationCleanup: (() => void) | undefined;

function filtered(): PitchTerm[] {
  let terms = fuzzySearch(TERMS, state.query);
  if (state.category !== "All") terms = terms.filter((term) => term.category === state.category);
  if (state.letter) terms = terms.filter((term) => term.label.toLocaleUpperCase("en").startsWith(state.letter));
  return terms;
}

function render(): void {
  document.title = "Pitch Dictionary — plain English for pitch work";
  app.innerHTML = `${header(META)}<main id="main">
    <section class="dictionary-hero">
      <div class="dictionary-hero__copy"><p class="scope-tag">Words for the road · film · ads · startups · rooms · rights</p><p class="kicker">Clear the doubt. Keep your place.</p><h1 data-page-heading tabindex="-1">Plain English. Right here.</h1><p>Search by word, meaning, acronym, or typo. Open one answer without falling out of your work.</p><div class="hero-actions"><a class="primary-action" href="#dictionary-search">Find a word <span aria-hidden="true">↓</span></a><a class="sky-action" href="#constellations">Follow a thought ↘</a></div></div>
      <div class="physics-stage" id="physics-stage" aria-label="Interactive pitch words. Move the pointer to nudge them; activate a word to open its definition."><div class="physics-caption"><span>Move your pointer</span><strong>Words have weight.</strong></div></div>
    </section>
    <section class="constellation-intro" id="constellations">
      <div class="constellation-intro__copy"><p class="kicker">The constellations</p><h2>Words do not live alone.</h2><p>Search finds a definition. This shows the neighboring ideas—what a term touches, changes, or is too often mistaken for.</p><p class="sky-note">Start with <strong>Pitch</strong>. Choose any star to travel. No algorithmic rabbit hole; just useful editorial relationships.</p></div>
      <div class="constellation-preview"><div class="constellation-stage" id="constellation-preview" aria-live="polite"></div><p>One word in the middle. Eight useful ways out.</p></div>
    </section>
    <section class="dictionary-work" id="dictionary-search">
      <div class="search-intro"><p class="kicker">The dictionary</p><h2>What is getting in the way?</h2><p>Try <button type="button" data-suggest="loglne">“loglne”</button>, <button type="button" data-suggest="RTB">“RTB”</button>, <button type="button" data-suggest="unpaid pitch">“unpaid pitch”</button>, or a plain question such as <button type="button" data-suggest="who can decide">“who can decide?”</button></p></div>
      <div class="search-box"><label for="term-search">Search ${TERMS.length} pitch terms</label><div><input id="term-search" type="search" autocomplete="off" spellcheck="false" placeholder="Type a word, meaning, acronym, or glorious misspelling…" value="${escapeHTML(state.query)}"><kbd>/</kbd></div><p>Fuzzy search checks names, aliases, meanings, categories, and near-matches. Your query stays here.</p></div>
      <div class="category-strip" aria-label="Browse by category"><button type="button" data-category="All" aria-pressed="${state.category === "All"}">All <span>${TERMS.length}</span></button>${CATEGORIES.map((category) => `<button type="button" data-category="${category}" aria-pressed="${state.category === category}">${usEnglish(category)} <span>${TERMS.filter((term) => term.category === category).length}</span></button>`).join("")}</div>
      <div class="alphabet-strip" aria-label="Browse alphabetically"><button type="button" data-letter="" aria-pressed="${!state.letter}">Any</button>${"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letter) => `<button type="button" data-letter="${letter}" aria-pressed="${state.letter === letter}" ${TERMS.some((term) => term.label.toUpperCase().startsWith(letter)) ? "" : "disabled"}>${letter}</button>`).join("")}</div>
      <div id="results">${resultsMarkup()}</div>
    </section>
    <dialog class="term-dialog" id="term-dialog" aria-labelledby="term-dialog-title"><div id="term-detail"></div></dialog>
  </main>${footer("Pitch Dictionary")}`;
  bindTheme(META.storageKey); bindStaticEvents(); attachReveal(); landAtTop();
  const stage = document.querySelector<HTMLElement>("#physics-stage"); if (stage) initialiseWordDrop(stage, TERMS);
  const preview = document.querySelector<HTMLElement>("#constellation-preview");
  const pitch = TERMS.find((term) => term.id === "pitch");
  if (preview && pitch) mountConstellation(preview, pitch, TERMS, openTerm);
}

function resultsMarkup(): string {
  const all = filtered(); const shown = all.slice(0, state.visible);
  const description = state.query ? `${all.length} ${all.length === 1 ? "match" : "matches"} for “${escapeHTML(state.query)}”` : `${all.length} useful terms`;
  return `<div class="results-heading"><div><p class="kicker">${state.category === "All" ? "Across the work" : escapeHTML(usEnglish(state.category))}</p><h3>${description}</h3></div>${state.query || state.category !== "All" || state.letter ? '<button type="button" id="clear-filters">Clear filters</button>' : ""}</div>
  ${shown.length ? `<div class="term-grid">${shown.map(termCard).join("")}</div>${all.length > shown.length ? `<button class="load-more" id="load-more" type="button">Show ${Math.min(24, all.length - shown.length)} more <span>${shown.length} / ${all.length}</span></button>` : ""}` : `<div class="no-results"><strong>No confident match.</strong><p>Try fewer words or browse a category. The dictionary would rather admit it than serve random fog.</p></div>`}`;
}
function termCard(term: PitchTerm): string { return `<button class="term-card" type="button" data-open-term="${term.id}"><span>${escapeHTML(usEnglish(term.category))}</span><strong>${escapeHTML(term.label)}</strong><p>${escapeHTML(term.plain)}</p><i aria-hidden="true">↗</i></button>`; }

function updateResults(focus = false): void {
  const results = document.querySelector<HTMLElement>("#results"); if (!results) return; results.innerHTML = resultsMarkup(); bindResultEvents();
  const count = filtered().length; announce(`${count} ${count === 1 ? "term" : "terms"} found.`); if (focus) results.querySelector<HTMLElement>("button")?.focus();
}

function openTerm(id: string): void {
  const term = TERMS.find((item) => item.id === id); const dialog = document.querySelector<HTMLDialogElement>("#term-dialog"); const detail = document.querySelector<HTMLElement>("#term-detail"); if (!term || !dialog || !detail) return;
  const wasOpen = dialog.open;
  const confused = term.oftenConfusedWith.map((ref) => TERMS.find((item) => item.id === ref)).filter(Boolean) as PitchTerm[];
  const related = constellationFor(term, TERMS);
  detailConstellationCleanup?.();
  detail.innerHTML = `<div class="term-detail__top"><span>${escapeHTML(usEnglish(term.category))}</span><button type="button" id="close-term" aria-label="Close definition">×</button></div><h2 id="term-dialog-title" tabindex="-1">${escapeHTML(term.label)}</h2>${term.aliases.length ? `<p class="aliases">Also: ${term.aliases.map(escapeHTML).join(", ")}</p>` : ""}<p class="plain-definition">${escapeHTML(term.plain)}</p><div class="definition-pair"><section><p class="kicker">Why it matters</p><p>${escapeHTML(term.whyItMatters)}</p></section><section><p class="kicker">What it changes</p><p>${escapeHTML(term.changes)}</p></section></div>${confused.length ? `<section class="term-links"><p class="kicker">Often confused with</p>${confused.map((item) => `<button type="button" data-related="${item.id}">${escapeHTML(item.label)} ↗</button>`).join("")}</section>` : ""}<section class="term-constellation"><div><p class="kicker">The neighboring ideas</p><h3>Follow the thought.</h3><p>These are editorial relationships—not a universal taxonomy.</p></div><div class="constellation-stage constellation-stage--detail" id="detail-constellation"></div><div class="constellation-list" aria-label="Related terms">${related.map((item) => `<button type="button" data-related="${item.id}">${escapeHTML(item.label)} <span>↗</span></button>`).join("")}</div></section><p class="definition-boundary">A plain-language working definition—not legal, financial, medical, or universal industry advice.</p>`;
  state.active = id; if (!dialog.open) dialog.showModal(); document.body.classList.add("dialog-open");
  dialog.scrollTo({ top: 0, behavior: "auto" });
  if (wasOpen) requestAnimationFrame(() => detail.querySelector<HTMLElement>("#term-dialog-title")?.focus({ preventScroll: true }));
  const constellation = detail.querySelector<HTMLElement>("#detail-constellation");
  if (constellation) detailConstellationCleanup = mountConstellation(constellation, term, TERMS, openTerm);
  detail.querySelector("#close-term")?.addEventListener("click", () => dialog.close());
  detail.querySelectorAll<HTMLButtonElement>("[data-related]").forEach((button) => button.addEventListener("click", () => openTerm(button.dataset.related ?? "")));
}

function bindResultEvents(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-open-term]").forEach((button) => button.addEventListener("click", () => openTerm(button.dataset.openTerm ?? "")));
  document.querySelector("#load-more")?.addEventListener("click", () => { state.visible += 24; updateResults(); });
  document.querySelector("#clear-filters")?.addEventListener("click", () => { state.query = ""; state.category = "All"; state.letter = ""; state.visible = 24; const input = document.querySelector<HTMLInputElement>("#term-search"); if (input) input.value = ""; document.querySelectorAll("[aria-pressed]").forEach((node) => node.setAttribute("aria-pressed", "false")); document.querySelector('[data-category="All"]')?.setAttribute("aria-pressed", "true"); document.querySelector('[data-letter=""]')?.setAttribute("aria-pressed", "true"); updateResults(); });
}
function bindStaticEvents(): void {
  const input = document.querySelector<HTMLInputElement>("#term-search"); input?.addEventListener("input", () => { state.query = input.value; state.visible = 24; updateResults(); });
  document.querySelectorAll<HTMLButtonElement>("[data-suggest]").forEach((button) => button.addEventListener("click", () => { if (!input) return; input.value = button.dataset.suggest ?? ""; state.query = input.value; state.visible = 24; updateResults(); input.focus(); document.querySelector("#dictionary-search")?.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); }));
  document.querySelectorAll<HTMLButtonElement>("[data-category]").forEach((button) => button.addEventListener("click", () => { state.category = button.dataset.category as Category | "All"; state.visible = 24; document.querySelectorAll("[data-category]").forEach((node) => node.setAttribute("aria-pressed", String(node === button))); updateResults(); }));
  document.querySelectorAll<HTMLButtonElement>("[data-letter]").forEach((button) => button.addEventListener("click", () => { state.letter = button.dataset.letter ?? ""; state.visible = 24; document.querySelectorAll("[data-letter]").forEach((node) => node.setAttribute("aria-pressed", String(node === button))); updateResults(); }));
  bindResultEvents();
  const dialog = document.querySelector<HTMLDialogElement>("#term-dialog"); dialog?.addEventListener("close", () => { detailConstellationCleanup?.(); detailConstellationCleanup = undefined; document.body.classList.remove("dialog-open"); state.active = undefined; }); dialog?.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  document.querySelector("#physics-stage")?.addEventListener("dictionary:open", (event) => openTerm((event as CustomEvent<string>).detail));
  document.addEventListener("keydown", (event) => { if (event.key === "/" && document.activeElement?.tagName !== "INPUT") { event.preventDefault(); input?.focus(); } });
}
history.scrollRestoration = "manual"; initialiseThreadCursor(); render();
