// @ts-check
/**
 * Logic for the lemmatized search app: reading the (very large) lemmatization data set
 * `token|passage|type|lemma|pos` as a stream into a compact index by lemma, reading the
 * metadata of lemmatization releases, relating a token URN to the passage it belongs to,
 * finding a token in the text of its passage, and the location hash.
 * Pure functions; no DOM access.
 *
 * Convention for inlining (see scripts/build.js): imports are single-line.
 */
import { ctsVersionOf } from './hmt-release.js';
import { fold, MIN_QUERY } from './stringsearch.js';
import { passageKey, sectionOf } from './propernames.js';

/** Where the lemmatization data and its metadata are published. */
export const LEMMATA_URL = 'https://shot.holycross.edu/hmt/lemmatization/lemmata-current.cex';
export const LEMMATA_RELEASES_URL = 'https://shot.holycross.edu/hmt/lemmatization/lemmata-releases.cex';

// ---------------------------------------------------------------------------
// Release metadata
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} LemmataRelease
 * @property {string} release  e.g. `lemmata-current`.
 * @property {string} date
 * @property {string} archive  Identifier of the HMT archive release the lemmatization was built from.
 * @property {string} llm      The language model used.
 */

/**
 * Rows of `lemmata-releases.cex` (`release|date|archive|llm`).  A header line, blank lines and
 * comments are skipped.
 * @param {string} text
 * @returns {LemmataRelease[]}
 */
export function parseReleasesCex(text) {
  const out = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('//') || line.startsWith('#!')) continue;
    const f = line.split('|').map(s => s.trim());
    if (f.length < 3 || (f[0] === 'release' && f[1] === 'date')) continue;
    out.push({ release: f[0], date: f[1], archive: f[2], llm: f[3] ?? '' });
  }
  return out;
}

/** The row for `lemmata-current`, or null. @param {LemmataRelease[]} rows */
export const currentLemmataRelease = rows => rows.find(r => r.release === 'lemmata-current') ?? null;

/** The release identifier (`2024c`) in a string, or null. @param {string} s */
export function releaseIdOf(s) {
  const m = /(?<![A-Za-z0-9])(\d{4}[a-z])(?![A-Za-z0-9])/i.exec(s ?? '');
  return m ? m[1].toLowerCase() : null;
}

/**
 * Compare the archive release a lemmatization was built from with the release in use.
 * @param {string} archive  The `archive` value of the lemmatization release.
 * @param {{urn?: string, name?: string}} library  Library metadata of the HMT release.
 * @returns {{status: 'same' | 'different' | 'unknown', lemmata: string, release: string}}
 */
export function compareArchives(archive, library) {
  const have = releaseIdOf(archive);
  const want = releaseIdOf(library.urn ?? '') ?? releaseIdOf(library.name ?? '');
  if (have && want) return { status: have === want ? 'same' : 'different', lemmata: have, release: want };
  const a = (archive ?? '').trim().toLowerCase();
  const text = `${library.urn ?? ''} ${library.name ?? ''}`.toLowerCase();
  return { status: a && text.includes(a) ? 'same' : 'unknown', lemmata: have ?? archive ?? '', release: want ?? library.name ?? '' };
}

// ---------------------------------------------------------------------------
// The lemmatization data
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} LemmaEntry  One lemma and all its tokens, as parallel arrays.
 * @property {string} lemma
 * @property {string} folded   Lemma without diacritics, case or punctuation.
 * @property {number[]} v      Index in `LemmaData.versions`.
 * @property {number[]} pr     Index in `LemmaData.refs` (passage reference, without the token part).
 * @property {number[]} tn     Token number within the passage (0 if the URN had none).
 * @property {string[]} t      The token as written.
 * @property {number[]} p      Index in `LemmaData.poses`.
 */

/**
 * @typedef {Object} LemmaData
 * @property {string[]} versions   Token-level version URNs (`urn:cts:ns:work.version.exemplar-tokens:`).
 * @property {Map<string, number>} versionIx
 * @property {string[]} refs       Distinct passage references.
 * @property {Map<string, number>} refIx
 * @property {string[]} poses      Distinct part-of-speech codes.
 * @property {Map<string, number>} posIx
 * @property {Map<string, LemmaEntry>} lemmas
 * @property {LemmaEntry[]} list   Entries, alphabetical (after `finishLemmaData`).
 * @property {number} lexical      Lexical tokens kept.
 * @property {number} punctuation  Punctuation tokens ignored.
 * @property {number} malformed    Lines that could not be read.
 */

