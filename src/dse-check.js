// @ts-check
/**
 * Relational integrity of the DSE records (`passage|imageroi|surface`) of a
 * release.  Three questions, answered against the rest of the release:
 *
 *  1. Which text passages of the editions have no DSE record?
 *  2. Which DSE records name a text passage that is not in the editions?
 *  3. Which DSE records name an image that is not in the image catalog?
 *
 * Passages are compared at the level of the version: `…tlg0012.tlg001.msA:1.1`
 * stands for that line in whichever exemplar (diplomatic, normalized) holds it,
 * and a scholion `1.28` for its `1.28.lemma` and `1.28.comment`.  A subreference
 * (`1.1@word`) is ignored.  Pure functions; no DOM access.
 *
 * Convention for inlining (see scripts/build.js): imports are single-line.
 */
import { ctsVersionOf } from './hmt-release.js';
import { DSE_URN } from './dse.js';
import { imageCollections } from './images.js';

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
 * @property {{ref: string, text: string}[]} missing      Text passages no DSE record names, in text order.
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
 * @typedef {Object} DseCheck
 * @property {boolean} found        The release has the DSE relation set.
 * @property {number} records       DSE records in it.
 * @property {VersionCheck[]} versions   Every text version or DSE-referenced version, in order of first appearance.
 * @property {DseRecord[]} badPassages   Records whose passage is not a CTS URN of a version.
 * @property {ImageProblem[]} imageProblems
 * @property {number} imagesChecked       Distinct image URNs the records refer to.
 * @property {number} catalogImages       Images in the image catalog.
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
  rows.forEach((row, i) => {
    /** @type {DseRecord} */
    const rec = { passage: (row.passage ?? '').trim(), imageroi: (row.imageroi ?? '').trim(), surface: (row.surface ?? '').trim(), row: i + 1 };

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
        if (n.has(ref)) v.indexed++; else v.missing.push({ ref, text: shown?.get(ref) ?? '' });
      }
    }
  }

  return {
    found: !!set,
    records: rows.length,
    versions: [...versions.values()],
    badPassages,
    imageProblems: [...problems.values()],
    imagesChecked: images.size,
    catalogImages: catalogItems.size,
  };
}

/**
 * The report as CSV, one line per inconsistency:
 * `group,version,passage,image,surface,detail`.
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
  return lines.map(l => l.map(esc).join(',')).join('\n') + '\n';
}
