// @ts-check
/**
 * Relational integrity of the DSE records (`passage|imageroi|surface`) of a
 * release.  Three questions, answered against the rest of the release:
 *
 *  1. Which text passages of the editions have no DSE record?
 *  2. Which DSE records name a text passage that is not in the editions?
 *  3. Which DSE records name an image that is not in the image catalog?
 *  4. Which pages of each codex (manuscript) have no DSE record, as runs of consecutive pages?
 *
 * Passages are compared at the level of the version: `…tlg0012.tlg001.msA:1.1`
 * stands for that line in whichever exemplar (diplomatic, normalized) holds it,
 * and a scholion `1.28` for its `1.28.lemma` and `1.28.comment`.  A subreference
 * (`1.1@word`) is ignored.  Pure functions; no DOM access.
 *
 * Convention for inlining (see scripts/build.js): imports are single-line.
 */
import { ctsVersionOf } from './hmt-release.js';
import { DSE_URN, passageKind } from './dse.js';
import { imageCollections } from './images.js';
import { codices } from './codices.js';

/**
 * @typedef {Object} DseRecord
 * @property {string} passage   As written in the release.
 * @property {string} imageroi
 * @property {string} surface
 * @property {number} row       Position in the relation set, from 1.
 */

/**
 * @typedef {Object} VersionCheck
 * @property {string} version     Version URN, e.g. `urn:cts:greekLit:tlg0012.tlg001.msA:`.
 * @property {string} label
 * @property {boolean} hasText    The release has a text of this version.
 * @property {number} passages    Passages in the text (0 if no text).
 * @property {number} records     DSE records naming a passage of this version.
 * @property {number} indexed     Passages of the text that at least one DSE record names.
 * @property {{ref: string, text: string, texts: {exemplar: string, text: string}[]}[]} missing
 *     Text passages no DSE record names, in text order; `text` is the one shown first, `texts` every exemplar's text (`exemplar` is e.g. `diplomatic`, or "").
 * @property {(DseRecord & {ref: string})[]} unknown      DSE records for passages not in the text.
 */

/**
 * @typedef {Object} ImageProblem
 * @property {string} image     Image URN as referenced (without region); empty if the record has none.
 * @property {'item' | 'collection' | 'none'} kind
 *     `item`: its collection is an image collection but has no such image;
 *     `collection`: the collection is not an image collection of the release;
 *     `none`: the record has no image reference.
 * @property {string} collection   Collection URN of the reference, or "".
 * @property {DseRecord[]} records
 */

/**
 * @typedef {Object} PageRef
 * @property {string} urn
 * @property {string} id      Object id of the page URN, e.g. `12r`.
 * @property {string} label   Label of the page without the codex name, e.g. `folio 12, recto`.
 */

/**
 * @typedef {Object} PageRun   Consecutive pages of a codex that no DSE record names as its surface.
 * @property {PageRef} from
 * @property {PageRef} to
 * @property {number} count    Pages in the run, from `from` to `to` inclusive.
 */

/**
 * @typedef {Object} CodexCoverage
 * @property {string} urn         Collection URN of the codex.
 * @property {string} label
 * @property {number} pages       Pages in the codex model.
 * @property {number} covered     Pages named as the surface of at least one DSE record.
 * @property {number} uncovered   Pages no DSE record names (the sum of the runs).
 * @property {PageRun[]} runs     In codex order.
 */

/**
 * @typedef {Object} DseCheck
 * @property {boolean} found        The release has the DSE relation set.
 * @property {number} records       DSE records in it.
 * @property {VersionCheck[]} versions   Every text version or DSE-referenced version, in order of first appearance.
 * @property {DseRecord[]} badPassages   Records whose passage is not a CTS URN of a version.
 * @property {ImageProblem[]} imageProblems
 * @property {number} imagesChecked       Distinct image URNs the records refer to.
 * @property {number} catalogImages       Images in the image catalog.
 * @property {CodexCoverage[]} codices    Every codex of the release with at least one page.
 * @property {IliadProblemPages[]} iliadPages  Pages with DSE records for Iliad lines not in the text, by manuscript and book.
 */

/**
 * @typedef {Object} BookProblemPages
 * @property {number} records   DSE records for lines of this book that are not in the text.
 * @property {number} pages     Distinct pages those records name.
 * @property {string} text      The pages in codex order with consecutive pages joined, e.g. `12r–13v, 20r`; "" if none.
 * @property {{from: {id: string, urn: string}, to: {id: string, urn: string}}[]} parts  The same, one entry for each page or range (`to` is `from` for a single page).
 */

