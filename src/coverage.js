// @ts-check
/**
 * Logic for the coverage app: how much of each manuscript the HMT has edited, from the texts of
 * a release (lines of the Iliad by book) and from its DSE records (pages of each codex).
 * Pure functions; no DOM access.
 *
 * Convention for inlining (see scripts/build.js): imports are single-line.
 */
import { collectionOfObject } from './hmt-release.js';
import { iliadVersions, shortVersionLabel } from './iliad-scholia.js';
import { codices, indexRegionsBySurface } from './codices.js';

/** Books of the Iliad. */
export const BOOKS = 24;

/**
 * @typedef {Object} IliadCoverage
 * @property {string} urn      Version URN, e.g. `urn:cts:greekLit:tlg0012.tlg001.msA:`.
 * @property {string} label    Label from the catalogue.
 * @property {string} short    Label without the parenthesis, e.g. `Venetus A`.
 * @property {number[]} byBook Edited lines in books 1 to 24 (index 0 is book 1).
 * @property {number} total    Sum of `byBook`.
 * @property {number} titles   Book titles (`1.title`), not counted as lines.
 * @property {number} other    Passages that are neither a line of books 1-24 nor a title.
 */

/**
 * For every Iliad version with texts in the release, the lines that have text, by book.  A line is a
 * passage `book.line` (a letter or `del` after the line number is allowed) that has text in either
 * exemplar, diplomatic or normalized; titles are counted apart.
 * @param {import('./hmt-release.js').HmtRelease} release
 * @param {Map<string, import('./text-index.js').TextIndex>} textIndex
 * @returns {IliadCoverage[]}
 */
export function iliadLinesByBook(release, textIndex) {
  /** @type {IliadCoverage[]} */
  const out = [];
  for (const v of iliadVersions(release, textIndex)) {
    if (!v.texts.length) continue;
    const refs = new Set();
    for (const t of v.texts) {
      const ex = textIndex.get(t.urn);
      if (!ex) continue;
      ex.refs.forEach((ref, i) => { if ((ex.texts[i] ?? '').trim()) refs.add(ref); });
    }
    const byBook = new Array(BOOKS).fill(0);
    let titles = 0, other = 0;
    for (const ref of refs) {
      const m = /^(\d+)\.(.+)$/.exec(ref);
      if (!m) { other++; continue; }
      if (m[2] === 'title') { titles++; continue; }
      const book = Number(m[1]);
      if (book >= 1 && book <= BOOKS && /^\d+/.test(m[2])) byBook[book - 1]++; else other++;
    }
    out.push({ urn: v.urn, label: v.label, short: shortVersionLabel(v.label), byBook, total: byBook.reduce((a, b) => a + b, 0), titles, other });
  }
  return out;
}

/**
 * @typedef {Object} CodexCoverage
 * @property {string} urn
 * @property {string} label
 * @property {number} total      Pages of the codex in the release.
 * @property {number} pages      Distinct pages (surfaces) of the codex named in DSE records.
 * @property {number} percent    `pages` as a percentage of `total`, to one decimal place.
 * @property {number} records    DSE records on those pages.
 * @property {string[]} unlisted Pages named in DSE records that are not among the codex's pages.
 */

/**
 * For every codex of the release, the number of distinct pages that appear in DSE records, and the
 * share of the codex's pages that is.
 * @param {import('./hmt-release.js').HmtRelease} release
 * @returns {{codices: CodexCoverage[], found: boolean, rows: number, skipped: number, elsewhere: string[]}}
 *   `elsewhere` lists surfaces of the DSE records that belong to no codex; `skipped` counts records
 *   without a usable surface, passage or region.
 */
export function dsePagesByCodex(release) {
  const cs = codices(release);
  const { bySurface, rows, skipped, found } = indexRegionsBySurface(release);
  /** @type {Map<string, string[]>} */
  const surfacesOf = new Map();
  /** @type {string[]} */
  const elsewhere = [];
  const known = new Set(cs.map(c => c.urn));
  for (const s of bySurface.keys()) {
    const coll = collectionOfObject(s) ?? '';
    if (!known.has(coll)) { elsewhere.push(s); continue; }
    const list = surfacesOf.get(coll) ?? [];
    list.push(s);
    surfacesOf.set(coll, list);
  }
  return {
    found, rows, skipped, elsewhere,
    codices: cs.map(c => {
      const surfaces = surfacesOf.get(c.urn) ?? [];
      const listed = new Set(c.pages.map(p => p.urn));
      const total = c.pages.length;
      return {
        urn: c.urn, label: c.label, total, pages: surfaces.length,
        percent: total ? Math.round((1000 * surfaces.length) / total) / 10 : 0,
        records: surfaces.reduce((n, s) => n + (bySurface.get(s)?.length ?? 0), 0),
        unlisted: surfaces.filter(s => !listed.has(s)),
      };
    }),
  };
}
