import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
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

test("physics is interactive, roving-keyboard safe, reduced-motion safe, and grain free", () => {
  const physics = readFileSync("src/physics.ts", "utf8");
  assert.match(physics, /Matter/);
  assert.match(physics, /prefers-reduced-motion/);
  assert.match(physics, /pointermove/);
  assert.match(physics, /tabIndex = index === 0 \? 0 : -1/);
  assert.match(physics, /ArrowRight/);
  assert.match(physics, /focus-within/);
  const visible = ["src/main.ts", "src/styles.css", "src/base.css", "index.html"].map((item) => readFileSync(item, "utf8")).join("\n");
  assert.doesNotMatch(visible, /grain-canvas|initialiseGrain|film-grain|scanline/i);
});

test("constellation motion cleans up after itself and term travel always restores focus", () => {
  const constellation = readFileSync("src/constellation.ts", "utf8");
  const main = readFileSync("src/main.ts", "utf8");
  assert.doesNotMatch(constellation, /button\.innerHTML/);
  assert.match(constellation, /removeEventListener\("pointermove", pointerMove\)/);
  assert.match(main, /requestAnimationFrame\(\(\) => detail\.querySelector<HTMLElement>\("#term-dialog-title"\)\?\.focus/);
});
