import type { PitchTerm } from "./terms.ts";
import {
  applyPairRepulsion,
  clamp,
  hashString,
  limitVelocity,
  projectMomentum,
  rubberband,
  seededRandom,
  stepSpring,
  type Vector2,
} from "./physics.ts";

export const CURATED_ORBITS: readonly (readonly string[])[] = [
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
  ["proof-of-concept", "sizzle-reel", "key-art", "treatment", "lookbook", "visual-reference", "pilot"],
  ["cold-open", "hook", "pilot", "inciting-incident", "beat"],
  ["arr", "mrr", "gross-margin", "burn-rate", "runway", "unit-economics", "projection"],
  ["customer-acquisition-cost", "customer-lifetime-value", "conversion-rate", "retention", "churn", "cohort"],
  ["safe", "term-sheet", "valuation", "cap-table", "due-diligence"],
  ["residuals", "usage", "licence", "buyout", "credit"],
] as const;

const STOP = new Set(["a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "how", "in", "is", "it", "of", "on", "or", "that", "the", "this", "to", "what", "when", "which", "who", "with"]);

export type RelationshipKind = "related" | "confused" | "reciprocal" | "curated" | "category" | "language";

export interface GalaxyNeighbour {
  term: PitchTerm;
  score: number;
  degree: number;
  relation: RelationshipKind;
  reason: string;
  luminosity: number;
  starSize: number;
}

function tokens(term: PitchTerm): Set<string> {
  return new Set(`${term.label} ${term.aliases.join(" ")} ${term.changes}`.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ").filter((token) => token.length > 3 && !STOP.has(token)));
}

function sharedOrbit(firstId: string, secondId: string): boolean {
  return CURATED_ORBITS.some((orbit) => orbit.includes(firstId) && orbit.includes(secondId));
}

function buildDegreeMap(terms: readonly PitchTerm[]): Map<string, number> {
  const links = new Map(terms.map((term) => [term.id, new Set<string>()]));
  const connect = (first: string, second: string) => {
    if (first === second || !links.has(first) || !links.has(second)) return;
    links.get(first)!.add(second);
    links.get(second)!.add(first);
  };
  for (const term of terms) {
    term.related.forEach((id) => connect(term.id, id));
    term.oftenConfusedWith.forEach((id) => connect(term.id, id));
  }
  for (const orbit of CURATED_ORBITS) {
    for (let first = 0; first < orbit.length; first += 1) {
      for (let second = first + 1; second < orbit.length; second += 1) connect(orbit[first]!, orbit[second]!);
    }
  }
  return new Map([...links].map(([id, connected]) => [id, Math.max(1, connected.size)]));
}

function relationship(source: PitchTerm, candidate: PitchTerm): { score: number; relation: RelationshipKind; reason: string } {
  const relatedIndex = source.related.indexOf(candidate.id);
  if (relatedIndex >= 0) return { score: 160 - relatedIndex, relation: "related", reason: "Closely related" };
  const confusedIndex = source.oftenConfusedWith.indexOf(candidate.id);
  if (confusedIndex >= 0) return { score: 150 - confusedIndex, relation: "confused", reason: "Often confused with this" };
  if (candidate.related.includes(source.id) || candidate.oftenConfusedWith.includes(source.id)) return { score: 138, relation: "reciprocal", reason: "Points back here" };
  if (sharedOrbit(source.id, candidate.id)) return { score: 124, relation: "curated", reason: "Shares this part of the work" };

  const sourceTokens = tokens(source);
  const shared = [...tokens(candidate)].filter((token) => sourceTokens.has(token)).length;
  if (shared) return { score: 44 + shared * 11, relation: "language", reason: "Meaning overlaps" };
  if (source.category === candidate.category) return { score: 28, relation: "category", reason: `Nearby in ${source.category.toLowerCase()}` };
  return { score: 0, relation: "language", reason: "A more distant idea" };
}

export function galaxyFor(term: PitchTerm, terms: readonly PitchTerm[], limit = 11): GalaxyNeighbour[] {
  const degrees = buildDegreeMap(terms);
  return terms
    .filter((candidate) => candidate.id !== term.id)
    .map((candidate) => ({ candidate, ...relationship(term, candidate) }))
    .filter((entry) => entry.score > 0)
    .sort((first, second) => second.score - first.score || (degrees.get(second.candidate.id) ?? 1) - (degrees.get(first.candidate.id) ?? 1) || first.candidate.label.localeCompare(second.candidate.label))
    .slice(0, limit)
    .map(({ candidate, score, relation, reason }) => {
      const degree = degrees.get(candidate.id) ?? 1;
      const connectedness = clamp(Math.log2(degree + 1) / 5, 0, 1);
      const closeness = clamp((score - 24) / 136, 0, 1);
      return {
        term: candidate,
        score,
        degree,
        relation,
        reason,
        luminosity: 0.55 + closeness * 0.28 + connectedness * 0.17,
        starSize: 8 + connectedness * 13 + closeness * 6,
      };
    });
}

export function constellationFor(term: PitchTerm, terms: readonly PitchTerm[], limit = 8): PitchTerm[] {
  return galaxyFor(term, terms, limit).map(({ term: neighbour }) => neighbour);
}

export function connectionDegree(term: PitchTerm, terms: readonly PitchTerm[]): number {
  return buildDegreeMap(terms).get(term.id) ?? 1;
}

export type TravelCause = "initial" | "pointer" | "keyboard" | "programmatic";

export interface GalaxyOptions {
  variant?: "hero" | "detail";
  limit?: number;
  onCenterChange?: (term: PitchTerm, previous: PitchTerm | undefined, cause: TravelCause) => void;
  onOpenDefinition?: (term: PitchTerm) => void;
}

export interface GalaxyController {
  travelTo: (id: string, cause?: TravelCause) => void;
  focusCenter: () => void;
  currentId: () => string;
  destroy: () => void;
}

interface BackgroundStar {
  x: number;
  y: number;
  depth: number;
  radius: number;
  alpha: number;
  phase: number;
  speed: number;
  tint: number;
}

interface ShootingStar {
  x: number;
  y: number;
  angle: number;
  cycle: number;
  offset: number;
  length: number;
}

interface GalaxyPoint {
  descriptor: GalaxyNeighbour;
  button: HTMLButtonElement;
  position: Vector2;
  velocity: Vector2;
  anchor: Vector2;
  throwOffset: Vector2;
  opacity: number;
  targetOpacity: number;
  scale: number;
  targetScale: number;
  dragging: boolean;
  dying: boolean;
  removeAfter: number;
  suppressClick: boolean;
}

interface DragState {
  pointerId: number;
  start: Vector2;
  offset: Vector2;
  last: Vector2;
  lastTime: number;
  moved: boolean;
}

interface Palette {
  star: string;
  link: string;
  pink: string;
  acid: string;
  cobalt: string;
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

function readPalette(stage: HTMLElement): Palette {
  const style = getComputedStyle(stage);
  const value = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return {
    star: value("--galaxy-star-rgb", "245,244,236"),
    link: value("--galaxy-link-rgb", "123,148,255"),
    pink: value("--galaxy-pink-rgb", "255,79,135"),
    acid: value("--galaxy-acid-rgb", "217,255,86"),
    cobalt: value("--galaxy-cobalt-rgb", "41,79,255"),
  };
}

function rgba(rgb: string, alpha: number): string {
  return `rgba(${rgb},${clamp(alpha, 0, 1)})`;
}

export function mountConstellation(
  stage: HTMLElement,
  initialTerm: PitchTerm,
  terms: readonly PitchTerm[],
  options: GalaxyOptions = {},
): GalaxyController {
  const variant = options.variant ?? "detail";
  const termById = new Map(terms.map((term) => [term.id, term]));
  const reducedQuery = matchMedia("(prefers-reduced-motion: reduce)");
  const finePointerQuery = matchMedia("(hover: hover) and (pointer: fine)");
  let reduced = reducedQuery.matches;
  let finePointer = finePointerQuery.matches;
  let centreTerm = initialTerm;
  let previousTerm: PitchTerm | undefined;
  let destroyed = false;
  let visible = true;
  let frame = 0;
  let resizeFrame = 0;
  let lastTime = performance.now();
  let width = 1;
  let height = 1;
  let focusPoint: Vector2 = { x: 0, y: 0 };
  let palette = readPalette(stage);
  let travelEnergy = 0;
  let travelUntil = 0;
  let travelEpoch = 0;
  let travelTrail: { from: Vector2; to: Vector2; started: number; duration: number } | undefined;
  let activeDrag: { point: GalaxyPoint; state: DragState } | undefined;
  const points = new Map<string, GalaxyPoint>();
  const pointer = { active: false, pressed: false, x: 0, y: 0 };

  stage.replaceChildren();
  stage.classList.add("galaxy-stage", `galaxy-stage--${variant}`);
  stage.setAttribute("role", "group");
  stage.setAttribute("aria-roledescription", "word galaxy");

  const canvas = element("canvas", "galaxy-canvas constellation-canvas");
  canvas.setAttribute("aria-hidden", "true");
  const core = element("button", "galaxy-core constellation-centre") as HTMLButtonElement;
  core.type = "button";
  core.setAttribute("aria-current", "true");
  const coreGlow = element("span", "galaxy-core__glow");
  coreGlow.setAttribute("aria-hidden", "true");
  const coreLabel = element("strong", "galaxy-core__label");
  const coreDegree = element("span", "galaxy-core__degree");
  core.append(coreGlow, coreLabel, coreDegree);

  const readout = element("aside", "galaxy-readout");
  const readoutEyebrow = element("p", "galaxy-readout__eyebrow");
  const readoutTitle = element("strong", "galaxy-readout__title");
  const readoutDefinition = element("p", "galaxy-readout__definition");
  const readoutHint = element("p", "galaxy-readout__hint");
  readout.append(readoutEyebrow, readoutTitle, readoutDefinition, readoutHint);
  let definitionAction: HTMLButtonElement | undefined;
  if (options.onOpenDefinition) {
    definitionAction = element("button", "galaxy-readout__action") as HTMLButtonElement;
    definitionAction.type = "button";
    definitionAction.textContent = "Read full definition ↗";
    definitionAction.addEventListener("click", () => options.onOpenDefinition?.(centreTerm));
    readout.append(definitionAction);
  }
  readout.setAttribute("aria-live", "polite");
  readout.setAttribute("aria-atomic", "true");

  const guidance = element("p", "galaxy-guidance");
  guidance.textContent = finePointer
    ? "Hover for meaning · choose to travel · drag a word · hold empty sky for gravity · arrows navigate"
    : "Tap a word to travel · swipe the page normally · arrow keys move between stars";
  stage.append(canvas, core, readout, guidance);

  const random = seededRandom(hashString(`pitch-dictionary:${variant}`));
  let backgroundStars: BackgroundStar[] = [];
  let shootingStars: ShootingStar[] = [];

  const makeSky = () => {
    const lowPower = (navigator.hardwareConcurrency || 8) <= 4;
    const density = variant === "hero" ? (lowPower ? 105 : 180) : (lowPower ? 70 : 118);
    backgroundStars = Array.from({ length: density }, () => ({
      x: random(),
      y: random(),
      depth: 0.25 + random() * 0.75,
      radius: 0.35 + random() * 1.55,
      alpha: 0.16 + random() * 0.72,
      phase: random() * Math.PI * 2,
      speed: 0.55 + random() * 1.4,
      tint: random(),
    }));
    shootingStars = Array.from({ length: variant === "hero" ? 3 : 2 }, (_, index) => ({
      x: 0.08 + random() * 0.72,
      y: 0.04 + random() * 0.52,
      angle: 0.38 + random() * 0.34,
      cycle: 7.5 + random() * 6 + index,
      offset: random() * 7,
      length: 72 + random() * 110,
    }));
  };
  makeSky();

  const currentLimit = () => options.limit ?? (width < 620 ? 7 : width < 980 ? 9 : variant === "hero" ? 12 : 10);

  const updateCore = () => {
    const degree = connectionDegree(centreTerm, terms);
    const mass = clamp(Math.log2(degree + 1) / 5, 0.24, 1);
    coreLabel.textContent = centreTerm.label;
    coreDegree.textContent = `${degree} ${degree === 1 ? "route" : "routes"}`;
    core.setAttribute("aria-label", `${centreTerm.label}. ${centreTerm.plain}${options.onOpenDefinition ? " Open full definition." : " Current centre."}`);
    core.style.setProperty("--core-size", `${Math.round(94 + mass * 54)}px`);
    stage.setAttribute("aria-label", `Word galaxy centred on ${centreTerm.label}. Arrow between neighboring terms; activate one to travel.`);
  };

  const updateReadout = (term: PitchTerm) => {
    readoutEyebrow.textContent = `Now orbiting · ${term.category}`;
    readoutTitle.textContent = term.label;
    readoutDefinition.textContent = term.plain;
    readoutHint.textContent = "Every route is editorial, visible, and reversible.";
  };

  const restoreReadout = () => updateReadout(centreTerm);

  const setRovingFocus = (button: HTMLButtonElement) => {
    core.tabIndex = button === core ? 0 : -1;
    points.forEach((point) => { point.button.tabIndex = point.button === button ? 0 : -1; });
  };

  const nodeForButton = (button: HTMLButtonElement): GalaxyPoint | undefined => [...points.values()].find((point) => point.button === button);

  const nearestDirectionalButton = (originButton: HTMLButtonElement, key: string): HTMLButtonElement | undefined => {
    const originPoint = originButton === core ? focusPoint : nodeForButton(originButton)?.position;
    if (!originPoint) return undefined;
    const direction = key === "ArrowLeft" ? { x: -1, y: 0 } : key === "ArrowRight" ? { x: 1, y: 0 } : key === "ArrowUp" ? { x: 0, y: -1 } : { x: 0, y: 1 };
    const candidates = [{ button: core, position: focusPoint }, ...[...points.values()].filter((point) => !point.dying && point.opacity > 0.2).map((point) => ({ button: point.button, position: point.position }))]
      .filter(({ button }) => button !== originButton)
      .map((candidate) => {
        const dx = candidate.position.x - originPoint.x;
        const dy = candidate.position.y - originPoint.y;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const alignment = (dx / distance) * direction.x + (dy / distance) * direction.y;
        return { ...candidate, alignment, score: distance * (1 + (1 - alignment) * 3.5) };
      })
      .filter((candidate) => candidate.alignment > 0.18)
      .sort((first, second) => first.score - second.score);
    return candidates[0]?.button;
  };

  const onStageKeydown = (event: KeyboardEvent) => {
    const active = document.activeElement;
    if (!(active instanceof HTMLButtonElement) || !stage.contains(active)) return;
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
      event.preventDefault();
      const next = nearestDirectionalButton(active, event.key);
      if (next) { setRovingFocus(next); next.focus(); }
    }
    if (event.key === "Home") { event.preventDefault(); setRovingFocus(core); core.focus(); }
  };
  stage.addEventListener("keydown", onStageKeydown);

  const applyDescriptor = (button: HTMLButtonElement, descriptor: GalaxyNeighbour) => {
    const size = descriptor.starSize;
    button.dataset.relation = descriptor.relation;
    button.style.setProperty("--star-size", `${size.toFixed(1)}px`);
    button.style.setProperty("--star-field-size", `${(size + 20).toFixed(1)}px`);
    button.style.setProperty("--star-ray-size", `${(size * 2.7).toFixed(1)}px`);
    button.style.setProperty("--star-ray-hover", `${(size * 4.3).toFixed(1)}px`);
    button.style.setProperty("--star-ring-size", `${(size * 0.36).toFixed(1)}px`);
    button.style.setProperty("--star-glow-size", `${(size * 2.4).toFixed(1)}px`);
    button.style.setProperty("--twinkle-delay", `${-((hashString(descriptor.term.id) % 3800) / 1000).toFixed(2)}s`);
    button.style.setProperty("--twinkle-duration", `${(3.1 + (hashString(`${descriptor.term.id}:twinkle`) % 2400) / 1000).toFixed(2)}s`);
    const label = button.querySelector<HTMLElement>(".galaxy-node__label");
    const relation = button.querySelector<HTMLElement>(".galaxy-node__relation");
    const meaning = button.querySelector<HTMLElement>(".galaxy-node__meaning");
    if (label) label.textContent = descriptor.term.label;
    if (relation) relation.textContent = descriptor.reason;
    if (meaning) meaning.textContent = descriptor.term.plain;
    button.setAttribute("aria-label", `${descriptor.term.label}. ${descriptor.term.plain} ${descriptor.reason}. Travel here.`);
  };

  const createNode = (descriptor: GalaxyNeighbour, origin: Vector2): GalaxyPoint => {
    const button = element("button", "galaxy-node constellation-node") as HTMLButtonElement;
    button.type = "button";
    button.tabIndex = -1;
    button.dataset.termId = descriptor.term.id;
    const star = element("span", "galaxy-node__star");
    star.setAttribute("aria-hidden", "true");
    const starCore = element("i", "galaxy-node__star-core");
    star.append(starCore);
    const label = element("span", "galaxy-node__label");
    label.textContent = descriptor.term.label;
    const tooltip = element("span", "galaxy-node__tooltip");
    const tooltipRelation = element("small", "galaxy-node__relation");
    tooltipRelation.textContent = descriptor.reason;
    const tooltipDefinition = element("span", "galaxy-node__meaning");
    tooltipDefinition.textContent = descriptor.term.plain;
    const tooltipAction = element("em", "galaxy-node__travel");
    tooltipAction.textContent = "Travel here ↗";
    tooltip.append(tooltipRelation, tooltipDefinition, tooltipAction);
    button.append(star, label, tooltip);
    stage.append(button);
    applyDescriptor(button, descriptor);

    const point: GalaxyPoint = {
      descriptor,
      button,
      position: { ...origin },
      velocity: { x: 0, y: 0 },
      anchor: { ...origin },
      throwOffset: { x: 0, y: 0 },
      opacity: 0,
      targetOpacity: descriptor.luminosity,
      scale: 0.35,
      targetScale: 1,
      dragging: false,
      dying: false,
      removeAfter: 0,
      suppressClick: false,
    };

    let drag: DragState | undefined;
    button.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || reduced) return;
      const rect = stage.getBoundingClientRect();
      drag = {
        pointerId: event.pointerId,
        start: { x: event.clientX, y: event.clientY },
        offset: { x: event.clientX - rect.left - point.position.x, y: event.clientY - rect.top - point.position.y },
        last: { x: event.clientX, y: event.clientY },
        lastTime: event.timeStamp,
        moved: false,
      };
      activeDrag = { point, state: drag };
      button.setPointerCapture(event.pointerId);
      button.classList.add("is-pressed");
    });
    button.addEventListener("pointermove", (event) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      const distance = Math.hypot(event.clientX - drag.start.x, event.clientY - drag.start.y);
      if (!drag.moved && distance > 7) {
        drag.moved = true;
        point.dragging = true;
        button.classList.add("is-dragging");
      }
      if (!drag.moved) return;
      event.preventDefault();
      const rect = stage.getBoundingClientRect();
      const next = { x: event.clientX - rect.left - drag.offset.x, y: event.clientY - rect.top - drag.offset.y };
      const elapsed = Math.max(8, event.timeStamp - drag.lastTime) / 1000;
      point.velocity.x = (event.clientX - drag.last.x) / elapsed;
      point.velocity.y = (event.clientY - drag.last.y) / elapsed;
      point.position = next;
      // A held star follows the hand immediately, even if the canvas frame is
      // busy painting the rest of the sky. Physics resumes on release.
      button.style.transform = `translate3d(${point.position.x}px,${point.position.y}px,0) translate(-50%,-50%) scale(${point.scale.toFixed(3)})`;
      drag.last = { x: event.clientX, y: event.clientY };
      drag.lastTime = event.timeStamp;
    });
    const release = (event: PointerEvent) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      button.classList.remove("is-pressed", "is-dragging");
      if (drag.moved) {
        point.throwOffset.x = clamp(projectMomentum(point.velocity.x), -130, 130);
        point.throwOffset.y = clamp(projectMomentum(point.velocity.y), -130, 130);
        limitVelocity(point.velocity);
        point.suppressClick = true;
        window.setTimeout(() => { point.suppressClick = false; }, 0);
      }
      point.dragging = false;
      activeDrag = undefined;
      drag = undefined;
    };
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("click", (event) => {
      if (point.suppressClick) { event.preventDefault(); return; }
      travelTo(point.descriptor.term.id, event.detail === 0 ? "keyboard" : "pointer");
    });
    return point;
  };

  const layout = () => {
    const rect = stage.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    const heroWide = variant === "hero" && width > 900;
    focusPoint = { x: width * (heroWide ? 0.69 : 0.5), y: height * (width < 620 ? 0.43 : 0.48) };
    core.style.left = `${focusPoint.x}px`;
    core.style.top = `${focusPoint.y}px`;
    const living = [...points.values()]
      .filter((point) => !point.dying)
      .sort((first, second) => second.descriptor.score - first.descriptor.score || second.descriptor.degree - first.descriptor.degree);
    const inner = living.slice(0, Math.min(5, living.length));
    const outer = living.slice(inner.length);
    const seed = seededRandom(hashString(`${centreTerm.id}:${Math.round(width)}:${variant}`));
    const offset = seed() * Math.PI * 2;
    const marginX = width < 620 ? 64 : 96;
    const marginY = width < 620 ? 78 : 88;
    const assignRing = (ring: GalaxyPoint[], radius: number, ringOffset: number) => ring.forEach((point, index) => {
      const angle = offset + ringOffset + (Math.PI * 2 * index) / Math.max(1, ring.length) + (seed() - 0.5) * 0.16;
      const ellipticalX = radius * (heroWide ? 1.18 : 1);
      const ellipticalY = radius * (height > width ? 1.08 : 0.84);
      const minimumX = heroWide ? Math.max(width * 0.39, marginX) : marginX;
      point.anchor.x = clamp(focusPoint.x + Math.cos(angle) * ellipticalX, minimumX, width - marginX);
      point.anchor.y = clamp(focusPoint.y + Math.sin(angle) * ellipticalY, marginY, height - marginY);
    });
    const base = Math.min(width, height);
    assignRing(inner, clamp(base * 0.25, 128, variant === "hero" ? 260 : 205), 0);
    assignRing(outer, clamp(base * 0.4, 205, variant === "hero" ? 410 : 315), 0.32);
    if (reduced) {
      points.forEach((point) => {
        if (!point.dying) {
          point.position = { ...point.anchor };
          point.opacity = point.targetOpacity;
          point.scale = 1;
        }
      });
    }
  };

  const reconcile = (origin = focusPoint) => {
    const descriptors = galaxyFor(centreTerm, terms, currentLimit());
    const nextIds = new Set(descriptors.map(({ term }) => term.id));
    const now = performance.now();
    points.forEach((point, id) => {
      if (nextIds.has(id)) return;
      point.dying = true;
      point.targetOpacity = 0;
      point.targetScale = 0.18;
      point.removeAfter = now + (reduced ? 0 : 760);
      point.anchor = {
        x: point.position.x + (point.position.x - focusPoint.x) * 0.48,
        y: point.position.y + (point.position.y - focusPoint.y) * 0.48,
      };
      point.button.tabIndex = -1;
    });
    for (const descriptor of descriptors) {
      const current = points.get(descriptor.term.id);
      if (current) {
        current.descriptor = descriptor;
        current.dying = false;
        current.targetOpacity = descriptor.luminosity;
        current.targetScale = 1;
        applyDescriptor(current.button, descriptor);
      } else {
        const jitter = seededRandom(hashString(`${centreTerm.id}:${descriptor.term.id}`));
        const point = createNode(descriptor, { x: origin.x + (jitter() - 0.5) * 22, y: origin.y + (jitter() - 0.5) * 22 });
        point.velocity = { x: (jitter() - 0.5) * 90, y: (jitter() - 0.5) * 90 };
        points.set(descriptor.term.id, point);
      }
    }
    layout();
  };

  function travelTo(id: string, cause: TravelCause = "programmatic"): void {
    const next = termById.get(id);
    if (!next || next.id === centreTerm.id) {
      if (next && options.onOpenDefinition && cause !== "initial") options.onOpenDefinition(next);
      return;
    }
    const epoch = ++travelEpoch;
    const sourcePoint = points.get(id)?.position ?? focusPoint;
    travelTrail = { from: { ...sourcePoint }, to: { ...focusPoint }, started: performance.now(), duration: reduced ? 1 : 680 };
    previousTerm = centreTerm;
    centreTerm = next;
    travelEnergy = reduced ? 0 : Math.min(1.3, travelEnergy + 1);
    travelUntil = performance.now() + (reduced ? 0 : 920);
    stage.dataset.travelling = String(!reduced);
    updateCore();
    restoreReadout();
    reconcile(sourcePoint);
    options.onCenterChange?.(centreTerm, previousTerm, cause);
    if (cause !== "initial") requestAnimationFrame(() => {
      setRovingFocus(core);
      core.focus({ preventScroll: true });
    });
    if (!reduced) window.setTimeout(() => { if (epoch === travelEpoch) stage.dataset.travelling = "false"; }, 920);
    requestFrame();
  }

  const draw = (now: number) => {
    const context = canvas.getContext("2d");
    if (!context) return;
    const ratio = Math.min(devicePixelRatio || 1, 1.75);
    const targetWidth = Math.max(1, Math.round(width * ratio));
    const targetHeight = Math.max(1, Math.round(height * ratio));
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    const seconds = now / 1000;
    const pointerShiftX = finePointer && pointer.active && !reduced ? (pointer.x - width / 2) * 0.012 : 0;
    const pointerShiftY = finePointer && pointer.active && !reduced ? (pointer.y - height / 2) * 0.012 : 0;

    for (const star of backgroundStars) {
      const x = star.x * width + pointerShiftX * star.depth;
      const y = star.y * height + pointerShiftY * star.depth;
      const twinkle = reduced ? 1 : 0.72 + Math.sin(seconds * star.speed + star.phase) * 0.28;
      const alpha = star.alpha * twinkle;
      const tint = star.tint > 0.94 ? palette.pink : star.tint > 0.87 ? palette.acid : palette.star;
      const dx = x - focusPoint.x;
      const dy = y - focusPoint.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const stretch = travelEnergy * (5 + star.depth * 33);
      if (stretch > 0.7) {
        context.beginPath();
        context.moveTo(x - (dx / distance) * stretch, y - (dy / distance) * stretch);
        context.lineTo(x, y);
        context.strokeStyle = rgba(tint, alpha * 0.72);
        context.lineWidth = Math.max(0.45, star.radius * star.depth);
        context.stroke();
      } else {
        context.beginPath();
        context.arc(x, y, star.radius * (0.65 + star.depth * 0.6), 0, Math.PI * 2);
        context.fillStyle = rgba(tint, alpha);
        context.fill();
      }
    }

    if (!reduced) {
      for (const shooting of shootingStars) {
        const phase = (seconds + shooting.offset) % shooting.cycle;
        if (phase > 0.82) continue;
        const progress = phase / 0.82;
        const x = (shooting.x + progress * 0.24) * width;
        const y = (shooting.y + progress * 0.18) * height;
        const fade = Math.sin(progress * Math.PI);
        const dx = Math.cos(shooting.angle) * shooting.length;
        const dy = Math.sin(shooting.angle) * shooting.length;
        const gradient = context.createLinearGradient(x - dx, y - dy, x, y);
        gradient.addColorStop(0, rgba(palette.star, 0));
        gradient.addColorStop(1, rgba(palette.star, fade * 0.72));
        context.beginPath();
        context.moveTo(x - dx, y - dy);
        context.lineTo(x, y);
        context.strokeStyle = gradient;
        context.lineWidth = 1.15;
        context.stroke();
      }
    }

    const living = [...points.values()].filter((point) => point.opacity > 0.02);
    for (const point of living) {
      const closeness = clamp((point.descriptor.score - 24) / 136, 0, 1);
      const gradient = context.createLinearGradient(focusPoint.x, focusPoint.y, point.position.x, point.position.y);
      gradient.addColorStop(0, rgba(palette.pink, 0.52 * point.opacity));
      gradient.addColorStop(1, rgba(palette.link, (0.1 + closeness * 0.25) * point.opacity));
      const bend = ((hashString(`${centreTerm.id}:${point.descriptor.term.id}`) % 29) - 14) * 0.9;
      context.beginPath();
      context.moveTo(focusPoint.x, focusPoint.y);
      context.quadraticCurveTo((focusPoint.x + point.position.x) / 2 + bend, (focusPoint.y + point.position.y) / 2 - bend, point.position.x, point.position.y);
      context.strokeStyle = gradient;
      context.lineWidth = 0.55 + closeness * 0.85;
      context.stroke();
    }

    for (let first = 0; first < living.length; first += 1) {
      for (let second = first + 1; second < living.length; second += 1) {
        const a = living[first]!;
        const b = living[second]!;
        if (relationship(a.descriptor.term, b.descriptor.term).score < 110) continue;
        context.beginPath();
        context.moveTo(a.position.x, a.position.y);
        context.lineTo(b.position.x, b.position.y);
        context.strokeStyle = rgba(palette.link, 0.055 * Math.min(a.opacity, b.opacity));
        context.lineWidth = 0.55;
        context.stroke();
      }
    }

    if (travelTrail) {
      const progress = clamp((now - travelTrail.started) / travelTrail.duration, 0, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const x = travelTrail.from.x + (travelTrail.to.x - travelTrail.from.x) * eased;
      const y = travelTrail.from.y + (travelTrail.to.y - travelTrail.from.y) * eased;
      const tailX = travelTrail.from.x + (travelTrail.to.x - travelTrail.from.x) * clamp(eased - 0.18, 0, 1);
      const tailY = travelTrail.from.y + (travelTrail.to.y - travelTrail.from.y) * clamp(eased - 0.18, 0, 1);
      const gradient = context.createLinearGradient(tailX, tailY, x, y);
      gradient.addColorStop(0, rgba(palette.pink, 0));
      gradient.addColorStop(1, rgba(palette.acid, 0.9 * (1 - progress)));
      context.beginPath();
      context.moveTo(tailX, tailY);
      context.lineTo(x, y);
      context.strokeStyle = gradient;
      context.lineWidth = 2.2;
      context.stroke();
      context.beginPath();
      context.arc(x, y, 2.5 + (1 - progress) * 4, 0, Math.PI * 2);
      context.fillStyle = rgba(palette.star, 1 - progress);
      context.fill();
      if (progress >= 1) travelTrail = undefined;
    }
  };

  const syncPoints = (now: number, delta: number) => {
    const living = [...points.values()];
    for (let first = 0; first < living.length; first += 1) {
      for (let second = first + 1; second < living.length; second += 1) {
        const a = living[first]!;
        const b = living[second]!;
        if (a.dragging || b.dragging || a.dying || b.dying) continue;
        applyPairRepulsion(a, b, 82 + (a.descriptor.starSize + b.descriptor.starSize) * 0.7, 690, delta);
      }
    }

    for (const point of living) {
      if (point.dying && now >= point.removeAfter) {
        point.button.remove();
        points.delete(point.descriptor.term.id);
        continue;
      }
      point.throwOffset.x *= Math.exp(-3.4 * delta);
      point.throwOffset.y *= Math.exp(-3.4 * delta);
      if (!point.dragging && !reduced) {
        const driftTarget = {
          x: point.anchor.x + point.throwOffset.x,
          y: point.anchor.y + point.throwOffset.y,
        };
        if (pointer.active && pointer.pressed && finePointer) {
          const dx = pointer.x - point.position.x;
          const dy = pointer.y - point.position.y;
          const distance = Math.max(54, Math.hypot(dx, dy));
          const gravity = (pointer.pressed ? 4_800 : 1_050) / distance;
          point.velocity.x += (dx / distance) * gravity * delta;
          point.velocity.y += (dy / distance) * gravity * delta;
        }
        stepSpring(point, driftTarget, delta, point.dying ? 0.58 : 0.52, point.dying ? 1 : 0.94);
        limitVelocity(point.velocity);
      }
      const margin = 34;
      if (!point.dragging) {
        if (point.position.x < margin) point.position.x = margin + rubberband(point.position.x - margin, width);
        if (point.position.x > width - margin) point.position.x = width - margin + rubberband(point.position.x - (width - margin), width);
        if (point.position.y < margin) point.position.y = margin + rubberband(point.position.y - margin, height);
        if (point.position.y > height - margin) point.position.y = height - margin + rubberband(point.position.y - (height - margin), height);
      }
      point.opacity += (point.targetOpacity - point.opacity) * clamp(delta * 7.5, 0, 1);
      point.scale += (point.targetScale - point.scale) * clamp(delta * 8.5, 0, 1);
      point.button.style.opacity = point.opacity.toFixed(3);
      point.button.style.transform = `translate3d(${point.position.x}px,${point.position.y}px,0) translate(-50%,-50%) scale(${point.scale.toFixed(3)})`;
      point.button.style.zIndex = String(4 + Math.round(point.descriptor.luminosity * 5));
      point.button.dataset.tooltipSide = point.position.y > height * 0.6 ? "above" : "below";
      const tooltipHalf = Math.min(136, width * 0.21);
      const nearCore = Math.abs(point.position.x - focusPoint.x) < 190 && Math.abs(point.position.y - focusPoint.y) < 190;
      const outward = point.position.x >= focusPoint.x ? 1 : -1;
      const desiredCentre = nearCore ? point.position.x + outward * (tooltipHalf + 70) : point.position.x;
      const tooltipCentre = clamp(desiredCentre, tooltipHalf + 16, width - tooltipHalf - 16);
      point.button.style.setProperty("--tooltip-shift", `${(tooltipCentre - point.position.x).toFixed(1)}px`);
    }
  };

  const tick = (now: number) => {
    frame = 0;
    if (destroyed || !visible || document.hidden) return;
    const delta = clamp((now - lastTime) / 1000, 0, 1 / 24);
    lastTime = now;
    if (now > travelUntil) travelEnergy += (0 - travelEnergy) * clamp(delta * 4.8, 0, 1);
    else travelEnergy += (1 - travelEnergy) * clamp(delta * 9, 0, 1);
    syncPoints(now, delta);
    draw(now);
    if (!reduced) requestFrame();
  };

  function requestFrame(): void {
    if (!frame && !destroyed && visible && !document.hidden) frame = requestAnimationFrame(tick);
  }

  const resize = () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      layout();
      draw(performance.now());
      requestFrame();
    });
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(stage);

  const intersectionObserver = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? true;
    if (visible) { lastTime = performance.now(); requestFrame(); }
    else if (frame) { cancelAnimationFrame(frame); frame = 0; }
  }, { rootMargin: "120px" });
  intersectionObserver.observe(stage);

  const onVisibility = () => { if (!document.hidden) { lastTime = performance.now(); requestFrame(); } };
  document.addEventListener("visibilitychange", onVisibility);

  const onPointerMove = (event: PointerEvent) => {
    const rect = stage.getBoundingClientRect();
    pointer.active = true;
    pointer.x = event.clientX - rect.left;
    pointer.y = event.clientY - rect.top;
  };
  const onPointerLeave = () => { if (!activeDrag) { pointer.active = false; pointer.pressed = false; } };
  const onPointerDown = (event: PointerEvent) => {
    if (event.target === stage || event.target === canvas) pointer.pressed = true;
  };
  const onPointerUp = () => { pointer.pressed = false; };
  stage.addEventListener("pointermove", onPointerMove, { passive: true });
  stage.addEventListener("pointerleave", onPointerLeave);
  stage.addEventListener("pointerdown", onPointerDown);
  stage.addEventListener("pointerup", onPointerUp);
  stage.addEventListener("pointercancel", onPointerUp);

  core.addEventListener("click", () => options.onOpenDefinition?.(centreTerm));
  core.addEventListener("focus", restoreReadout);

  const onPreferenceChange = () => {
    reduced = reducedQuery.matches;
    finePointer = finePointerQuery.matches;
    guidance.textContent = finePointer
      ? "Hover for meaning · choose to travel · drag a word · hold empty sky for gravity · arrows navigate"
      : "Tap a word to travel · swipe the page normally · arrow keys move between stars";
    stage.dataset.reducedMotion = String(reduced);
    layout();
    draw(performance.now());
    requestFrame();
  };
  reducedQuery.addEventListener("change", onPreferenceChange);
  finePointerQuery.addEventListener("change", onPreferenceChange);

  const themeObserver = new MutationObserver(() => {
    palette = readPalette(stage);
    draw(performance.now());
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  updateCore();
  updateReadout(centreTerm);
  layout();
  reconcile(focusPoint);
  setRovingFocus(core);
  stage.dataset.reducedMotion = String(reduced);
  options.onCenterChange?.(centreTerm, undefined, "initial");
  requestFrame();

  const destroy = () => {
    destroyed = true;
    if (frame) cancelAnimationFrame(frame);
    cancelAnimationFrame(resizeFrame);
    resizeObserver.disconnect();
    intersectionObserver.disconnect();
    themeObserver.disconnect();
    reducedQuery.removeEventListener("change", onPreferenceChange);
    finePointerQuery.removeEventListener("change", onPreferenceChange);
    document.removeEventListener("visibilitychange", onVisibility);
    stage.removeEventListener("keydown", onStageKeydown);
    stage.removeEventListener("pointermove", onPointerMove);
    stage.removeEventListener("pointerleave", onPointerLeave);
    stage.removeEventListener("pointerdown", onPointerDown);
    stage.removeEventListener("pointerup", onPointerUp);
    stage.removeEventListener("pointercancel", onPointerUp);
    stage.replaceChildren();
  };

  return {
    travelTo,
    focusCenter: () => { setRovingFocus(core); core.focus({ preventScroll: true }); },
    currentId: () => centreTerm.id,
    destroy,
  };
}
