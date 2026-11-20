// @ts-check
/**
 * Logic for the string search app: Greek text compared without breathings,
 * accents and other diacritics, case, or punctuation; a search over every
 * passage of the texts of a release; and the position of a match in the text
 * as written, so that it can be marked.  Pure functions; no DOM access.
 *
 * Convention for inlining (see scripts/build.js): imports are single-line.
 */
import { ctsVersionOf } from './hmt-release.js';
import { textsOfVersion } from './text-index.js';
import { passageKey, sectionOf } from './propernames.js';

/**
 * The text folded for comparison, with where each folded character stands in
 * the original.  Letters lose their diacritics and case (`Ἀχιλῆος` becomes
 * `αχιληοσ`; final sigma and lunate sigma become `σ`), runs of white space
 * become one space, and everything else (punctuation, apostrophes, digits,
 * brackets) is dropped.
 * @param {string} text
 * @returns {{folded: string, start: number[], end: number[]}}
 *   `start[i]`..`end[i]` is the stretch of `text` the i-th folded character
 *   comes from, including any combining marks that follow its letter.
 */
export function foldWithMap(text) {
  let folded = '';
  /** @type {number[]} */ const start = [];
  /** @type {number[]} */ const end = [];
  let at = 0;
  for (const cp of text) {
    const next = at + cp.length;
    const base = cp.normalize('NFD').replace(/\p{M}/gu, '');
    if (base === '' && /\p{M}/u.test(cp)) {                    // a combining mark of the letter before it
      if (end.length) end[end.length - 1] = next;
    } else if (/\s/u.test(cp)) {
      if (folded !== '' && !folded.endsWith(' ')) { folded += ' '; start.push(at); end.push(next); }
    } else {
      for (const ch of base) {
        if (/\p{L}/u.test(ch)) {
          folded += ch.toLowerCase().replace(/[ςϲ]/g, 'σ');
          start.push(at); end.push(next);
        }
      }
    }
    at = next;
  }
  return { folded, start, end };
}

/** A text folded for comparison. @param {string} text */
export const fold = text => foldWithMap(text).folded.trim();

/**
 * The query as it is compared: folded, trimmed.
 * @param {string} input
 */
export function parseQuery(input) {
  return fold(input).trim();
}

/** Fewest letters a query may have. */
export const MIN_QUERY = 2;

/**
 * Where a folded query occurs in a text: ranges of the text as written, not
 * overlapping, in order.
 * @param {string} text
 * @param {string} query  already folded (see `parseQuery`)
 * @returns {{start: number, end: number}[]}
 */
export function findMatches(text, query) {
  /** @type {{start: number, end: number}[]} */
  const out = [];
  if (!query) return out;
  const { folded, start, end } = foldWithMap(text);
  let from = 0;
  for (;;) {
    const i = folded.indexOf(query, from);
    if (i < 0) break;
    const last = i + query.length - 1;
    out.push({ start: start[i], end: end[last] });
    from = i + query.length;
  }
  return out;
}

/**
 * @typedef {Object} SearchEntry
 * @property {string} key   Passage key (version URN + reference).
 * @property {{part: string, text: string, folded: string}[]} parts  One part, or a scholion's lemma and comment.
 */

/**
 * @typedef {Object} SearchIndex
 * @property {string} kind
 * @property {SearchEntry[]} entries  All passages, version by version in text order.
 * @property {Map<string, SearchEntry>} byKey
 */

/**
 * Every passage of the release's texts, with its text folded, ready to search.
 * Each version is read from the exemplar of the requested kind (diplomatic or
 * normalized), or its first exemplar where it has none.
 * @param {Map<string, import('./text-index.js').TextIndex>} textIndex
 * @param {string} kind
 * @returns {SearchIndex}
 */
export function buildSearchIndex(textIndex, kind) {
  /** @type {SearchEntry[]} */
  const entries = [];
  /** @type {Map<string, SearchEntry>} */
  const byKey = new Map();
  const versions = new Set([...textIndex.keys()].map(k => ctsVersionOf(k)).filter(Boolean));
  for (const version of versions) {
    const texts = textsOfVersion(textIndex, version);
    const t = texts.find(x => x.kind === kind) ?? texts[0];
    const tx = t && textIndex.get(t.urn);
    if (!tx) continue;
    const scholia = /^urn:cts:[^:]+:tlg5026\./.test(version);
    tx.refs.forEach((ref, i) => {
      const key = passageKey(`${version}${ref}`);
      if (!key) return;
      const m = scholia ? /\.(lemma|comment)$/.exec(ref) : null;
      let e = byKey.get(key);
      if (!e) { e = { key, parts: [] }; byKey.set(key, e); entries.push(e); }
      const text = tx.texts[i];
      e.parts.push({ part: m ? m[1] : '', text, folded: fold(text) });
    });
  }
  return { kind, entries, byKey };
}

