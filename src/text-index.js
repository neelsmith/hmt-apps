// @ts-check
/**
 * Shared lookup of CTS passage text in a release.  Used by several apps.
 * Convention for inlining (see scripts/build.js): imports are single-line.
 */
import { ctsVersionOf } from './hmt-release.js';

/**
 * Passages of one text (a version or exemplar), in the order of the release.
 * @typedef {Object} TextIndex
 * @property {string} urn                     Work-component URN, ending in ":".
 * @property {string[]} refs                  Passage references, in order.
 * @property {string[]} texts                 Passage text, parallel to `refs`.
 * @property {Map<string, number>} pos        Reference -> position in `refs`.
 */

/** Preferred order of exemplar kinds when listing the texts of a version. */
export const KIND_ORDER = ['normalized', 'diplomatic'];

/** Name of the exemplar in a work-component URN ("normalized"), or "edition" for a version. */
export function exemplarName(workUrn) {
  const parts = workUrn.split(':')[3].split('.');
  return parts.length > 3 ? parts.slice(3).join('.') : 'edition';
}

/**
 * Index every text in the release by work-component URN.  The order of
 * passages in the release is the order of the text (references like
 * `1.title` or `6.386del` do not sort numerically).
 * @param {import('./hmt-release.js').HmtRelease} release
 * @returns {Map<string, TextIndex>}
 */
export function buildTextIndex(release) {
  /** @type {Map<string, TextIndex>} */
  const map = new Map();
  for (const { urn, text } of release.ctsData()) {
    const m = /^(urn:cts:[^:]+:[^:]+:)(.*)$/.exec(urn);
    if (!m) continue;
    let t = map.get(m[1]);
    if (!t) { t = { urn: m[1], refs: [], texts: [], pos: new Map() }; map.set(m[1], t); }
    if (!t.pos.has(m[2])) t.pos.set(m[2], t.refs.length);
    t.refs.push(m[2]);
    t.texts.push(text);
  }
  return map;
}

/** @type {WeakMap<Map<string, TextIndex>, Map<string, {urn: string, kind: string}[]>>} */
const versionTexts = new WeakMap();

/**
 * The texts (exemplars, or the version itself) available for a version URN,
 * `normalized` first.
 * @param {Map<string, TextIndex>} textIndex
 * @param {string} versionUrn  e.g. `urn:cts:greekLit:tlg0012.tlg001.msA:`
 * @returns {{urn: string, kind: string}[]}
 */
export function textsOfVersion(textIndex, versionUrn) {
  let byVersion = versionTexts.get(textIndex);
  if (!byVersion) {
    byVersion = new Map();
    for (const key of textIndex.keys()) {
      const v = ctsVersionOf(key);
      if (!v) continue;
      const list = byVersion.get(v) ?? [];
      list.push({ urn: key, kind: exemplarName(key) });
      byVersion.set(v, list);
    }
    const rank = (/** @type {string} */ k) => KIND_ORDER.indexOf(k) + 1 || 99;
    for (const list of byVersion.values()) list.sort((a, b) => rank(a.kind) - rank(b.kind));
    versionTexts.set(textIndex, byVersion);
  }
  return byVersion.get(versionUrn) ?? [];
}

/**
 * Text of a passage, from the exemplar of the requested kind when the version
 * has one (otherwise the first available).  A passage with its own text gives
 * one part with an empty `part` name; a scholion, whose text is stored as
 * `<ref>.lemma` and `<ref>.comment`, gives those parts.  Nothing found gives
 * no parts.
 * @param {Map<string, TextIndex>} textIndex
 * @param {string} urn   Passage URN at version level, e.g. `urn:cts:greekLit:tlg0012.tlg001.msA:1.1`.
 * @param {string} kind  `diplomatic` or `normalized`.
 * @returns {{parts: {part: string, text: string}[]}}
 */
export function passageText(textIndex, urn, kind) {
  const m = /^(urn:cts:[^:]+:[^:]+:)(.*)$/.exec(urn);
  if (!m) return { parts: [] };
  const version = ctsVersionOf(m[1]);
  const texts = version ? textsOfVersion(textIndex, version) : [];
  const pick = texts.find(t => t.kind === kind) ?? texts[0];
  const t = pick ? textIndex.get(pick.urn) : undefined;
  if (!t) return { parts: [] };
  const direct = t.pos.get(m[2]);
  if (direct !== undefined) return { parts: [{ part: '', text: t.texts[direct] }] };
  /** @type {{part: string, text: string}[]} */
  const parts = [];
  for (const part of ['lemma', 'comment']) {
    const i = t.pos.get(m[2] + '.' + part);
    if (i !== undefined) parts.push({ part, text: t.texts[i] });
  }
  return { parts };
}