/**
 * A copy of a string that does not keep the text it was cut from alive (V8 shares the text of long
 * substrings; over millions of lines that would hold the whole file in memory).
 * @param {string} s
 */
export const ownString = s => (s.length < 13 ? s : Array.from(s).join(''));

/** @returns {LemmaData} */
export function createLemmaData() {
  return {
    versions: [], versionIx: new Map(), refs: [], refIx: new Map(), poses: [], posIx: new Map(),
    lemmas: new Map(), list: [], lexical: 0, punctuation: 0, malformed: 0,
  };
}

/** Index of a value in an interning table, adding it if new. */
function intern(list, ix, value) {
  let i = ix.get(value);
  if (i === undefined) { value = ownString(value); i = list.length; list.push(value); ix.set(value, i); }
  return i;
}

/**
 * Add one line of the data set.  Header, comment and blank lines, punctuation tokens and
 * malformed lines are not kept (the last are counted).
 * @param {LemmaData} d
 * @param {string} line
 */
export function addLemmaLine(d, line) {
  if (!line || line.startsWith('//') || line.startsWith('#!')) return;
  const f = line.split('|');
  if (f.length < 5) { d.malformed++; return; }
  const type = f[2].trim();
  if (type !== 'lexical') {
    if (type === 'punctuation') d.punctuation++;
    else if (!(f[0] === 'token' && f[1] === 'passage')) d.malformed++;   // the header names the columns
    return;
  }
  const u = f[1].trim();
  const i1 = u.indexOf(':', 8);
  const i2 = i1 < 0 ? -1 : u.indexOf(':', i1 + 1);
  const lemma = f[3];
  if (i2 < 0 || !lemma) { d.malformed++; return; }
  const ref = u.slice(i2 + 1);
  const j = ref.lastIndexOf('.t');
  const num = j >= 0 && /^\d+$/.test(ref.slice(j + 2)) ? Number(ref.slice(j + 2)) : 0;
  let e = d.lemmas.get(lemma);
  if (!e) {
    const own = ownString(lemma);
    e = { lemma: own, folded: fold(own), v: [], pr: [], tn: [], t: [], p: [] };
    d.lemmas.set(own, e);
  }
  e.v.push(intern(d.versions, d.versionIx, u.slice(0, i2 + 1)));
  e.pr.push(intern(d.refs, d.refIx, num ? ref.slice(0, j) : ref));
  e.tn.push(num);
  e.t.push(ownString(f[0]));
  e.p.push(intern(d.poses, d.posIx, f[4].trim()));
  d.lexical++;
}

/** Sort the entries once all lines are in. @param {LemmaData} d */
export function finishLemmaData(d) {
  d.list = [...d.lemmas.values()].sort((a, b) => (a.folded < b.folded ? -1 : a.folded > b.folded ? 1 : a.lemma < b.lemma ? -1 : a.lemma > b.lemma ? 1 : 0));
  return d;
}

/** Parse a whole text (for tests and small files). @param {string} text */
export function parseLemmata(text) {
  const d = createLemmaData();
  for (const line of text.split('\n')) addLemmaLine(d, line.endsWith('\r') ? line.slice(0, -1) : line);
  return finishLemmaData(d);
}

/**
 * Read the data set from a byte stream (a fetch body or `File.stream()`), line by line, so the whole
 * text is never in memory at once.
 * @param {ReadableStream<Uint8Array>} stream
 * @param {{onProgress?: (p: {read: number, rows: number}) => void}} [opt]
 * @returns {Promise<LemmaData>}
 */
export async function readLemmata(stream, opt = {}) {
  const d = createLemmaData();
  const reader = stream.getReader();
  const dec = new TextDecoder('utf-8');
  let tail = '', read = 0, last = Date.now();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    read += value.length;
    const lines = (tail + dec.decode(value, { stream: true })).split('\n');
    tail = /** @type {string} */ (lines.pop());
    for (const l of lines) addLemmaLine(d, l.endsWith('\r') ? l.slice(0, -1) : l);
    if (opt.onProgress) opt.onProgress({ read, rows: d.lexical });
    if (Date.now() - last > 50) { await new Promise(r => setTimeout(r, 0)); last = Date.now(); }   // let the page paint
  }
  tail += dec.decode();
  if (tail) addLemmaLine(d, tail.endsWith('\r') ? tail.slice(0, -1) : tail);
  if (opt.onProgress) opt.onProgress({ read, rows: d.lexical });
  return finishLemmaData(d);
}