/** Does a passage contain the query in any of its parts? @param {SearchEntry | undefined} e @param {string} query */
export const entryMatches = (e, query) => !!e && !!query && e.parts.some(p => p.folded.includes(query));

/**
 * Passages that contain the query.
 * @param {SearchIndex} index
 * @param {string} query   folded (see `parseQuery`)
 * @param {'all' | 'iliad' | 'scholia'} scope
 * @returns {string[]}  passage keys, in order of the index
 */
export function searchPassages(index, query, scope) {
  if (query.length < MIN_QUERY) return [];
  const out = [];
  for (const e of index.entries) {
    if (scope !== 'all' && sectionOf(e.key) !== scope) continue;
    if (entryMatches(e, query)) out.push(e.key);
  }
  return out;
}

/**
 * A stretch of a passage around its first match, for a result list.
 * @param {SearchEntry} entry
 * @param {string} query
 * @param {number} [width]  characters of context on each side
 * @returns {{before: string, hit: string, after: string} | null}  null if the entry has no match
 */
export function snippet(entry, query, width = 36, token = '') {
  for (const p of entry.parts) {
    const m = (token ? tokenMatches(p.text, query).filter(t => t.token === token) : findMatches(p.text, query))[0];
    if (!m) continue;
    const from = Math.max(0, m.start - width), to = Math.min(p.text.length, m.end + width);
    return {
      before: (from > 0 ? '…' : '') + p.text.slice(from, m.start),
      hit: p.text.slice(m.start, m.end),
      after: p.text.slice(m.end, to) + (to < p.text.length ? '…' : ''),
    };
  }
  return null;
}

const isWordChar = ch => /[\p{L}\p{M}]/u.test(ch);

/**
 * The matches of a query in a text, each with the word token it lies in: the match
 * widened to whole words (a match spanning words gives the whole phrase).
 * `token` is the folded token, `form` the token as written.
 * @param {string} text
 * @param {string} query folded query
 * @returns {{start: number, end: number, token: string, form: string}[]}
 */
export function tokenMatches(text, query) {
  return findMatches(text, query).map(m => {
    let a = m.start, b = m.end;
    while (a > 0 && isWordChar(text[a - 1])) a--;
    while (b < text.length && isWordChar(text[b])) b++;
    const form = text.slice(a, b);
    return { start: m.start, end: m.end, token: fold(form), form };
  });
}

/** The distinct folded tokens of a passage entry that contain the query. */
export const entryTokens = (entry, query) =>
  [...new Set(entry.parts.flatMap(p => tokenMatches(p.text, query).map(t => t.token)))];

/**
 * Group matching passages under the word tokens that match, alphabetically by token
 * ignoring accents and breathings.  A passage with several different tokens is listed
 * under each.  `form` is the commonest written form of the token (lower-cased).
 * @param {SearchIndex} index
 * @param {string[]} keys matching passage keys, in the order wanted within a group
 * @param {string} query folded query
 * @returns {{token: string, form: string, keys: string[]}[]}
 */
export function groupByToken(index, keys, query) {
  /** @type {Map<string, {keys: string[], forms: Map<string, number>}>} */
  const groups = new Map();
  for (const k of keys) {
    const entry = index.byKey.get(k);
    if (!entry) continue;
    const seen = new Set();
    for (const p of entry.parts) for (const t of tokenMatches(p.text, query)) {
      let g = groups.get(t.token);
      if (!g) groups.set(t.token, g = { keys: [], forms: new Map() });
      const f = t.form.toLowerCase();
      g.forms.set(f, (g.forms.get(f) ?? 0) + 1);
      if (!seen.has(t.token)) { seen.add(t.token); g.keys.push(k); }
    }
  }
  return [...groups].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([token, g]) => ({
    token, keys: g.keys,
    form: [...g.forms].sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1))[0][0],
  }));
}

/**
 * Location hash for a search and a chosen passage, and its reading.
 * @param {{q: string, scope: string, kind: string, passage?: string}} w
 */
export function formatSearchHash(w) {
  const p = new URLSearchParams({ q: w.q, s: w.scope, t: w.kind });
  if (w.passage) p.set('p', w.passage);
  return `#${p.toString()}`;
}

/** @param {string} hash @returns {{q: string, scope: 'all' | 'iliad' | 'scholia', kind: string, passage: string} | null} */
export function parseSearchHash(hash) {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  const q = p.get('q');
  if (!q) return null;
  const s = p.get('s');
  const scope = s === 'iliad' || s === 'scholia' ? s : 'all';
  return { q, scope, kind: p.get('t') === 'normalized' ? 'normalized' : 'diplomatic', passage: p.get('p') ?? '' };
}
