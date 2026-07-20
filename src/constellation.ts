import type { PitchTerm } from "./terms.ts";

const ORBITS: readonly (readonly string[])[] = [
  ["pitch", "brief", "proposition", "ask", "decision-owner", "pitch-narrative", "proof-point"],
  ["brief", "creative-brief", "current-requirement", "requirement-state", "scope-creep", "approval", "stakeholder", "handover"],
  ["logline", "premise", "protagonist", "antagonistic-force", "stakes", "synopsis", "theme"],
  ["series-engine", "pilot", "season-arc", "episode-examples", "episode-list", "pitch-bible"],
  ["page-job", "information-hierarchy", "whitespace", "reading-order", "cognitive-load", "progressive-disclosure"],
  ["delivery-mode", "live-deck", "leave-behind", "dual-use", "speaker-notes", "channel-competition"],
  ["claim", "evidence", "proof-point", "primary-source", "citation", "assumption", "confidence"],
  ["correlation-causation", "sample-size", "cohort", "projection", "result-footing", "vanity-metric"],
  ["product-market-fit", "traction", "retention", "churn", "cohort", "ideal-customer-profile"],
  ["business-model", "unit-economics", "runway", "use-of-funds", "projection", "valuation"],
  ["go-to-market", "positioning", "ideal-customer-profile", "persona", "pipeline", "value-proposition"],
  ["creative-brief", "insight", "tension", "proposition", "single-minded-proposition", "reason-to-believe"],
  ["advertising-strategy", "creative-brief", "target-audience", "insight", "proposition", "reason-to-believe", "mandatories"],
  ["concept", "campaign-platform", "big-idea", "visual-metaphor", "tone", "storyboard", "animatic"],
  ["treatment", "directors-treatment", "lookbook", "visual-reference", "storyboard", "shot-list", "production-bible"],
  ["licence", "territory", "exclusivity", "buyout", "usage", "moral-rights", "credit"],
  ["speculative-work", "pitch-fee", "scope-creep", "revision-round", "kill-fee", "approval"],
  ["approval", "decision-owner", "decision-criteria", "stakeholder", "version-control", "revision-round", "sign-off"],
  ["nda", "confidentiality", "embargo", "data-room", "due-diligence", "version-control"],
  ["accessibility", "plain-language", "colour-contrast", "alt-text", "captions", "reading-order"],
  ["localisation", "translation", "plain-language", "copy-band", "type-pressure", "smallest-view"],
  ["audience", "target-audience", "end-user", "persona", "ideal-customer-profile", "stakeholder", "recipient"],
  ["appendix", "data-room", "citation", "primary-source", "due-diligence", "leave-behind", "reference-slide"],
  ["sequence", "transition", "pitch-narrative", "page-job", "section-job", "progressive-disclosure", "reading-order"],
  ["comps", "positioning", "differentiator", "visual-reference", "market-proof", "genre", "tone"],
  ["unpaid-pitch", "speculative-work", "pitch-fee", "portfolio-work", "usage", "licence", "consent"],
] as const;

