// @ts-check
/**
 * Scholia of the editions that no DSE record names, grouped by the book of the *Iliad* they comment on.
 *
 * The scholia without a DSE record are those `checkDse` finds missing in a scholia version (`tlg5026.<ms>.<hmt>`);
 * the book comes from the index of scholia to *Iliad* passages (the commentary model, see `commentaryPairs`), not from
 * the scholion's own number: a scholion commenting on 1.62 is under book 1 whatever it is called.  A scholion that
 * comments on passages of several books is listed under each; one the index does not place (no entry, or only an
 * entry like `13.UNKNOWN`) is under book 0, "no book".  Pure functions; no DOM access.
 *
 * Convention for inlining (see scripts/build.js): imports are single-line.
 */
import { ctsVersionOf } from './hmt-release.js';
import { checkDse } from './dse-check.js';
import { commentaryPairs } from './iliad-scholia.js';
import { DSE_URN, dseKey, passageKind } from './dse.js';
import { codices } from './codices.js';

/** Books of the *Iliad*. */
export const SCH_BOOKS = 24;

const SCH_VERSION = /^urn:cts:[^:]+:tlg5026\.[^.:]+\.[^.:]+:$/;
const SCH_SPLIT = /^(urn:cts:[^:]+:[^:]+:)(.*)$/;

/**
 * @typedef {Object} MissingScholion
 * @property {string} version   Version URN of the scholia, e.g. `urn:cts:greekLit:tlg5026.msA.hmt:`.
 * @property {string} label     Label of that version.
 * @property {string} ref       Reference of the scholion, e.g. `1.27` (lemma and comment are one scholion).
 * @property {string} urn       `version` + `ref`.
 * @property {string[]} comments  The *Iliad* passages it comments on, as the index gives them (references only, e.g. `1.8`).
 * @property {string[]} targets   The same passages with their edition (`urn:cts:greekLit:tlg0012.tlg001.msA:1.8`), to match DSE records.
 * @property {string} text      The text shown first.
 * @property {{exemplar: string, text: string}[]} texts   The text of every exemplar.
 */

/**
 * @typedef {Object} ScholiaBook
 * @property {number} book      1 to 24, or 0 for scholia the index does not place in a book.
 * @property {MissingScholion[]} scholia   In the order of the editions (by version, then text order).
 */

/**
 * @typedef {Object} ScholiaCheck
 * @property {boolean} dse        The release has the DSE relation set.
 * @property {boolean} commentary The release has a commentary index.
 * @property {number} versions    Scholia versions in the editions.
 * @property {number} passages    Scholia in those versions.
 * @property {number} missing     Scholia no DSE record names.
 * @property {ScholiaBook[]} books  Book 1 to 24, then book 0 if any scholion has none; every book is there, empty or not.
 */

/**
 * Book (1 to 24) of an *Iliad* passage reference such as `13.4`, or 0 if it names none.  `13.UNKNOWN` is in book 13;
 * `UNKNOWN` and `25.1` are in none.
 * @param {string} ref
 */
export function bookOfRef(ref) {
  const m = /^(\d+)\./.exec(ref.trim());
  const n = m ? Number(m[1]) : 0;
  return n >= 1 && n <= SCH_BOOKS ? n : 0;
}

/**
 * The scholia of the editions with no DSE record, with the *Iliad* passages each comments on.
 * @param {import('./hmt-release.js').HmtRelease} release
 */
function missingScholia(release) {
  const check = checkDse(release);
  const pairs = commentaryPairs(release);

  /** @type {Map<string, string[]>} scholion URN (version + ref) to the *Iliad* references it comments on */
  const commentsOn = new Map();
  /** @type {Map<string, string[]>} the same, with the edition of the *Iliad* */
  const targetsOf = new Map();
  for (const p of pairs) {
    const s = SCH_SPLIT.exec(p.scholion.replace(/@.*$/, ''));
    const t = SCH_SPLIT.exec(p.target.replace(/@.*$/, ''));
    if (!s || !t) continue;
    const version = ctsVersionOf(s[1]);
    if (!version) continue;
    const key = version + s[2].replace(/\.(lemma|comment)$/, '');
    const list = commentsOn.get(key) ?? [];
    if (!list.includes(t[2])) list.push(t[2]);
    commentsOn.set(key, list);
    const tv = ctsVersionOf(t[1]);
    const full = targetsOf.get(key) ?? [];
    if (tv && !full.includes(tv + t[2])) full.push(tv + t[2]);
    targetsOf.set(key, full);
  }

  /** @type {MissingScholion[]} */
  const list = [];
  let versions = 0, passages = 0;
  for (const v of check.versions) {
    if (!SCH_VERSION.test(v.version) || !v.hasText) continue;
    versions++;
    passages += v.passages;
    for (const m of v.missing) {
      const urn = v.version + m.ref;
      list.push({ version: v.version, label: v.label, ref: m.ref, urn, comments: commentsOn.get(urn) ?? [], targets: targetsOf.get(urn) ?? [], text: m.text, texts: m.texts });
    }
  }
  return { dse: check.found, commentary: pairs.length > 0, versions, passages, list };
}

