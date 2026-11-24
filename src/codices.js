// @ts-check
/**
 * Logic for the codices app: the codices (manuscripts) of a release, their
 * pages, and for each page the image and indexed text regions given by the
 * DSE records.  Pure functions; no DOM access.
 *
 * Convention for inlining (see scripts/build.js): imports are single-line.
 */
import { collectionOfObject } from './hmt-release.js';
import { DSE_URN, parseImageRoi } from './dse.js';
import { cellLabel } from './images.js';
import { formatQuery, readParams } from './location.js';

/** Data model of codices (collections of pages). */
export const CODEX_MODEL = 'urn:cite2:hmt:datamodels.v1:codexmodel';

/**
 * @typedef {Object} CodexPage
 * @property {string} urn       Page (surface) URN, e.g. `urn:cite2:hmt:msA.v1:12r`.
 * @property {string} id        Object part of the URN, e.g. `12r`.
 * @property {string} label     Label from the release.
 * @property {string} short     Short label for a menu, e.g. `folio 12, recto`.
 * @property {number} sequence  Position in the codex (the release's `sequence`), else order of appearance.
 * @property {string} image     Image URN the catalog gives for the page, or "".
 */

/**
 * @typedef {Object} Codex
 * @property {string} urn      Collection URN, e.g. `urn:cite2:hmt:msA.v1:`.
 * @property {string} label
 * @property {CodexPage[]} pages  In codex order.
 */

/**
 * Every collection documented as following the codex model, with its pages,
 * ordered by label.
 * @param {import('./hmt-release.js').HmtRelease} release
 * @returns {Codex[]}
 */
export function codices(release) {
  const wanted = new Set(release.dataModels().filter(m => m.model === CODEX_MODEL).map(m => m.collection));
  const info = new Map(release.collections().map(c => [c.urn, c]));
  /** @type {Map<string, Codex>} */
  const out = new Map();
  for (const urn of wanted) out.set(urn, { urn, label: info.get(urn)?.description || urn, pages: [] });
  for (const block of release.citeData()) {
    const urnField = block.header.find(h => h.toLowerCase() === 'urn');
    if (!urnField || !block.collections.some(c => wanted.has(c))) continue;
    for (const row of block.rows) {
      const urn = row[urnField];
      const codex = out.get(collectionOfObject(urn) ?? '');
      if (!codex) continue;
      const id = urn.slice(urn.lastIndexOf(':') + 1);
      const label = row.label ?? '';
      const seq = parseFloat(row.sequence ?? '');
      codex.pages.push({
        urn, id, label, short: cellLabel(label, id),
        sequence: Number.isFinite(seq) ? seq : codex.pages.length,
        image: (row.image ?? '').trim(),
      });
    }
  }
  for (const c of out.values()) c.pages.sort((a, b) => a.sequence - b.sequence);   // stable: ties keep release order
  return [...out.values()].sort((a, b) => a.label.localeCompare(b.label, 'en'));
}

/**
 * @typedef {Object} PageRegion
 * @property {string} passage  Passage URN as in the DSE record.
 * @property {string} image    Image URN of the record.
 * @property {import('./dse.js').Roi} roi
 */

/**
 * Indexed regions of the DSE records, by surface (page) URN.
 * @param {import('./hmt-release.js').HmtRelease} release
 * @returns {{bySurface: Map<string, PageRegion[]>, rows: number, skipped: number, found: boolean}}
 *   `skipped` counts records without a usable surface, passage or region.
 */
export function indexRegionsBySurface(release) {
  /** @type {Map<string, PageRegion[]>} */
  const bySurface = new Map();
  const set = release.relationSets().find(r => r.urn === DSE_URN);
  if (!set) return { bySurface, rows: 0, skipped: 0, found: false };
  let skipped = 0;
  for (const row of set.rows) {
    const parsed = parseImageRoi(row.imageroi ?? '');
    const surface = (row.surface ?? '').trim();
    const passage = (row.passage ?? '').trim();
    if (!parsed || !surface || !passage) { skipped++; continue; }
    const list = bySurface.get(surface) ?? [];
    list.push({ passage, image: parsed.image, roi: parsed.roi });
    bySurface.set(surface, list);
  }
  return { bySurface, rows: set.rows.length, skipped, found: true };
}

/**
 * What to show for a page: the image of its DSE records and the regions on it.
 * The DSE records decide the image: the one they name most often among the
 * images of the catalog (a record may carry a different image from the
 * catalog's page image, e.g. another scan).  Without usable records the
 * catalog's image for the page is shown, without regions.
 * @param {CodexPage} page
 * @param {PageRegion[]} regions        DSE regions of the page
 * @param {Set<string>} catalogImages   Image URNs of the image catalog
 * @returns {{image: string, regions: PageRegion[], elsewhere: number, source: 'dse' | 'catalog' | 'none'}}
 *   `elsewhere` counts regions on other images, which are not shown.
 */
export function pageView(page, regions, catalogImages) {
  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const r of regions) if (catalogImages.has(r.image)) counts.set(r.image, (counts.get(r.image) ?? 0) + 1);
  let best = '';
  for (const [image, n] of counts) if (n > (counts.get(best) ?? 0)) best = image;
  if (best) {
    const shown = regions.filter(r => r.image === best);
    return { image: best, regions: shown, elsewhere: regions.length - shown.length, source: 'dse' };
  }
  return { image: page.image, regions: [], elsewhere: regions.length, source: page.image ? 'catalog' : 'none' };
}

/**
 * Query string that opens a page (`?page=urn:cite2:hmt:msA.v1:12r`), and its reading.
 * @param {string} pageUrn
 */
export const formatPageQuery = pageUrn => formatQuery({ page: pageUrn });

/** @param {string} search  e.g. `location.search` @returns {string | null} */
export function parsePageQuery(search) {
  const { page } = readParams(search, ['page']);
  return page && /^urn:cite2:/.test(page) ? page : null;
}

/**
 * The page before and after each page, within its codex (in codex order).
 * @param {Codex[]} list
 * @returns {Map<string, {prev: string | null, next: string | null}>}
 */
export function pageNeighbours(list) {
  /** @type {Map<string, {prev: string | null, next: string | null}>} */
  const out = new Map();
  for (const c of list) {
    c.pages.forEach((p, i) => out.set(p.urn, { prev: i > 0 ? c.pages[i - 1].urn : null, next: i + 1 < c.pages.length ? c.pages[i + 1].urn : null }));
  }
  return out;
}
