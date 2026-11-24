// @ts-check
/**
 * Logic for the coverage app: how much of each manuscript the HMT has edited, from the texts of
 * a release (lines of the Iliad by book) and from its DSE records (pages of each codex).
 * Pure functions; no DOM access.
 *
 * Convention for inlining (see scripts/build.js): imports are single-line.
 */
import { collectionOfObject, ctsVersionOf } from './hmt-release.js';
import { iliadVersions, shortVersionLabel } from './iliad-scholia.js';
import { codices, indexRegionsBySurface } from './codices.js';
import { dseKey } from './dse.js';

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
 * @typedef {Object} BookPages
 * @property {string} first   Id of the first page (in codex order) holding edited lines of the book, e.g. `12r`; "" if none.
 * @property {string} last    Id of the last such page; equals `first` for a single page.
 * @property {string} firstUrn
 * @property {string} lastUrn
 * @property {number} pages   Distinct pages holding edited lines of the book.
 * @property {number} span    Pages of the codex from first to last, inclusive (`pages` less than `span` means gaps).
 * @property {number} lines   Edited lines of the book.
 * @property {number} unplaced Edited lines with no DSE record on a page of the codex.
 */

/**
 * @typedef {Object} IliadPages
 * @property {string} urn      Version URN of the manuscript's Iliad text.
 * @property {string} label
 * @property {string} short
 * @property {string} codex    URN of the codex the pages belong to, or "" when no line is placed on a page.
 * @property {BookPages[]} byBook  Books 1 to 24 (index 0 is book 1).
 */

/**
 * For every manuscript with edited lines of the Iliad (see `iliadLinesByBook`), and every book, the range of its
 * codex pages that hold edited lines of that book.  A line is placed on the pages of the DSE records whose
 * passage is that line (exemplar parts are ignored); the range runs from the first to the last such page in codex
 * order.  The codex of a manuscript is the one holding most of its placed lines.
 * @param {import('./hmt-release.js').HmtRelease} release
 * @param {Map<string, import('./text-index.js').TextIndex>} textIndex
 * @returns {IliadPages[]}
 */