/**
 * @typedef {Object} IliadProblemPages
 * @property {string} version   Version URN of the Iliad.
 * @property {string} label
 * @property {BookProblemPages[]} byBook   Books 1 to 24 (index 0 is book 1).
 * @property {number} records   All records counted, including those of no book 1-24 (`other`).
 * @property {number} other     Records whose passage is not a line of books 1-24.
 */

/** Strip a subreference from a passage reference. */
const baseRef = (/** @type {string} */ ref) => ref.replace(/@.*$/, '').trim();

/**
 * Passage reference of a text node as DSE records name it: the `.lemma` and
 * `.comment` parts of a scholion belong to the scholion.
 * @param {string} work  work-component URN of the node, up to ":"
 * @param {string} ref
 */
function textPassageRef(work, ref) {
  return /^urn:cts:[^:]+:tlg5026\./.test(work) ? ref.replace(/\.(lemma|comment)$/, '') : ref;
}

/**
 * Check the DSE records of a release.
 * @param {import('./hmt-release.js').HmtRelease} release
 * @returns {DseCheck}
 */
export function checkDse(release) {
  const set = release.relationSets().find(r => r.urn === DSE_URN);
  const titles = new Map(release.ctsCatalog().map(c => [c.urn, `${c.workTitle} — ${c.versionLabel}`]));

  /** @type {Map<string, VersionCheck>} */
  const versions = new Map();
  /** @type {Map<string, Set<string>>} refs of the text, by version */
  const textRefs = new Map();
  /** @type {Map<string, Map<string, string>>} ref -> text for display, by version, from one exemplar only */
  const textOf = new Map();
  /** @type {Map<string, string>} the exemplar whose text is kept for display, by version */
  const shownExemplar = new Map();
  /** @type {Map<string, Map<string, Map<string, string>>>} ref -> exemplar -> text, by version, all exemplars */
  const allTexts = new Map();

  const versionFor = (/** @type {string} */ urn) => {
    let v = versions.get(urn);
    if (!v) {
      v = {
        version: urn, label: titles.get(urn) ?? urn.split(':')[3], hasText: false,
        passages: 0, records: 0, indexed: 0, missing: [], unknown: [],
      };
      versions.set(urn, v);
    }
    return v;
  };

  for (const { urn, text } of release.ctsData()) {
    const m = /^(urn:cts:[^:]+:[^:]+:)(.*)$/.exec(urn);
    if (!m) continue;
    const version = ctsVersionOf(m[1]);
    const ref = textPassageRef(m[1], m[2]);
    const v = versionFor(version);
    v.hasText = true;
    let refs = textRefs.get(version);
    if (!refs) { refs = new Set(); textRefs.set(version, refs); textOf.set(version, new Map()); }
    refs.add(ref);                                    // a passage is in the text if any exemplar has it
    const exemplar = m[1];
    {   // every exemplar's text, for display
      const work = exemplar.split(':')[3] ?? '', own = version.split(':')[3] ?? '';
      const name = work.length > own.length ? work.slice(own.length + 1) : '';
      let byRef = allTexts.get(version);
      if (!byRef) { byRef = new Map(); allTexts.set(version, byRef); }
      let byEx = byRef.get(ref);
      if (!byEx) { byEx = new Map(); byRef.set(ref, byEx); }
      byEx.set(name, byEx.has(name) ? `${byEx.get(name)} ${text}` : text);
    }
    if (!shownExemplar.has(version)) shownExemplar.set(version, exemplar);
    if (shownExemplar.get(version) === exemplar) {   // display text: one exemplar; lemma and comment read as one
      const t = /** @type {Map<string, string>} */ (textOf.get(version));
      t.set(ref, t.has(ref) ? `${t.get(ref)} ${text}` : text);
    }
  }
  for (const [version, refs] of textRefs) versionFor(version).passages = refs.size;

  /** @type {Map<string, Set<string>>} refs named by DSE records, by version */
  const named = new Map();
  /** @type {DseRecord[]} */ const badPassages = [];
  /** @type {Map<string, ImageProblem>} */ const problems = new Map();
  const images = new Set();
  const catalog = imageCollections(release);
  const catalogItems = new Set(catalog.flatMap(c => c.items.map(i => i.urn)));
  const catalogCollections = new Set(catalog.map(c => c.urn));

  const rows = set ? set.rows : [];
  /** @type {Set<string>} surfaces (pages) that at least one record names */
  const surfaces = new Set();
  rows.forEach((row, i) => {
    /** @type {DseRecord} */
    const rec = { passage: (row.passage ?? '').trim(), imageroi: (row.imageroi ?? '').trim(), surface: (row.surface ?? '').trim(), row: i + 1 };

    if (rec.surface) surfaces.add(rec.surface);

    // -- the passage
    const m = /^(urn:cts:[^:]+:[^:]+:)(.*)$/.exec(rec.passage);
    if (!m || !m[2]) {
      badPassages.push(rec);
    } else {
      const version = ctsVersionOf(m[1]);
      const ref = baseRef(m[2]);
      const v = versionFor(version);
      v.records++;
      let n = named.get(version);
      if (!n) { n = new Set(); named.set(version, n); }
      n.add(ref);
      if (!textRefs.get(version)?.has(ref)) v.unknown.push({ ...rec, ref });
    }

    // -- the image
    const at = rec.imageroi.indexOf('@');
    const image = (at < 0 ? rec.imageroi : rec.imageroi.slice(0, at)).trim();
    if (!image) {
      const p = problems.get('') ?? { image: '', kind: /** @type {'none'} */ ('none'), collection: '', records: [] };
      p.records.push(rec); problems.set('', p);
      return;
    }
    images.add(image);
    if (!catalogItems.has(image)) {
      let p = problems.get(image);
      if (!p) {
        const collection = image.slice(0, image.lastIndexOf(':') + 1);
        p = { image, kind: catalogCollections.has(collection) ? 'item' : 'collection', collection, records: [] };
        problems.set(image, p);
      }
      p.records.push(rec);
    }
  });

  for (const [version, v] of versions) {
    const n = named.get(version) ?? new Set();
    const refs = textRefs.get(version);
    if (refs) {
      const shown = textOf.get(version);
      for (const ref of refs) {
        if (n.has(ref)) v.indexed++; else v.missing.push({ ref, text: shown?.get(ref) ?? '', texts: [...(allTexts.get(version)?.get(ref) ?? [])].map(([exemplar, text]) => ({ exemplar, text })) });
      }
    }
  }

  return {
    found: !!set,
    codices: codexCoverage(release, surfaces),
    iliadPages: iliadProblemPages(release, [...versions.values()]),
    records: rows.length,
    versions: [...versions.values()],
    badPassages,
    imageProblems: [...problems.values()],
    imagesChecked: images.size,
    catalogImages: catalogItems.size,
  };
}

