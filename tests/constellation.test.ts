import test from "node:test";
import assert from "node:assert/strict";
import { connectionDegree, constellationFor, galaxyFor } from "../src/constellation.ts";
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

test("editorial connections create visible mass without pretending to be objective", () => {
  const brief = TERMS.find((term) => term.id === "brief");
  const previs = TERMS.find((term) => term.id === "previs");
  assert.ok(brief && previs);
  assert.ok(connectionDegree(brief, TERMS) > connectionDegree(previs, TERMS));

  const galaxy = galaxyFor(brief, TERMS, 12);
  assert.equal(galaxy.length, 12);
  assert.equal(new Set(galaxy.map(({ term }) => term.id)).size, galaxy.length);
  assert.ok(galaxy.every(({ luminosity }) => luminosity >= 0.55 && luminosity <= 1));
  assert.ok(galaxy.every(({ starSize }) => starSize >= 8 && starSize <= 27));
  assert.ok(galaxy.every(({ reason }) => reason.length > 0));
  assert.ok(galaxy.every((item, index) => index === 0 || galaxy[index - 1]!.score >= item.score));
});
