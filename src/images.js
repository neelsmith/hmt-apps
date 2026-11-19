// @ts-check
/**
 * Logic for the images app: the image collections of a release, their items,
 * where the pictures are served, paging, and the location hash.
 * Pure functions; no DOM access.
 *
 * Convention for inlining (see scripts/build.js): imports are single-line.
 */
import { collectionOfObject, isCollectionUrn } from './hmt-release.js';

/** Data model of image collections. */
export const IMAGE_MODEL = 'urn:cite2:cite:datamodels.v1:imagemodel';

/**
 * Base of the HMT IIIF image server.  The release lists images by CITE2 URN
 * only, so their location follows the server's convention:
 * `urn:cite2:hmt:vaimg.2017a:VA012RN_0013` is the image
 * `<base>hmt/vaimg/2017a/VA012RN_0013.tif`.  (Verified for the `hmt` namespace
 * from the Venetus A manifest; the other namespaces assume the same layout.)
 */
export const IMAGE_SERVICE_BASE =
  'http://www.homermultitext.org/iipsrv?IIIF=/project/homer/pyramidal/deepzoom/';

/**
 * @typedef {Object} ImageItem
 * @property {string} urn      Image URN.
 * @property {string} id       Object part of the URN, e.g. `VA012RN_0013`.
 * @property {string} caption
 * @property {string} rights
 * @property {string} label    Short label for a grid cell, e.g. `folio 12, recto`.
 */

/**
 * @typedef {Object} ImageCollection
 * @property {string} urn      Collection URN, e.g. `urn:cite2:hmt:vaimg.2017a:`.
 * @property {string} label
 * @property {string} license
 * @property {ImageItem[]} items  In the order of the release.
 */

/**
 * Short label for an image: the part of its caption that says which page it
 * is (`folio 12, recto`, `front cover`, `page 7`), else the whole caption's
 * tail, else the id.
 * @param {string} caption
 * @param {string} id
 */
export function cellLabel(caption, id) {
  const m = /\b(?:bifolio|folio|page|front|inside|back|rear|spine|cover|fly)\b.*$/i.exec(caption);
  const s = (m ? m[0] : '').replace(/[\s.]+$/, '').trim();
  return s && s.length <= 48 ? s : id;
}

/**
 * Every collection documented in `datamodels` as following the image model,
 * with its items, ordered by label.
 * @param {import('./hmt-release.js').HmtRelease} release
 * @returns {ImageCollection[]}
 */
export function imageCollections(release) {
  const wanted = new Set(release.dataModels().filter(m => m.model === IMAGE_MODEL).map(m => m.collection));
  const info = new Map(release.collections().map(c => [c.urn, c]));
  /** @type {Map<string, ImageCollection>} */
  const out = new Map();
  for (const urn of wanted) {
    const c = info.get(urn);
    out.set(urn, { urn, label: c?.description || urn, license: c?.license || '', items: [] });
  }
  for (const block of release.citeData()) {
    const urnField = block.header.find(h => h.toLowerCase() === 'urn');
    if (!urnField || !block.collections.some(c => wanted.has(c))) continue;
    for (const row of block.rows) {
      const urn = row[urnField];
      const coll = out.get(collectionOfObject(urn) ?? '');
      if (!coll) continue;
      const id = urn.slice(urn.lastIndexOf(':') + 1);
      const caption = row.caption ?? '';
      coll.items.push({ urn, id, caption, rights: row.rights ?? '', label: cellLabel(caption, id) });
    }
  }
  return [...out.values()].sort((a, b) => a.label.localeCompare(b.label, 'en'));
}

/**
 * IIIF Image API base URL of an image.
 * @param {string} imageUrn  e.g. `urn:cite2:hmt:vaimg.2017a:VA012RN_0013`
 * @param {string} [base]
 * @returns {string | null}
 */
export function imageService(imageUrn, base = IMAGE_SERVICE_BASE) {
  const m = /^urn:cite2:([^:]+):([^:.]+)\.([^:]+):([^:]+)$/.exec(imageUrn);
  return m ? `${base}${m[1]}/${m[2]}/${m[3]}/${m[4]}.tif` : null;
}

/**
 * Width and height from an IIIF Image API `info.json` (any version).
 * @param {any} info
 * @returns {{width: number, height: number} | null}
 */
export function parseInfo(info) {
  const width = Number(info?.width), height = Number(info?.height);
  return width > 0 && height > 0 ? { width, height } : null;
}

/**
 * One page of a list.  Out-of-range pages are clamped.
 * @param {number} total
 * @param {number} pageSize
 * @param {number} page  1-based
 * @returns {{page: number, pages: number, start: number, end: number}}  `start`..`end` is a half-open index range.
 */
export function paginate(total, pageSize, page) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const p = Math.min(Math.max(1, Math.floor(page) || 1), pages);
  const start = (p - 1) * pageSize;
  return { page: p, pages, start, end: Math.min(total, start + pageSize) };
}

/**
 * Location hash for a collection page or one image.
 * @param {{urn: string, page?: number}} where
 */
export function formatHash(where) {
  const page = where.page && where.page > 1 && isCollectionUrn(where.urn) ? `&page=${where.page}` : '';
  return `#urn=${encodeURIComponent(where.urn)}${page}`;
}

/**
 * Read a location hash written by `formatHash`.
 * @param {string} hash
 * @returns {{urn: string, page: number} | null}
 */
export function parseHash(hash) {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const urn = params.get('urn');
  if (!urn || !/^urn:cite2:/.test(urn)) return null;
  const page = parseInt(params.get('page') ?? '', 10);
  return { urn, page: page >= 1 ? page : 1 };
}