/**
 * For each Iliad version with DSE records whose passage is not in the text, the pages those records name, by book.
 * Pages are in codex order, consecutive pages joined into ranges; a page that is not in the codex's list follows, by its id.
 * @param {import('./hmt-release.js').HmtRelease} release
 * @param {VersionCheck[]} versions
 * @returns {IliadProblemPages[]}
 */
export function iliadProblemPages(release, versions) {
  /** @type {Map<string, {id: string, order: number, coll: string}>} */
  const info = new Map();
  for (const c of codices(release)) c.pages.forEach((p, i) => info.set(p.urn, { id: p.id, order: i, coll: c.urn }));
  /** @type {IliadProblemPages[]} */
  const out = [];
  for (const v of versions) {
    if (!v.unknown.length || passageKind(v.version) !== 'iliad') continue;
    /** @type {Map<number, {records: number, pages: Set<string>}>} */
    const books = new Map();
    let other = 0;
    for (const r of v.unknown) {
      const m = /^(\d+)\.\d/.exec(r.ref);
      const book = m ? Number(m[1]) : 0;
      if (book < 1 || book > ILIAD_BOOKS) { other++; continue; }
      const b = books.get(book) ?? { records: 0, pages: new Set() };
      b.records++;
      if (r.surface) b.pages.add(r.surface);
      books.set(book, b);
    }
    const byBook = Array.from({ length: ILIAD_BOOKS }, (_, i) => {
      const b = books.get(i + 1);
      return b ? { records: b.records, pages: b.pages.size, ...joinPages([...b.pages], info) } : { records: 0, pages: 0, text: '', parts: [] };
    });
    out.push({ version: v.version, label: v.label, byBook, records: v.unknown.length, other });
  }
  return out;
}

/** Books of the Iliad. */
const ILIAD_BOOKS = 24;

/**
 * Page URNs as text: pages of a codex in codex order, runs of consecutive pages as `12r–13v`; others last, in URN order.
 * @param {string[]} urns
 * @param {Map<string, {id: string, order: number, coll: string}>} info
 * @returns {{text: string, parts: BookProblemPages['parts']}}
 */