export function iliadPagesByBook(release, textIndex) {
  const { bySurface } = indexRegionsBySurface(release);
  /** @type {Map<string, Set<string>>} passage key -> surfaces */
  const surfacesOf = new Map();
  for (const [surface, regions] of bySurface) {
    for (const r of regions) {
      const k = dseKey(r.passage);
      if (!k) continue;
      const set = surfacesOf.get(k) ?? new Set();
      set.add(surface);
      surfacesOf.set(k, set);
    }
  }
  /** @type {Map<string, {id: string, seq: number, order: number}>} */
  const pageInfo = new Map();
  /** @type {Map<string, number>} */
  const codexSize = new Map();
  for (const c of codices(release)) {
    codexSize.set(c.urn, c.pages.length);
    c.pages.forEach((p, i) => pageInfo.set(p.urn, { id: p.id, seq: p.sequence, order: i }));
  }
  /** @type {IliadPages[]} */
  const out = [];
  for (const v of iliadVersions(release, textIndex)) {
    if (!v.texts.length) continue;
    const refs = new Set();
    for (const t of v.texts) {
      const ex = textIndex.get(t.urn);
      if (!ex) continue;
      ex.refs.forEach((ref, i) => { if ((ex.texts[i] ?? '').trim()) refs.add(ref); });
    }
    /** @type {Set<string>[]} */
    const pagesOfBook = Array.from({ length: BOOKS }, () => new Set());
    const lines = new Array(BOOKS).fill(0);
    const unplaced = new Array(BOOKS).fill(0);
    /** @type {Map<string, number>} */
    const codexVotes = new Map();
    for (const ref of refs) {
      const m = /^(\d+)\.(\d.*)$/.exec(ref);
      const book = m ? Number(m[1]) : 0;
      if (book < 1 || book > BOOKS) continue;
      lines[book - 1]++;
      const found = [...(surfacesOf.get(v.urn + ref) ?? [])].filter(s => pageInfo.has(s));
      if (!found.length) { unplaced[book - 1]++; continue; }
      for (const s of found) {
        pagesOfBook[book - 1].add(s);
        const c = collectionOfObject(s) ?? '';
        codexVotes.set(c, (codexVotes.get(c) ?? 0) + 1);
      }
    }
    if (!lines.some(n => n > 0)) continue;
    const codex = [...codexVotes].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
    const byBook = pagesOfBook.map((set, i) => {
      const own = [...set].filter(s => (collectionOfObject(s) ?? '') === codex)
        .sort((a, b) => /** @type {any} */ (pageInfo.get(a)).order - /** @type {any} */ (pageInfo.get(b)).order);
      const empty = { first: '', last: '', firstUrn: '', lastUrn: '', pages: 0, span: 0, lines: lines[i], unplaced: unplaced[i] };
      if (!own.length) return empty;
      const f = /** @type {any} */ (pageInfo.get(own[0])), l = /** @type {any} */ (pageInfo.get(own[own.length - 1]));
      return { ...empty, first: f.id, last: l.id, firstUrn: own[0], lastUrn: own[own.length - 1], pages: own.length, span: l.order - f.order + 1 };
    });
    out.push({ urn: v.urn, label: v.label, short: shortVersionLabel(v.label), codex, byBook });
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

/** Work identifier of the Iliadic scholia (`tlg5026`). */
const SCHOLIA_WORK = 'tlg5026';

/**
 * The manuscript a group of scholia belongs to: the Iliad version whose identifier begins the group's
 * own (`msAint` to `msA`; the longest such identifier wins).
 * @param {string} groupUrn  Version URN of the group of scholia, e.g. `urn:cts:greekLit:tlg5026.msAint.hmt:`.
 * @param {{urn: string, label: string}[]} iliad  Iliad versions (see `iliadVersions`).
 * @returns {{urn: string, label: string, short: string} | null}
 */
export function manuscriptOfScholia(groupUrn, iliad) {
  const id = /^urn:cts:[^:]+:tlg5026\.([^.:]+)/.exec(groupUrn)?.[1] ?? '';
  const idOf = (/** @type {string} */ u) => /\.([^.:]+):$/.exec(u)?.[1] ?? '';
  const ms = iliad.filter(i => idOf(i.urn) && id.startsWith(idOf(i.urn))).sort((a, b) => idOf(b.urn).length - idOf(a.urn).length)[0];
  return ms ? { urn: ms.urn, label: ms.label, short: shortVersionLabel(ms.label) } : null;
}

/**
 * @typedef {Object} ScholiaCoverage
 * @property {string} urn      URN of the manuscript's Iliad version.
 * @property {string} label
 * @property {string} short
 * @property {number[]} byBook Scholia in books 1 to 24 (index 0 is book 1), all groups of scholia together.
 * @property {number} total
 * @property {{urn: string, label: string, count: number}[]} groups  Each group of scholia (main, interior, …) with its count.
 */

/**
 * For every manuscript, the number of scholia by book, adding up all of its groups of scholia (for
 * example the main, interior, exterior, interlinear and intermarginal scholia of the Venetus A).  A
 * scholion is a `book.scholion` reference with text (lemma or comment) in either exemplar.  A group of
 * scholia belongs to the manuscript whose Iliad version identifier begins its own (`msAint` to `msA`,
 * the longest such identifier).
 * @param {import('./hmt-release.js').HmtRelease} release
 * @param {Map<string, import('./text-index.js').TextIndex>} textIndex
 * @returns {{manuscripts: ScholiaCoverage[], unassigned: string[]}}
 *   `unassigned` lists labels of groups of scholia that match no Iliad version.
 */
export function scholiaByBook(release, textIndex) {
  const iliad = iliadVersions(release, textIndex);
  const catalog = new Map(release.ctsCatalog().map(c => [c.urn, c.versionLabel]));
  /** @type {Map<string, Set<string>>} group version URN -> scholia ("book.scholion") with text */
  const groups = new Map();
  for (const [key, ex] of textIndex) {
    const v = ctsVersionOf(key);
    if (!v || !v.includes(`.${SCHOLIA_WORK}.`) && !v.includes(`:${SCHOLIA_WORK}.`)) continue;
    const set = groups.get(v) ?? new Set();
    ex.refs.forEach((ref, i) => {
      if (!(ex.texts[i] ?? '').trim()) return;
      const m = /^(\d+)\.([^.]+)(?:\.|$)/.exec(ref);
      if (m) set.add(`${m[1]}.${m[2]}`);
    });
    groups.set(v, set);
  }
  /** @type {Map<string, ScholiaCoverage>} */
  const byMs = new Map();
  /** @type {string[]} */
  const unassigned = [];
  for (const [v, set] of groups) {
    const ms = manuscriptOfScholia(v, iliad);
    const label = catalog.get(v) ?? v;
    if (!ms) { unassigned.push(label); continue; }
    let rec = byMs.get(ms.urn);
    if (!rec) {
      rec = { urn: ms.urn, label: ms.label, short: ms.short, byBook: new Array(BOOKS).fill(0), total: 0, groups: [] };
      byMs.set(ms.urn, rec);
    }
    let count = 0;
    for (const sch of set) {
      const book = Number(sch.split('.')[0]);
      if (book >= 1 && book <= BOOKS) { rec.byBook[book - 1]++; count++; }
    }
    rec.total += count;
    rec.groups.push({ urn: v, label, count });
  }
  const order = iliad.map(i => i.urn);
  return { manuscripts: [...byMs.values()].sort((a, b) => order.indexOf(a.urn) - order.indexOf(b.urn)), unassigned };
}
