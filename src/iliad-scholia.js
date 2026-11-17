// @ts-check
/**
 * Logic for the Iliad-scholia app: Iliad versions, passage-range resolution,
 * and scholia attached to passages through the `commentary` data model.
 * Pure functions over an `HmtRelease`; no DOM access.
 *
 * Convention for inlining (see scripts/build.js): imports are single-line.
 */
import { ctsVersionOf } from './hmt-release.js';
import { exemplarName, KIND_ORDER, passageText } from './text-index.js';

/** Data model whose relation sets link scholia to the passages they comment on. */
export const COMMENTARY_MODEL = 'urn:cite2:cite:datamodels.v1:commentarymodel';

/** Version-level URN of any version of the Iliad (tlg0012.tlg001). */
const ILIAD_VERSION = /^urn:cts:[^:]+:tlg0012\.tlg001\.[^.:]+:$/;

/** @typedef {import('./text-index.js').TextIndex} TextIndex */

/**
 * All Iliad versions listed in the CTS catalog, with the texts available for each.
 * @param {import('./hmt-release.js').HmtRelease} release
 * @param {Map<string, TextIndex>} textIndex
 * @returns {{urn: string, label: string, online: boolean,
 *            texts: {urn: string, kind: string}[]}[]}
 */
export function iliadVersions(release, textIndex) {
  return release.ctsCatalog()
    .filter(c => ILIAD_VERSION.test(c.urn))
    .map(c => {
      const texts = [...textIndex.keys()]
        .filter(k => ctsVersionOf(k) === c.urn)
        .map(k => ({ urn: k, kind: exemplarName(k) }))
        .sort((a, b) => (KIND_ORDER.indexOf(a.kind) + 1 || 99) - (KIND_ORDER.indexOf(b.kind) + 1 || 99));
      return { urn: c.urn, label: c.versionLabel, online: c.online === 'true' && texts.length > 0, texts };
    });
}

// ---------------------------------------------------------------------------
// Passage references and ranges
// ---------------------------------------------------------------------------

/**
 * Split a reference such as `1.1-1.10` into its endpoints.  Tolerates
 * subreferences (`15.339@word`), trailing dots, and Unicode dashes.
 * @param {string} input
 * @returns {string[]}  One endpoint for a single passage, two for a range.
 */
export function splitReference(input) {
  const s = input.replace(/[‐-―]/g, '-').replace(/@.*?(?=-\d+\.\d|$)/g, '').trim();
  const i = s.indexOf('-');
  const clean = (/** @type {string} */ x) => x.trim().replace(/\.$/, '');
  return i < 0 ? [clean(s)] : [clean(s.slice(0, i)), clean(s.slice(i + 1))];
}

/**
 * Ways to read the end of a range given its start.  `1.1-10` and
 * `14.205-207` mean the same book; `14.75-6` abbreviates 14.76.
 * @param {string} a start
 * @param {string} b end as written
 */
function endCandidates(a, b) {
  const dot = a.indexOf('.');
  if (b.includes('.') || dot < 0) return [b];
  const book = a.slice(0, dot);
  const line = a.slice(dot + 1);
  const out = [book + '.' + b];
  if (/^\d+$/.test(b) && /^\d+$/.test(line) && b.length < line.length) {
    out.push(book + '.' + line.slice(0, line.length - b.length) + b);
  }
  return out;
}

/** First and last position of the passages in a book, or null. */
function bookBounds(text, book) {
  const prefix = book + '.';
  let first = -1, last = -1;
  for (let i = 0; i < text.refs.length; i++) {
    if (text.refs[i].startsWith(prefix)) { if (first < 0) first = i; last = i; }
  }
  return first < 0 ? null : { first, last };
}

/**
 * Resolve a reference to positions in a text.  Both ends are inclusive and
 * follow the order of the text.  Accepts `1.5`, `1.1-1.10`, `1.1-10`, and
 * (unless `allowBook` is false) whole books: `1`, `1-3`.
 * @param {TextIndex} text
 * @param {string} input
 * @param {{allowBook?: boolean}} [opts]
 * @returns {{start: number, end: number} | {error: string}}
 */