/**
 * Lemmata that contain the query (given as typed: it is folded here), alphabetical.
 * @param {LemmaData} d
 * @param {string} query folded query
 * @returns {LemmaEntry[]}
 */
export function searchLemmata(d, query) {
  if (query.length < MIN_QUERY) return [];
  return d.list.filter(e => e.folded.includes(query));
}

/**
 * @typedef {Object} Occurrence
 * @property {string} token
 * @property {string} pos
 * @property {string} lemma
 * @property {string} version     Version URN of the text (`urn:cts:ns:work.version:`), as in passage keys.
 * @property {string} tokenUrn    URN of the token.
 * @property {string} passageUrn  URN of the passage (version of the text without `-tokens`).
 * @property {string | null} key  Passage key (see propernames.js `passageKey`).
 * @property {number} n           Token number within the passage (or within its part, for a scholion); 0 if unknown.
 * @property {string} part        `lemma` or `comment` for a scholion, otherwise empty.
 */

/** The `i`th token of a lemma. @param {LemmaData} d @param {LemmaEntry} e @param {number} i @returns {Occurrence} */
export function occurrenceOf(d, e, i) {
  const tokenVersion = d.versions[e.v[i]];
  const base = tokenVersion.replace(/-tokens(?=:$)/, '');
  const pref = d.refs[e.pr[i]];
  const key = passageKey(base + pref);
  const n = e.tn[i];
  return {
    token: e.t[i], pos: d.poses[e.p[i]], lemma: e.lemma, n, key, part: (/\.(lemma|comment)$/.exec(pref) ?? [])[1] ?? '',
    version: ctsVersionOf(base) ?? base,
    tokenUrn: n ? `${tokenVersion}${pref}.t${n}` : `${tokenVersion}${pref}`,
    passageUrn: base + pref,
  };
}

/**
 * Indices of a lemma's tokens in the order to list them: by text (Iliad, then scholia, then others;
 * in `versionOrder` within each), then as in the data.
 * @param {LemmaData} d
 * @param {LemmaEntry} e
 * @param {string[]} versionOrder base version URNs in catalogue order
 * @returns {number[]}
 */
export function orderOccurrences(d, e, versionOrder) {
  const rank = { iliad: 0, scholia: 1, other: 2 };
  const vr = d.versions.map(v => {
    const base = v.replace(/-tokens(?=:$)/, '');
    return rank[sectionOf(base + '1')] * 10000 + (versionOrder.indexOf(ctsVersionOf(base) ?? base) + 1 || 9999);
  });
  return e.v.map((_, i) => i).sort((a, b) => vr[e.v[a]] - vr[e.v[b]] || a - b);
}

/**
 * The distinct written forms of a lemma's tokens, most frequent first.
 * @param {LemmaEntry} e
 * @returns {{form: string, count: number}[]}
 */
export function lemmaForms(e) {
  const m = new Map();
  for (const t of e.t) m.set(t, (m.get(t) ?? 0) + 1);
  return [...m].map(([form, count]) => ({ form, count })).sort((a, b) => b.count - a.count || (a.form < b.form ? -1 : 1));
}

// ---------------------------------------------------------------------------
// Finding a token in its passage
// ---------------------------------------------------------------------------

