# Contributing

Useful contributions make Pitch Dictionary clearer, more complete, easier to search, or more accessible.

## Before coding

Search the live registry first. For a term change, name the intended user, route, source or practitioner basis, plain definition, why it matters, what it changes, aliases, common confusion, and related terms. Definitions should explain work—not display insider status.

## Local setup

```bash
git clone https://github.com/bomkino/pitchdog-pitch-dictionary.git
cd pitchdog-pitch-dictionary
npm install
npm run verify
```

Use Node.js 22.18 or newer.

## Editorial rules

- Prefer the words practitioners actually meet; explain them without jargon theater.
- Distinguish a convention from a current requirement.
- Do not universalize one market, country, company, or funding route.
- Use US English for public labels while preserving legitimate industry terms.
- Keep stable IDs when refining labels.
- Add aliases people genuinely type, including useful acronyms and common misspellings.
- Related terms should teach a relationship, not merely share a category.
- Note ambiguity instead of manufacturing certainty.

## Product rules

- Keep search, definitions, and navigation local and deterministic.
- Every visual node must remain a real keyboard-focusable control with an equivalent text relationship.
- Preserve query, filters, and scroll position when a term closes.
- Reduced motion must keep all information and navigation.
- Add focused tests for changed fuzzy-search or relationship logic.
- Do not add runtime AI, analytics, accounts, remote fonts, or an email gate.
- No noise overlays.

## Pull requests

Include the editorial or user problem, affected terms or algorithms, screenshots for visible work, tests, `npm run verify` output, sources or practitioner basis where relevant, and privacy/accessibility/licensing effects.

Contributions use AGPL-3.0-or-later for software and documentation; CC BY-SA 4.0 for original visual assets.
