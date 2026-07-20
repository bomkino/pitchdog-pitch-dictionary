import { usEnglish, type PitchTerm } from "./terms.ts";

function normalise(value: string): string { return value.toLocaleLowerCase("en").normalize("NFKD").replace(/[’']/g, "'").replace(/[^a-z0-9]+/g, " ").trim(); }
function trigrams(value: string): Set<string> { const padded = `  ${value}  `; const set = new Set<string>(); for (let i = 0; i < padded.length - 2; i += 1) set.add(padded.slice(i, i + 3)); return set; }
function dice(a: string, b: string): number { const aa = trigrams(a); const bb = trigrams(b); let overlap = 0; aa.forEach((value) => { if (bb.has(value)) overlap += 1; }); return (2 * overlap) / Math.max(1, aa.size + bb.size); }
function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 3) return 9;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) { let previous = row[0]!; row[0] = i; for (let j = 1; j <= b.length; j += 1) { const saved = row[j]!; row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1)); previous = saved; } }
  return row[b.length]!;
}
function score(term: PitchTerm, query: string): number {
  const q = normalise(query); if (!q) return 1;
  const label = normalise(term.label); const aliases = term.aliases.map(normalise); const names = [label, ...aliases];
  if (names.includes(q)) return 120;
  if (names.some((name) => name.startsWith(q))) return 100;
  if (names.some((name) => name.includes(q))) return 88;
  const qTokens = q.split(" "); const nameTokens = names.flatMap((name) => name.split(" "));
  if (qTokens.every((token) => nameTokens.some((candidate) => candidate.startsWith(token)))) return 80;
  const acronym = label.split(" ").map((token) => token[0]).join(""); if (q === acronym) return 78;
  const fuzzyName = Math.max(...names.map((name) => dice(name, q)));
  const distance = Math.min(...names.flatMap((name) => [editDistance(name, q), ...name.split(" ").map((token) => editDistance(token, q))]));
  const body = normalise(`${term.plain} ${term.whyItMatters} ${term.changes} ${usEnglish(term.category)}`);
  const bodyHit = qTokens.every((token) => body.includes(token)) ? 35 : 0;
  const typo = distance <= 1 ? 72 : distance === 2 && q.length >= 5 ? 60 : distance === 3 && q.length >= 8 ? 45 : 0;
  return Math.max(bodyHit, typo, fuzzyName * 68);
}
export function fuzzySearch(terms: readonly PitchTerm[], query: string): PitchTerm[] {
  if (!query.trim()) return [...terms];
  return terms.map((term) => ({ term, score: score(term, query) })).filter((item) => item.score >= 28).sort((a, b) => b.score - a.score || a.term.label.localeCompare(b.term.label)).map((item) => item.term);
}
