// @ts-check
/**
 * Digital scholarly edition (DSE) index: the relation set that links text
 * passages to regions of interest (ROI) on manuscript images.
 * No DOM access.
 */
import { ctsVersionOf } from './hmt-release.js';

/** Relation set linking passages, image regions, and manuscript surfaces. */
export const DSE_URN = 'urn:cite2:hmt:hmtdse.v1:all';

/**
 * @typedef {Object} Roi
 * @property {number} x  Left edge, as a fraction (0–1) of the image width.
 * @property {number} y  Top edge, as a fraction of the image height.
 * @property {number} w  Width, as a fraction of the image width.
 * @property {number} h  Height, as a fraction of the image height.
 */

/**
 * Parse `x,y,w,h` (fractions of the image size).  Whitespace around values
 * is tolerated.  Returns null if there are not four numbers, or the region is
 * empty or lies outside the image.  A region that sticks out past the right or
 * bottom edge by up to 0.02 of the image size (rounding in the source data,
 * e.g. x+w = 1.004) is clipped to the image.
 * @param {string} text
 * @returns {Roi | null}
 */
export function parseRoi(text) {
  const parts = text.split(',').map(s => s.trim());
  if (parts.length !== 4 || parts.some(p => !/^[+-]?(\d+\.?\d*|\.\d+)$/.test(p))) return null;
  const [x, y, w, h] = parts.map(Number);
  const eps = 0.02;
  if (x < 0 || y < 0 || !(w > 0) || !(h > 0) || x + w > 1 + eps || y + h > 1 + eps) return null;
  return { x, y, w: Math.min(w, 1 - x), h: Math.min(h, 1 - y) };
}

/**
 * Split an `imageroi` value such as
 * `urn:cite2:hmt:vaimg.2017a:VA012RN_0013@0.0611,0.2252,0.4675,0.0901`.
 * @param {string} value
 * @returns {{image: string, roi: Roi} | null}  Null if there is no usable region.
 */
export function parseImageRoi(value) {
  const at = value.indexOf('@');
  if (at < 0) return null;
  const roi = parseRoi(value.slice(at + 1));
  const image = value.slice(0, at).trim();
  return roi && image ? { image, roi } : null;
}

/**
 * Regions of the DSE relation set, grouped by image.
 * @param {import('./hmt-release.js').HmtRelease} release
 * @returns {{byImage: Map<string, {passage: string, roi: Roi}[]>, byPassage: Map<string, string[]>, rows: number, skipped: number, found: boolean}}
 *   `byPassage` maps a passage key (see `dseKey`) to the images it is indexed
 *   to, in index order, without repeats.  `skipped` counts rows without a
 *   usable region; `found` is false if the release has no such relation set.
 */
export function indexDse(release) {
  /** @type {Map<string, {passage: string, roi: Roi}[]>} */
  const byImage = new Map();
  /** @type {Map<string, string[]>} */
  const byPassage = new Map();
  const set = release.relationSets().find(r => r.urn === DSE_URN);
  if (!set) return { byImage, byPassage, rows: 0, skipped: 0, found: false };
  let skipped = 0;
  for (const row of set.rows) {
    const parsed = parseImageRoi(row.imageroi ?? '');
    if (!parsed || !row.passage) { skipped++; continue; }
    const list = byImage.get(parsed.image) ?? [];
    list.push({ passage: row.passage, roi: parsed.roi });
    byImage.set(parsed.image, list);
    const key = dseKey(row.passage);
    if (key) {
      const images = byPassage.get(key) ?? [];
      if (!images.includes(parsed.image)) images.push(parsed.image);
      byPassage.set(key, images);
    }
  }
  return { byImage, byPassage, rows: set.rows.length, skipped, found: true };
}

/** @typedef {'iliad' | 'scholia' | 'other'} PassageKind */

/**
 * Kind of text a passage belongs to: the Iliad (tlg0012.tlg001), scholia
 * (tlg5026), or anything else.
 * @param {string} urn
 * @returns {PassageKind}
 */
export function passageKind(urn) {
  const m = /^urn:cts:[^:]+:([^:.]+)\.([^:.]+)/.exec(urn);
  if (!m) return 'other';
  if (m[1] === 'tlg0012' && m[2] === 'tlg001') return 'iliad';
  if (m[1] === 'tlg5026') return 'scholia';
  return 'other';
}

const SCHOLIA_ZONES = {
  msA: 'main', msAint: 'interior', msAext: 'exterior', msAextra: 'extra',
  msAil: 'interlinear', msAim: 'intermarginal', msAimLater: 'later intermarginal', msAmeta: 'meta',
};

/**
 * Short label for a passage: `Iliad 5.506`, `Scholion 1.28 (interior)`,
 * otherwise the work title from the CTS catalog when known.
 * @param {string} urn
 * @param {Map<string, string>} [titles]  Version URN -> work title, from the CTS catalog.
 */
export function passageLabel(urn, titles) {
  const m = /^urn:cts:[^:]+:([^:]+):(.*)$/.exec(urn);
  if (!m) return urn;
  const kind = passageKind(urn);
  if (kind === 'iliad') return `Iliad ${m[2]}`;
  if (kind === 'scholia') {
    const zone = /** @type {Record<string, string>} */ (SCHOLIA_ZONES)[m[1].split('.')[1]];
    return `Scholion ${m[2]}${zone ? ` (${zone})` : ''}`;
  }
  const version = `urn:cts:${urn.split(':')[2]}:${m[1].split('.').slice(0, 3).join('.')}:`;
  return `${titles?.get(version) ?? m[1]} ${m[2]}`;
}

/**
 * Work titles by version URN, from the CTS catalog.
 * @param {import('./hmt-release.js').HmtRelease} release
 * @returns {Map<string, string>}
 */
export function catalogTitles(release) {
  return new Map(release.ctsCatalog().map(c => [c.urn, c.workTitle]));
}

/**
 * Key for comparing a passage URN with the passages of the DSE: the
 * version-level URN with the reference appended, so an exemplar part
 * (`.diplomatic`, `.normalized`) and a subreference (`@word`) are ignored, as
 * are the `.lemma` / `.comment` parts of a scholion.
 * `urn:cts:greekLit:tlg0012.tlg001.msA.normalized:1.1` gives
 * `urn:cts:greekLit:tlg0012.tlg001.msA:1.1`.
 * @param {string} urn
 * @returns {string | null}  Null if this is not a CTS passage URN.
 */
export function dseKey(urn) {
  const m = /^(urn:cts:[^:]+:[^:]+:)(.+)$/.exec(urn.trim());
  if (!m) return null;
  const version = ctsVersionOf(m[1]);
  if (!version) return null;
  let ref = m[2].replace(/@.*$/, '');
  if (/^urn:cts:[^:]+:tlg5026\./.test(version)) ref = ref.replace(/\.(lemma|comment)$/, '');
  return ref ? version + ref : null;
}
