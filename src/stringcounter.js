// Counting the word tokens that match a string, for the string counter app:
// the table behind the bar chart, its CSV form, chart scales and the location hash.
// Searching, folding and grouping by token are in stringsearch.js.

import { ctsVersionOf } from './hmt-release.js';
import { sectionOf } from './propernames.js';
import { entryMatches, tokenMatches, groupByToken, formatSearchHash, parseSearchHash, MIN_QUERY } from './stringsearch.js';

/**
 * @typedef {{token: string, form: string, count: number, passages: string[]}} TokenCount
 *   `token` folded token, `form` its commonest written form, `count` occurrences of the token
 *   in the passages, `passages` keys of the passages that have it (Iliad first, then scholia).
 */

/**
 * Count the matching tokens, alphabetically by token (accents and breathings ignored).
 * @param {SearchIndex} index
 * @param {string[]} keys matching passage keys, in the order wanted within a token
 * @param {string} query folded query
 * @returns {TokenCount[]}
 */
export function countTokens(index, keys, query) {
  return groupByToken(index, keys, query).map(g => {
    let count = 0;
    for (const k of g.keys) {
      for (const p of index.byKey.get(k).parts) count += tokenMatches(p.text, query).filter(t => t.token === g.token).length;
    }
    return { token: g.token, form: g.form, count, passages: g.keys };
  });
}

/**
 * The counts in the order wanted: `alpha` (by token, accents ignored) or `count` (most frequent first, ties alphabetical).
 * @param {TokenCount[]} rows
 * @param {'alpha' | 'count'} order
 * @returns {TokenCount[]}
 */
export function sortCounts(rows, order) {
  const alpha = (a, b) => (a.token < b.token ? -1 : a.token > b.token ? 1 : 0);
  return [...rows].sort(order === 'count' ? (a, b) => b.count - a.count || alpha(a, b) : alpha);
}

/** The rows whose count is at least `min`. @param {TokenCount[]} rows @param {number} min */
export const atLeast = (rows, min) => rows.filter(r => r.count >= min);

/** One CSV field, quoted when it holds a comma, quote or line break. */
const csvField = v => (/[",\r\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

/**
 * The counts as CSV (RFC 4180: comma-delimited, CRLF line ends, header row).
 * @param {TokenCount[]} rows
 */
export function toCsv(rows) {
  const lines = [['token', 'form', 'occurrences', 'passages'].join(',')];
  for (const r of rows) lines.push([r.token, r.form, r.count, r.passages.length].map(csvField).join(','));
  return lines.join('\r\n') + '\r\n';
}

const LATIN = { α: 'a', β: 'b', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'e', θ: 'th', ι: 'i', κ: 'k', λ: 'l', μ: 'm', ν: 'n', ξ: 'x', ο: 'o', π: 'p', ρ: 'r', σ: 's', ς: 's', τ: 't', υ: 'u', φ: 'ph', χ: 'ch', ψ: 'ps', ω: 'o' };

/** File name for the CSV of a (folded) query: Greek is transliterated so the name is plain ASCII, safe for any file system or browser. */
export const csvName = query => {
  const slug = [...query].map(c => LATIN[c] ?? (/[a-z0-9]/i.test(c) ? c : '-')).join('').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return `string-counts-${slug || 'all'}.csv`;
};

/**
 * Round tick values for a value axis from 0 up to at least `max`.
 * @param {number} max
 * @returns {number[]}
 */
export function niceTicks(max) {
  if (!(max > 0)) return [0, 1];
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(1, [1, 2, 5, 10].map(m => m * mag).find(s => s >= raw));   // counts are whole numbers
  const out = [];
  for (let v = 0; v < max + step; v += step) { out.push(v); if (v >= max) break; }
  return out;
}

/** Version-level URN of a passage key. @param {string} key */
export const versionOfKey = key => ctsVersionOf(/** @type {RegExpExecArray} */ (/^(urn:cts:[^:]+:[^:]+:)/.exec(key))[1]);

/**
 * Passages matching a query, limited to chosen texts (version URNs), in index order.
 * @param {SearchIndex} index
 * @param {string} query folded query
 * @param {Set<string>} versions
 * @returns {string[]}
 */
export function searchInVersions(index, query, versions) {
  if (query.length < MIN_QUERY) return [];
  return index.entries.filter(e => entryMatches(e, query) && versions.has(versionOfKey(e.key))).map(e => e.key);
}

/**
 * The texts that can be searched: versions in the index, Iliad first, then scholia, then others;
 * within each, in the order given by `versionOrder` (catalogue order), unknown last.
 * @param {SearchIndex} index
 * @param {string[]} versionOrder
 * @returns {{version: string, section: 'iliad' | 'scholia' | 'other'}[]}
 */
export function textChoices(index, versionOrder) {
  const seen = new Map();
  for (const e of index.entries) {
    const v = versionOfKey(e.key);
    if (!seen.has(v)) seen.set(v, sectionOf(e.key));
  }
  const rank = { iliad: 0, scholia: 1, other: 2 };
  const at = v => versionOrder.indexOf(v) + 1 || 9999;
  return [...seen].map(([version, section]) => ({ version, section })).sort((a, b) => rank[a.section] - rank[b.section] || at(a.version) - at(b.version));
}

const shortVersion = v => v.replace(/^urn:cts:/, '').replace(/:$/, '');
const longVersion = id => `urn:cts:${id}:`;

/**
 * Location hash: the search of stringsearch.js plus the chosen bar (`b`), the order if not
 * alphabetical (`o=count`), the frequency cutoff if above 1 (`m`) and, when only some texts are
 * searched, their versions (`v`, comma-separated).
 * @param {{q: string, scope?: string, kind: string, bar?: string, passage?: string, order?: string, min?: number, versions?: string[] | null}} w
 */
export function formatCounterHash(w) {
  let h = formatSearchHash({ ...w, scope: 'all' });
  if (w.versions) h += `&v=${w.versions.map(v => encodeURIComponent(shortVersion(v))).join(',')}`;
  if (w.bar) h += `&b=${encodeURIComponent(w.bar)}`;
  if (w.order === 'count') h += '&o=count';
  if (w.min > 1) h += `&m=${w.min}`;
  return h;
}

/**
 * Reading of the hash.  `versions` is the list of version URNs to search, or null for all texts;
 * an older `s=iliad|scholia` (no `v`) is given as `scope`.
 * @param {string} hash
 */
export function parseCounterHash(hash) {
  const w = parseSearchHash(hash);
  if (!w) return null;
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  const v = p.get('v');
  return {
    ...w,
    versions: v === null ? null : v.split(',').filter(Boolean).map(longVersion),
    bar: p.get('b') ?? '',
    order: p.get('o') === 'count' ? 'count' : 'alpha',
    min: Math.max(1, Math.floor(Number(p.get('m'))) || 1),
  };
}