export function resolveRange(text, input, opts = {}) {
  const allowBook = opts.allowBook !== false;
  const [a, b] = splitReference(input);
  if (!a) return { error: 'Enter a passage reference, for example 1.1-1.10.' };
  const isBook = (/** @type {string} */ x) => /^\d+$/.test(x);

  if (isBook(a)) {
    if (!allowBook) return { error: `"${a}" is not a passage reference.` };
    const first = bookBounds(text, a);
    if (!first) return { error: `Book ${a} is not in this text.` };
    if (b === undefined) return { start: first.first, end: first.last };
    if (!isBook(b)) return { error: `A range of books needs a book number at both ends ("${a}-${b}").` };
    const last = bookBounds(text, b);
    if (!last) return { error: `Book ${b} is not in this text.` };
    if (last.last < first.first) return { error: 'The range ends before it starts.' };
    return { start: first.first, end: last.last };
  }

  const start = text.pos.get(a);
  if (start === undefined) return { error: `Passage ${a} is not in this text.` };
  if (b === undefined) return { start, end: start };
  for (const cand of endCandidates(a, b)) {
    const end = text.pos.get(cand);
    if (end !== undefined && end >= start) return { start, end };
  }
  const missing = endCandidates(a, b).some(c => text.pos.has(c));
  return { error: missing ? 'The range ends before it starts.' : `Passage ${endCandidates(a, b)[0]} is not in this text.` };
}

// ---------------------------------------------------------------------------
// Commentary relations
// ---------------------------------------------------------------------------

/**
 * Scholion–passage pairs from every relation set documented in `datamodels`
 * as following the commentary model.
 * @param {import('./hmt-release.js').HmtRelease} release
 * @returns {{scholion: string, target: string}[]}
 */
export function commentaryPairs(release) {
  const modelled = new Set(release.dataModels()
    .filter(m => m.model === COMMENTARY_MODEL).map(m => m.collection));
  /** @type {{scholion: string, target: string}[]} */
  const pairs = [];
  for (const rs of release.relationSets()) {
    if (!modelled.has(rs.urn)) continue;
    const [c1, c2] = rs.header;
    for (const row of rs.rows) {
      pairs.push({ scholion: row.scholion ?? row[c1] ?? '', target: row.iliad ?? row[c2] ?? '' });
    }
  }
  return pairs;
}

/**
 * Resolve the passages commented on in one Iliad version to positions in a
 * text of that version.  Relations that cannot be resolved (for example
 * `13.UNKNOWN`) are counted, not guessed at.
 * @param {{scholion: string, target: string}[]} pairs
 * @param {string} versionUrn
 * @param {TextIndex} text
 * @returns {{spans: {scholion: string, start: number, end: number}[], unresolved: number}}
 */
export function commentarySpans(pairs, versionUrn, text) {
  const spans = [];
  let unresolved = 0;
  for (const p of pairs) {
    const m = /^(urn:cts:[^:]+:[^:]+:)(.*)$/.exec(p.target);
    if (!m || ctsVersionOf(m[1]) !== versionUrn) continue;
    const r = resolveRange(text, m[2], { allowBook: false });
    if ('error' in r) { unresolved++; continue; }
    spans.push({ scholion: p.scholion, start: r.start, end: r.end });
  }
  return { spans, unresolved };
}

/**
 * The passages of a range with the distinct scholia commenting on each.
 * @param {TextIndex} text
 * @param {{start: number, end: number}} range
 * @param {{scholion: string, start: number, end: number}[]} spans
 * @returns {{lines: {ref: string, text: string, scholia: string[]}[], scholiaTotal: number}}
 */
export function annotateRange(text, range, spans) {
  /** @type {Map<number, Set<string>>} */
  const perLine = new Map();
  const all = new Set();
  for (const sp of spans) {
    if (sp.end < range.start || sp.start > range.end) continue;
    const to = Math.min(sp.end, range.end);
    for (let i = Math.max(sp.start, range.start); i <= to; i++) {
      let s = perLine.get(i);
      if (!s) { s = new Set(); perLine.set(i, s); }
      s.add(sp.scholion);
      all.add(sp.scholion);
    }
  }
  const lines = [];
  for (let i = range.start; i <= range.end; i++) {
    lines.push({ ref: text.refs[i], text: text.texts[i], scholia: [...(perLine.get(i) ?? [])] });
  }
  return { lines, scholiaTotal: all.size };
}

/**
 * Lemma and comment of a scholion, taken from the same kind of text
 * (normalized or diplomatic) as the Iliad being shown when that exists.
 * @param {Map<string, TextIndex>} textIndex
 * @param {string} scholionUrn  e.g. `urn:cts:greekLit:tlg5026.msAint.hmt:1.28`
 * @param {string} kind         e.g. `normalized`
 * @returns {{label: string, lemma: string, comment: string}}
 */
export function scholionPassage(textIndex, scholionUrn, kind) {
  const m = /^(urn:cts:[^:]+:)([^:]+):(.*)$/.exec(scholionUrn);
  if (!m) return { label: scholionUrn, lemma: '', comment: '' };
  const { parts } = passageText(textIndex, scholionUrn, kind);
  const get = (/** @type {string} */ name) => parts.find(p => p.part === name)?.text ?? '';
  return { label: `${m[2].split('.')[1] ?? m[2]} ${m[3]}`, lemma: get('lemma'), comment: get('comment') };
}