const STOP = new Set(["a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "how", "in", "is", "it", "of", "on", "or", "that", "the", "this", "to", "what", "when", "which", "who", "with"]);
const POSITIONS = [[18, 20], [49, 12], [82, 23], [90, 52], [76, 82], [46, 88], [15, 76], [9, 46]] as const;

function tokens(term: PitchTerm): Set<string> {
  return new Set(`${term.label} ${term.aliases.join(" ")} ${term.changes}`.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ").filter((token) => token.length > 3 && !STOP.has(token)));
}

export function constellationFor(term: PitchTerm, terms: readonly PitchTerm[], limit = 8): PitchTerm[] {
  const byId = new Map(terms.map((item) => [item.id, item]));
  const scores = new Map<string, number>();
  const add = (id: string, score: number) => {
    if (id === term.id || !byId.has(id)) return;
    scores.set(id, Math.max(score, scores.get(id) ?? 0));
  };

  term.related.forEach((id, index) => add(id, 130 - index));
  term.oftenConfusedWith.forEach((id, index) => add(id, 122 - index));
  for (const orbit of ORBITS) {
    if (!orbit.includes(term.id)) continue;
    orbit.forEach((id, index) => add(id, 110 - index * 0.1));
  }

  const sourceTokens = tokens(term);
  for (const candidate of terms) {
    if (candidate.id === term.id) continue;
    const shared = [...tokens(candidate)].filter((token) => sourceTokens.has(token)).length;
    const sameCategory = candidate.category === term.category ? 7 : 0;
    const reciprocal = candidate.related.includes(term.id) || candidate.oftenConfusedWith.includes(term.id) ? 24 : 0;
    if (shared || sameCategory || reciprocal) add(candidate.id, 20 + shared * 9 + sameCategory + reciprocal);
  }

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1] || byId.get(a[0])!.label.localeCompare(byId.get(b[0])!.label))
    .slice(0, limit)
    .map(([id]) => byId.get(id)!);
}

function hash(value: string): number {
  let result = 2166136261;
  for (const character of value) result = Math.imul(result ^ character.charCodeAt(0), 16777619);
  return result >>> 0;
}

function seeded(seed: number): () => number {
  let value = seed || 1;
  return () => {
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function mountConstellation(
  stage: HTMLElement,
  term: PitchTerm,
  terms: readonly PitchTerm[],
  onSelect: (id: string) => void,
): () => void {
  const neighbours = constellationFor(term, terms);
  stage.replaceChildren();
  stage.setAttribute("aria-label", `${term.label}: related pitch terms`);

  const canvas = document.createElement("canvas");
  canvas.className = "constellation-canvas";
  canvas.setAttribute("aria-hidden", "true");
  const centre = document.createElement("div");
  centre.className = "constellation-centre";
  centre.textContent = term.label;
  stage.append(canvas, centre);

  const nodes = neighbours.map((neighbour, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "constellation-node";
    button.dataset.termId = neighbour.id;
    button.style.setProperty("--node-x", `${POSITIONS[index]?.[0] ?? 50}%`);
    button.style.setProperty("--node-y", `${POSITIONS[index]?.[1] ?? 50}%`);
    button.style.setProperty("--node-delay", `${index * -0.37}s`);
    button.innerHTML = `<i aria-hidden="true"></i><span>${neighbour.label}</span>`;
    button.addEventListener("click", () => onSelect(neighbour.id));
    stage.append(button);
    return button;
  });

  const context = canvas.getContext("2d");
  const random = seeded(hash(term.id));
  const stars = Array.from({ length: 74 }, () => ({ x: random(), y: random(), r: 0.25 + random() * 1.25, a: 0.2 + random() * 0.65 }));
  let frame = 0;

  const draw = () => {
    frame = 0;
    if (!context) return;
    const bounds = stage.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(bounds.width * ratio));
    canvas.height = Math.max(1, Math.round(bounds.height * ratio));
    canvas.style.width = `${bounds.width}px`;
    canvas.style.height = `${bounds.height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, bounds.width, bounds.height);

    for (const star of stars) {
      context.beginPath();
      context.arc(star.x * bounds.width, star.y * bounds.height, star.r, 0, Math.PI * 2);
      context.fillStyle = `rgba(245,244,236,${star.a})`;
      context.fill();
    }

    const centreBounds = centre.getBoundingClientRect();
    const origin = { x: centreBounds.left - bounds.left + centreBounds.width / 2, y: centreBounds.top - bounds.top + centreBounds.height / 2 };
    for (const [index, node] of nodes.entries()) {
      const nodeBounds = node.getBoundingClientRect();
      const target = { x: nodeBounds.left - bounds.left + nodeBounds.width / 2, y: nodeBounds.top - bounds.top + nodeBounds.height / 2 };
      const gradient = context.createLinearGradient(origin.x, origin.y, target.x, target.y);
      gradient.addColorStop(0, "rgba(255,79,135,.76)");
      gradient.addColorStop(1, "rgba(245,244,236,.16)");
      context.beginPath();
      context.moveTo(origin.x, origin.y);
      context.quadraticCurveTo((origin.x + target.x) / 2 + (index % 2 ? 18 : -18), (origin.y + target.y) / 2, target.x, target.y);
      context.strokeStyle = gradient;
      context.lineWidth = index < 3 ? 1.15 : 0.7;
      context.stroke();
    }
  };
  const queueDraw = () => { if (!frame) frame = requestAnimationFrame(draw); };
  const resize = new ResizeObserver(queueDraw);
  resize.observe(stage);
  window.addEventListener("resize", queueDraw, { passive: true });
  stage.addEventListener("pointermove", (event) => {
    const bounds = stage.getBoundingClientRect();
    stage.style.setProperty("--sky-x", `${((event.clientX - bounds.left) / bounds.width - 0.5) * 10}px`);
    stage.style.setProperty("--sky-y", `${((event.clientY - bounds.top) / bounds.height - 0.5) * 10}px`);
  }, { passive: true });
  queueDraw();

  return () => {
    if (frame) cancelAnimationFrame(frame);
    resize.disconnect();
    window.removeEventListener("resize", queueDraw);
  };
}