const TOKEN_RE = /[\p{L}\p{M}\p{N}]+['’ʼ᾽]?|\S/gu;
const SPLIT_RE = /[\p{L}\p{M}\p{N}]+|\S/gu;      // the elision mark as a token of its own

/**
 * Tokens of a passage text: runs of letters (with a following elision mark) and single
 * punctuation marks, as `{text, start, end, lexical}`.  The lemmatization is not consistent about the
 * elision mark (`δ'` is one token, `μυρί` `'` two), so it can be taken as part of the word or on its own.
 * @param {string} text
 * @param {boolean} [splitElision]
 */
export function tokenizeGreek(text, splitElision = false) {
  return [...text.matchAll(splitElision ? SPLIT_RE : TOKEN_RE)].map(m => ({
    text: m[0], start: /** @type {number} */ (m.index), end: /** @type {number} */ (m.index) + m[0].length,
    lexical: /[\p{L}\p{N}]/u.test(m[0][0]),
  }));
}

const sameToken = (a, b) => a.normalize('NFC') === b.normalize('NFC') || (fold(a) !== '' && fold(a) === fold(b));

/**
 * Where a token is in the text of its passage (the parts of `passageText`: a scholion has `lemma`
 * and `comment`).  In the real data the token number counts punctuation, and a scholion's tokens are
 * numbered again from 1 in its lemma and in its comment; but the numbering is not always exact.  So
 * the number is tried in several ways (within the named part; over the whole passage; counting only
 * lexical tokens; with the elision mark as a token of its own) and accepted only where the text is
 * the token.  Failing that the token is looked for by its string: if the passage has it once, that is
 * it; if more than once, the one whose position is nearest to the number; if not at all, nothing.
 * @param {{part: string, text: string}[]} parts
 * @param {string} token
 * @param {number} n token number (0 if unknown)
 * @param {string} [partName] `lemma` or `comment` when the number counts within that part
 * @returns {{hits: {part: number, start: number, end: number}[], how: 'number' | 'lexical-number' | 'part-number' | 'string' | 'nearest' | 'none'}}
 */
export function locateToken(parts, token, n, partName = '') {
  const tokens = split => { const all = []; parts.forEach((p, part) => { for (const t of tokenizeGreek(p.text, split)) all.push({ ...t, part }); }); return all; };
  const all = tokens(false);
  const hit = t => ({ part: t.part, start: t.start, end: t.end });
  const lexical = list => list.filter(t => t.lexical);
  if (n > 0) {
    const pi = partName ? parts.findIndex(p => p.part === partName) : -1;
    if (pi >= 0) {                                         // numbered within the part
      for (const list of [all, tokens(true)]) {
        const mine = list.filter(t => t.part === pi);
        const t = [mine[n - 1], lexical(mine)[n - 1]].find(x => x && sameToken(x.text, token));
        if (t) return { hits: [hit(t)], how: 'part-number' };
      }
    }
    for (const list of [all, tokens(true)]) {              // over the passage: elision mark with the word, then on its own
      const a = list[n - 1];
      if (a && sameToken(a.text, token)) return { hits: [hit(a)], how: 'number' };
    }
    const b = lexical(all)[n - 1];
    if (b && sameToken(b.text, token)) return { hits: [hit(b)], how: 'lexical-number' };
    if (parts.length > 1) {                                // numbering that starts again in each part
      const found = [];
      parts.forEach((_, part) => {
        const mine = all.filter(t => t.part === part);
        const t = [mine[n - 1], lexical(mine)[n - 1]].find(x => x && sameToken(x.text, token));
        if (t) found.push(hit(t));
      });
      if (found.length === 1) return { hits: found, how: 'part-number' };
    }
  }
  const same = lexical(all).filter(t => sameToken(t.text, token));
  if (same.length === 1 || n <= 0) return { hits: same.map(hit), how: same.length ? 'string' : 'none' };
  if (!same.length) return { hits: [], how: 'none' };
  const lex = lexical(all);
  const dist = t => Math.min(Math.abs(all.indexOf(t) + 1 - n), Math.abs(lex.indexOf(t) + 1 - n));
  const nearest = same.reduce((best, t) => (dist(t) < dist(best) ? t : best));
  return { hits: [hit(nearest)], how: 'nearest' };
}

// ---------------------------------------------------------------------------
// Location hash
// ---------------------------------------------------------------------------

/**
 * `#q=<string>[&l=<lemma>][&o=<token URN without urn:cts:>]`.
 * @param {{q: string, lemma?: string, token?: string}} w
 */
export function formatLemmaHash(w) {
  let h = `#q=${encodeURIComponent(w.q)}`;
  if (w.lemma) h += `&l=${encodeURIComponent(w.lemma)}`;
  if (w.token) h += `&o=${encodeURIComponent(w.token.replace(/^urn:cts:/, ''))}`;
  return h;
}

/** @param {string} hash @returns {{q: string, lemma: string, token: string} | null} */
export function parseLemmaHash(hash) {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  const q = p.get('q');
  if (!q) return null;
  const o = p.get('o');
  return { q, lemma: p.get('l') ?? '', token: o ? `urn:cts:${o}` : '' };
}
