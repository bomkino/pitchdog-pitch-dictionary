import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { projectMomentum, rubberband, stepSpring } from "../src/physics.ts";
import { fuzzySearch } from "../src/search.ts";
import { CATEGORIES, TERMS } from "../src/terms.ts";

test("dictionary reaches 200 deliberately divided terms", () => {
  assert.equal(TERMS.length, 200);
  assert.equal(CATEGORIES.length, 8);
  for (const category of CATEGORIES) assert.ok(TERMS.filter((term) => term.category === category).length >= 5, `${category} is too thin`);
});

test("fuzzy search survives misspellings, acronyms, aliases, and meaning queries", () => {
  assert.equal(fuzzySearch(TERMS, "loglne")[0]?.label, "Logline");
  assert.equal(fuzzySearch(TERMS, "RTB")[0]?.label, "Reason to believe");
  assert.equal(fuzzySearch(TERMS, "ARR")[0]?.label, "Annual recurring revenue");
  assert.ok(fuzzySearch(TERMS, "unpaid pitch").slice(0, 5).some((term) => term.label === "Speculative work"));
  assert.ok(fuzzySearch(TERMS, "who can decide").slice(0, 8).some((term) => ["Decision owner", "Next decision"].includes(term.label)));
});

test("physical helpers converge, project momentum, and resist edges", () => {
  const body = { position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 } };
  for (let frame = 0; frame < 240; frame += 1) stepSpring(body, { x: 120, y: -40 }, 1 / 60);
  assert.ok(Math.abs(body.position.x - 120) < 0.05);
  assert.ok(Math.abs(body.position.y + 40) < 0.05);
  assert.ok(Math.abs(body.velocity.x) < 0.05);
  assert.ok(projectMomentum(800) > 0);
  assert.ok(projectMomentum(-800) < 0);
  assert.ok(Math.abs(rubberband(80, 800)) < 80);
});

test("galaxy is interactive, keyboard-safe, reduced-motion safe, and grain free", () => {
  const galaxy = readFileSync("src/constellation.ts", "utf8");
  assert.match(galaxy, /prefers-reduced-motion/);
  assert.match(galaxy, /setPointerCapture/);
  assert.match(galaxy, /projectMomentum/);
  assert.match(galaxy, /ArrowRight/);
  assert.match(galaxy, /tabIndex = button === core \? 0 : -1/);
  assert.match(galaxy, /IntersectionObserver/);
  assert.match(galaxy, /visibilitychange/);
  assert.match(galaxy, /focus\(\{ preventScroll: true \}\)/);
  const visible = ["src/main.ts", "src/styles.css", "src/base.css", "index.html"].map((item) => readFileSync(item, "utf8")).join("\n");
  assert.doesNotMatch(visible, /grain-canvas|initialiseGrain|film-grain|scanline/i);
});

test("constellation motion cleans up after itself and term travel always restores focus", () => {
  const constellation = readFileSync("src/constellation.ts", "utf8");
  const main = readFileSync("src/main.ts", "utf8");
  assert.doesNotMatch(constellation, /button\.innerHTML/);
  assert.match(constellation, /resizeObserver\.disconnect\(\)/);
  assert.match(constellation, /intersectionObserver\.disconnect\(\)/);
  assert.match(constellation, /removeEventListener\("pointermove", onPointerMove\)/);
  assert.match(constellation, /removeEventListener\("visibilitychange", onVisibility\)/);
  assert.match(main, /#term-dialog-title[\s\S]*focus\(\{ preventScroll: true \}\)/);
});
