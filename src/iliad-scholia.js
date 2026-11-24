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

/**
 * Short name of a version for tight places: its label without the parenthesis
 * (`Venetus A (Marciana 454 = 822)` gives `Venetus A`).
 * @param {string} label
 */
export function shortVersionLabel(label) {
  return label.replace(/\s*\([^)]*\)\s*$/, '').trim() || label;
}

/**
 * Interpret a CTS URN given to the app (`?text=…`) as a version of the Iliad,
 * optionally a text of it (exemplar), and optionally a passage or range.
 *   urn:cts:greekLit:tlg0012.tlg001.msA:1.1-1.10                 version + range
 *   urn:cts:greekLit:tlg0012.tlg001.msA.normalized:1.5           + a specific text
 *   urn:cts:greekLit:tlg0012.tlg001.msA:                         version only
 * @param {ReturnType<typeof iliadVersions>} versions
 * @param {string} param
 * @returns {{version: ReturnType<typeof iliadVersions>[number], kind: string | null, ref: string, note?: string}
 *          | {error: string}}
 */
export function parseUrnParam(versions, param) {
  const urn = (param || '').trim();
  const m = /^urn:cts:[^:]+:([^:]+):(.*)$/.exec(urn);
  if (!m) return { error: `"${urn}" is not a CTS URN (expected something like urn:cts:greekLit:tlg0012.tlg001.msA:1.1-1.10).` };
  const parts = m[1].split('.');
  if (parts.length < 3) return { error: `"${urn}" does not name a version of the Iliad: add the version, as in tlg0012.tlg001.msA.` };
  const versionUrn = ctsVersionOf(urn);
  const version = versions.find(v => v.urn === versionUrn);
  if (!version) return { error: `${versionUrn} is not a version of the Iliad in this release.` };
  if (!version.online) return { error: `${version.label} has no online text in this release.` };
  /** @type {string | null} */ let kind = null;
  /** @type {string | undefined} */ let note;
  if (parts[3]) {
    if (version.texts.some(t => t.kind === parts[3])) kind = parts[3];
    else note = `${version.label} has no ${parts[3]} text; showing ${version.texts[0].kind} instead.`;
  }
  return { version, kind, ref: m[2].trim(), ...(note ? { note } : {}) };
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
 * @returns {{spans: {scholion: string, start: number, end: number, version: string}[], unresolved: number}}
 *          `version` of a span is the version its relation names.
 */
export function commentarySpans(pairs, versionUrn, text) {
  const spans = [];
  let unresolved = 0;
  for (const p of pairs) {
    const m = /^(urn:cts:[^:]+:[^:]+:)(.*)$/.exec(p.target);
    if (!m || ctsVersionOf(m[1]) !== versionUrn) continue;
    const r = resolveRange(text, m[2], { allowBook: false });
    if ('error' in r) { unresolved++; continue; }
    spans.push({ scholion: p.scholion, start: r.start, end: r.end, version: versionUrn });
  }
  return { spans, unresolved };
}

/**
 * Like `commentarySpans`, but for scholia commenting on the same passages in
 * *any* version of the Iliad.  A scholion indexed to `1.1-1.3` of Venetus B
 * counts for 1.1, 1.2 and 1.3 of whichever text is shown.
 *
 * Each relation is resolved in the text of the version it names (a range
 * follows the order of that text, and may run through passages the shown text
 * lacks), and the passages found are then matched to the shown text by their
 * references.  Relations that cannot be resolved in their own version, or that
 * name a version with no text, are counted, not guessed at.  A relation whose
 * passages are all missing from the shown text is neither a span nor unresolved.
 * @param {{scholion: string, target: string}[]} pairs
 * @param {ReturnType<typeof iliadVersions>} versions
 * @param {Map<string, TextIndex>} textIndex
 * @param {TextIndex} shown  the text being displayed
 * @returns {{spans: {scholion: string, start: number, end: number, version: string}[], unresolved: number, relations: number}}
 *          `relations` is how many Iliad relations were considered (`unresolved` of them could not be resolved).
 */
export function commentarySpansAllVersions(pairs, versions, textIndex, shown) {
  /** @type {Map<string, TextIndex | null>} */
  const own = new Map(versions.map(v => [v.urn, v.texts.length ? (textIndex.get(v.texts[0].urn) ?? null) : null]));
  const spans = [];
  let unresolved = 0, relations = 0;
  for (const p of pairs) {
    const m = /^(urn:cts:[^:]+:[^:]+:)(.*)$/.exec(p.target);
    if (!m || !ILIAD_VERSION.test(ctsVersionOf(m[1]))) continue;      // not a passage of the Iliad
    relations++;
    const version = ctsVersionOf(m[1]);
    const vtext = own.get(version);
    if (!vtext) { unresolved++; continue; }
    const r = resolveRange(vtext, m[2], { allowBook: false });
    if ('error' in r) { unresolved++; continue; }
    // positions in the shown text of the passages the relation covers, as runs of neighbours
    let runStart = -1, runEnd = -1;
    for (let i = r.start; i <= r.end; i++) {
      const at = shown.pos.get(vtext.refs[i]);
      if (at === undefined) continue;
      if (runStart >= 0 && at === runEnd + 1) { runEnd = at; continue; }
      if (runStart >= 0) spans.push({ scholion: p.scholion, start: runStart, end: runEnd, version });
      runStart = runEnd = at;
    }
    if (runStart >= 0) spans.push({ scholion: p.scholion, start: runStart, end: runEnd, version });
  }
  return { spans, unresolved, relations };
}

/**
 * The passages of a range with the distinct scholia commenting on each, and
 * for each passage the same scholia grouped by the version of the Iliad their
 * relation names (`byVersion`: version URN to scholia; spans without a
 * version go under the empty string).
 * @param {TextIndex} text
 * @param {{start: number, end: number}} range
 * @param {{scholion: string, start: number, end: number, version?: string}[]} spans
 * @returns {{lines: {ref: string, text: string, scholia: string[], byVersion: Record<string, string[]>}[], scholiaTotal: number}}
 */
export function annotateRange(text, range, spans) {
  /** @type {Map<number, Set<string>>} */
  const perLine = new Map();
  /** @type {Map<number, Map<string, Set<string>>>} */
  const perLineVersion = new Map();
  const all = new Set();
  for (const sp of spans) {
    if (sp.end < range.start || sp.start > range.end) continue;
    const to = Math.min(sp.end, range.end);
    for (let i = Math.max(sp.start, range.start); i <= to; i++) {
      let s = perLine.get(i);
      if (!s) { s = new Set(); perLine.set(i, s); }
      s.add(sp.scholion);
      all.add(sp.scholion);
      let vs = perLineVersion.get(i);
      if (!vs) { vs = new Map(); perLineVersion.set(i, vs); }
      const key = sp.version ?? '';
      if (!vs.has(key)) vs.set(key, new Set());
      vs.get(key)?.add(sp.scholion);
    }
  }
  const lines = [];
  for (let i = range.start; i <= range.end; i++) {
    const byVersion = Object.fromEntries([...(perLineVersion.get(i) ?? [])].map(([v, set]) => [v, [...set]]));
    lines.push({ ref: text.refs[i], text: text.texts[i], scholia: [...(perLine.get(i) ?? [])], byVersion });
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
