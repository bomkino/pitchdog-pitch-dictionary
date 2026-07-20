import test from "node:test";
import assert from "node:assert/strict";
import { constellationFor } from "../src/constellation.ts";
import { TERMS } from "../src/terms.ts";

test("constellations return distinct, navigable editorial neighbours", () => {
  const pitch = TERMS.find((term) => term.id === "pitch");
  assert.ok(pitch);
  const neighbours = constellationFor(pitch, TERMS);
  assert.equal(neighbours.length, 8);
  assert.equal(new Set(neighbours.map((term) => term.id)).size, 8);
  assert.ok(neighbours.some((term) => term.id === "ask"));
  assert.ok(neighbours.some((term) => term.id === "decision-owner"));
});

test("a term never appears in its own constellation", () => {
  for (const term of TERMS) {
    assert.ok(!constellationFor(term, TERMS).some((candidate) => candidate.id === term.id));
  }
});
