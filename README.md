<p align="center">
  <img src="public/assets/social-card.png" alt="Pitch Dictionary: a tactile celestial word observatory" width="100%">
</p>

# Pitch Dictionary

**[Open the live tool](https://pitchdog-pitch-dictionary.dog-pitch.chatgpt.site)**

**Clear the doubt. Keep your place.**

A local-first dictionary for pitch work: 200 plain-English terms, forgiving fuzzy search, useful context, and a navigable galaxy of related ideas.

[![Verify](https://github.com/bomkino/pitchdog-pitch-dictionary/actions/workflows/ci.yml/badge.svg)](https://github.com/bomkino/pitchdog-pitch-dictionary/actions/workflows/ci.yml)

<p align="center">
  <img src="docs/media/journey.jpg" alt="Pitch Dictionary constellation showing related terms as explorable nodes" width="100%">
</p>

## Search like a person

Search by term, acronym, meaning, alias, or a reasonable misspelling. Filters cover eight practical families: foundations, story and screen, advertising, business and startups, rooms and slides, evidence and claims, rights and labor, and access and inclusion.

Results explain:

- what the term means in plain English;
- why it matters;
- what it changes in the work;
- nearby ideas and common confusions.

## One word. Then the galaxy.

Search when you know what is bothering you. Travel when you do not. Hover or focus a star for its plain meaning; choose it to make it the centre. The definition changes without throwing away your place.

The galaxy is deterministic editorial navigation, not an AI-generated thesaurus. Big stars have more recorded connections. Brighter paths mean a closer relationship. Faint terms sit further out. Every visual route is also available as an ordinary text button.

The physical layer is deliberately interruptible:

- drag a word and it springs home from its live position and velocity;
- hold empty sky to pull nearby words into a temporary gravity well;
- use arrow keys to move spatially, `Home` to return to the centre, and `Enter` to travel;
- choose reduced motion for the same map without twinkling, momentum, streaks, or animated travel.

Canvas draws light, filaments, depth, and occasional shooting stars. Semantic HTML carries every term, meaning, and action. The showmanship never becomes the only route.

## Local by design

Search and term data run entirely in the browser. No runtime AI, account, database, analytics, upload, remote font, or email gate.

## Run and verify

Requires Node.js 22.18 or newer.

```bash
npm install
npm run dev
npm run verify
```

`npm run verify` runs TypeScript checks, term/search/constellation tests, the production build, and hosting-contract tests.

## How it is built

- `src/terms.ts` — the public 200-term editorial registry
- `src/search.ts` — deterministic fuzzy ranking
- `src/constellation.ts` — relationship scoring, semantic mass, spatial navigation, and the shared galaxy
- `src/physics.ts` — springs, collision pressure, momentum projection, and edge resistance
- `src/main.ts` — search, categories, pagination, dialog, and navigation
- `tests/` — search, registry, constellation, and hosting contracts
- `docs/PRODUCT-CONTRACT.md` — editorial and technical boundaries
- `THIRD_PARTY_NOTICES.md` — transformed interaction references; no copied code or assets

## Contributing and reuse

New terms, clearer definitions, missing aliases, better relationships, localization work, and accessibility fixes are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), and [SECURITY.md](SECURITY.md).

Software and documentation: [AGPL-3.0-or-later](LICENSE). Original visual assets: [CC BY-SA 4.0](ASSET-LICENSE.md). The pitch.dog name and logo remain subject to [TRADEMARKS.md](TRADEMARKS.md).