function joinPages(urns, info) {
  const known = urns.filter(u => info.has(u)).sort((a, b) => {
    const x = /** @type {any} */ (info.get(a)), y = /** @type {any} */ (info.get(b));
    return x.coll === y.coll ? x.order - y.order : x.coll.localeCompare(y.coll);
  });
  /** @type {BookProblemPages['parts']} */
  const parts = [];
  for (let i = 0; i < known.length;) {
    let j = i;
    const at = (/** @type {number} */ k) => /** @type {any} */ (info.get(known[k]));
    while (j + 1 < known.length && at(j + 1).coll === at(i).coll && at(j + 1).order === at(j).order + 1) j++;
    parts.push({ from: { id: at(i).id, urn: known[i] }, to: { id: at(j).id, urn: known[j] } });
    i = j + 1;
  }
  for (const u of urns.filter(u => !info.has(u)).sort()) {
    const x = { id: u.slice(u.lastIndexOf(':') + 1) || u, urn: u };
    parts.push({ from: x, to: x });
  }
  const text = parts.map(p => p.from.urn === p.to.urn ? p.from.id : `${p.from.id}–${p.to.id}`).join(', ');
  return { text, parts };
}

/**
 * For each codex of the release, the runs of consecutive pages (in codex order) that no DSE record names as its
 * surface.  A codex that no record mentions at all is one run from its first page to its last.
 * @param {import('./hmt-release.js').HmtRelease} release
 * @param {Set<string>} surfaces  Surfaces named by DSE records.
 * @returns {CodexCoverage[]}
 */
export function codexCoverage(release, surfaces) {
  /** @type {CodexCoverage[]} */
  const out = [];
  for (const codex of codices(release)) {
    if (!codex.pages.length) continue;
    /** @type {PageRun[]} */
    const runs = [];
    /** @type {PageRun | null} */
    let run = null;
    let covered = 0;
    for (const p of codex.pages) {
      if (surfaces.has(p.urn)) { covered++; run = null; continue; }
      /** @type {PageRef} */
      const ref = { urn: p.urn, id: p.id, label: p.short || p.id };
      if (run) { run.to = ref; run.count++; }
      else { run = { from: ref, to: ref, count: 1 }; runs.push(run); }
    }
    out.push({ urn: codex.urn, label: codex.label, pages: codex.pages.length, covered, uncovered: codex.pages.length - covered, runs });
  }
  return out;
}

/** A run of pages as text: `folio 12, recto`, or `folio 12, recto to folio 15, verso (6 pages)`. @param {PageRun} r */
export function describeRun(r) {
  return r.count === 1 ? r.from.label : `${r.from.label} to ${r.to.label} (${r.count} pages)`;
}

/**
 * The report as CSV, one line per inconsistency:
 * `group,version,passage,image,surface,detail` (for a codex page, `version` is the codex and `surface` its first page).
 * @param {DseCheck} check
 */
export function reportCsv(check) {
  const esc = (/** @type {string} */ s) => /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  const lines = [['group', 'version', 'passage', 'image', 'surface', 'detail']];
  for (const v of check.versions) {
    for (const m of v.missing) {
      lines.push(['text passage missing from DSE', v.label, `${v.version}${m.ref}`, '', '', v.records === 0 ? 'no DSE records for this text at all' : '']);
    }
  }
  for (const v of check.versions) {
    for (const r of v.unknown) {
      lines.push(['DSE record for text passage not in textual editions', v.label, r.passage, r.imageroi, r.surface,
        v.hasText ? `passage ${r.ref} is not in the text of this version` : 'the release has no text of this version']);
    }
  }
  for (const r of check.badPassages) {
    lines.push(['DSE record for text passage not in textual editions', '', r.passage, r.imageroi, r.surface, 'not a CTS passage URN']);
  }
  for (const p of check.imageProblems) {
    const detail = p.kind === 'item' ? `no such image in ${p.collection}`
      : p.kind === 'collection' ? `${p.collection} is not an image collection of this release` : 'record has no image reference';
    for (const r of p.records) lines.push(['reference to image not in catalog', '', r.passage, r.imageroi, r.surface, detail]);
  }
  for (const c of check.codices) {
    for (const r of c.runs) {
      lines.push(['codex page without DSE record', c.label, '', '', r.from.urn,
        `${describeRun(r)}${r.count > 1 ? `; last page ${r.to.urn}` : ''}${c.covered === 0 ? '; no DSE records for this codex at all' : ''}`]);
    }
  }
  return lines.map(l => l.map(esc).join(',')).join('\n') + '\n';
}