/**
 * @param {import('./hmt-release.js').HmtRelease} release
 * @returns {ScholiaCheck}
 */
export function scholiaMissingByBook(release) {
  const found = missingScholia(release);

  /** @type {ScholiaBook[]} */
  const books = Array.from({ length: SCH_BOOKS + 1 }, (_, i) => ({ book: i === SCH_BOOKS ? 0 : i + 1, scholia: [] }));
  const slot = (/** @type {number} */ b) => books[b === 0 ? SCH_BOOKS : b - 1];
  for (const s of found.list) {
    const inBooks = [...new Set(s.comments.map(bookOfRef).filter(b => b > 0))];
    for (const b of inBooks.length ? inBooks : [0]) slot(b).scholia.push(s);
  }
  if (!books[SCH_BOOKS].scholia.length) books.pop();
  return { dse: found.dse, commentary: found.commentary, versions: found.versions, passages: found.passages, missing: found.list.length, books };
}

/**
 * @typedef {Object} ScholiaPage
 * @property {string} page    Surface URN, e.g. `urn:cite2:hmt:msA.v1:12r`; "" for scholia whose *Iliad* line has no DSE record.
 * @property {string} label   Short label, e.g. `folio 12, recto`; "no page" for "".
 * @property {MissingScholion[]} scholia
 */

/**
 * @typedef {Object} ScholiaPageCheck
 * @property {boolean} dse
 * @property {boolean} commentary
 * @property {number} versions
 * @property {number} passages
 * @property {number} missing     Scholia no DSE record names.
 * @property {number} iliadLines  *Iliad* lines the DSE places on a page.
 * @property {ScholiaPage[]} pages  Only pages that have such scholia, in codex order; then the "no page" entry if any.
 */

/**
 * The scholia no DSE record names, grouped by the manuscript page of the *Iliad* line each comments on.  The page of a
 * line is the surface of the DSE record for that line, in the same edition of the *Iliad* as the index names.  A scholion on lines of several pages is listed under each; a scholion none of
 * whose lines has a DSE record is under the entry with `page` "".
 * @param {import('./hmt-release.js').HmtRelease} release
 * @returns {ScholiaPageCheck}
 */
export function scholiaMissingByPage(release) {
  const found = missingScholia(release);

  /** @type {Map<string, Set<string>>} Iliad passage key (edition + reference) to surfaces */
  const surfaces = new Map();
  const add = (/** @type {string} */ k, /** @type {string} */ surface) => {
    const set = surfaces.get(k) ?? new Set();
    set.add(surface);
    surfaces.set(k, set);
  };
  const set = release.relationSets().find(r => r.urn === DSE_URN);
  for (const row of set?.rows ?? []) {
    const surface = (row.surface ?? '').trim();
    if (!surface || !row.passage || passageKind(row.passage) !== 'iliad') continue;
    const key = dseKey(row.passage);
    if (!key) continue;
    add(key, surface);
  }

  /** Surfaces of an Iliad passage such as `...msA:1.62` or `...msA:1.5-1.7` (both ends of a range). @param {string} target */
  const pagesOf = target => {
    const out = new Set();
    const m = /^(urn:cts:[^:]+:[^:]+:)(.*)$/.exec(target);
    if (!m) return out;
    for (const end of m[2].split(/[-‐-―]/)) {
      for (const s of surfaces.get(m[1] + end.trim()) ?? []) out.add(s);
    }
    return out;
  };

  // codex order of the pages, and their labels
  /** @type {Map<string, {order: number, label: string}>} */
  const known = new Map();
  let order = 0;
  for (const codex of codices(release)) for (const p of codex.pages) known.set(p.urn, { order: order++, label: p.short });
  const labelOf = (/** @type {string} */ urn) => known.get(urn)?.label ?? urn.slice(urn.lastIndexOf(':') + 1);

  /** @type {Map<string, MissingScholion[]>} */
  const byPage = new Map();
  for (const s of found.list) {
    const pages = new Set();
    for (const c of s.targets) for (const p of pagesOf(c)) pages.add(p);
    for (const p of pages.size ? pages : new Set([''])) {
      const list = byPage.get(p) ?? [];
      list.push(s);
      byPage.set(p, list);
    }
  }
  const urns = [...byPage.keys()].filter(Boolean).sort((a, b) => {
    const x = known.get(a)?.order ?? Infinity, y = known.get(b)?.order ?? Infinity;
    return x === y ? a.localeCompare(b, 'en', { numeric: true }) : x - y;
  });
  if (byPage.has('')) urns.push('');
  const iliadLines = surfaces.size;
  return {
    dse: found.dse, commentary: found.commentary, versions: found.versions, passages: found.passages,
    missing: found.list.length, iliadLines,
    pages: urns.map(u => ({ page: u, label: u ? labelOf(u) : 'no page', scholia: /** @type {MissingScholion[]} */ (byPage.get(u)) })),
  };
}
