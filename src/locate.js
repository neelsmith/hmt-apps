// @ts-check
/**
 * Finding one kind of location from another through the DSE records and the catalogs of a release:
 * the page of an image or of a passage, the image of a page or of a passage, and the passages on a page
 * or image.  Used by the apps that open at a text (`text`), a page (`page`) or an image (`image`).
 * Pure functions; no DOM access.
 *
 * Convention for inlining (see scripts/build.js): imports are single-line.
 */
import { DSE_URN, dseKey, firstPassageKey, parseImageRoi } from './dse.js';
import { codices, indexRegionsBySurface, pageView } from './codices.js';
import { imageCollections } from './images.js';

/**
 * @typedef {Object} Locator
 * @property {(page: string) => boolean} isPage            Is it a page of a codex of the release?
 * @property {(page: string) => string} imageOfPage        The image shown for a page ("" if none).
 * @property {(image: string) => string[]} pagesOfImage    Pages (surfaces) with that image.
 * @property {(text: string) => string[]} pagesOfPassage   Pages the DSE puts a passage (or the start of a range) on.
 * @property {(text: string) => string[]} imagesOfPassage  Images the DSE puts it on.
 * @property {(page: string) => string[]} passagesOnPage   Passages (DSE keys) on a page, in index order.
 * @property {(image: string) => string[]} passagesOnImage Passages (DSE keys) on an image, in index order.
 */

/**
 * Index a release for moving between texts, pages and images.
 * @param {import('./hmt-release.js').HmtRelease} release
 * @returns {Locator}
 */
export function createLocator(release) {
  /** @param {Map<string, string[]>} m @param {string} k @param {string} v */
  const add = (m, k, v) => { const l = m.get(k); if (!l) m.set(k, [v]); else if (!l.includes(v)) l.push(v); };
  /** @type {Map<string, string[]>} */ const pagesOfPassage = new Map();
  /** @type {Map<string, string[]>} */ const imagesOfPassage = new Map();
  /** @type {Map<string, string[]>} */ const passagesOnPage = new Map();
  /** @type {Map<string, string[]>} */ const passagesOnImage = new Map();
  /** @type {Map<string, string[]>} */ const pagesOfImage = new Map();
  const set = release.relationSets().find(r => r.urn === DSE_URN);
  for (const row of set?.rows ?? []) {
    const key = dseKey(row.passage ?? '');
    const surface = (row.surface ?? '').trim();
    const image = parseImageRoi(row.imageroi ?? '')?.image ?? '';
    if (!key) continue;
    if (surface) { add(pagesOfPassage, key, surface); add(passagesOnPage, surface, key); }
    if (image) { add(imagesOfPassage, key, image); add(passagesOnImage, image, key); }
    if (surface && image) add(pagesOfImage, image, surface);
  }

  const cs = codices(release);
  const { bySurface } = indexRegionsBySurface(release);
  const catalogImages = new Set(imageCollections(release).flatMap(c => c.items.map(i => i.urn)));
  /** @type {Map<string, string>} */ const imageOf = new Map();
  for (const c of cs) {
    for (const p of c.pages) {
      const image = pageView(p, bySurface.get(p.urn) ?? [], catalogImages).image || p.image;
      if (image) imageOf.set(p.urn, image);
      for (const im of new Set([image, p.image])) if (im) add(pagesOfImage, im, p.urn);
    }
  }
  const pages = new Set(cs.flatMap(c => c.pages.map(p => p.urn)));

  return {
    isPage: page => pages.has(page),
    imageOfPage: page => imageOf.get(page) ?? '',
    pagesOfImage: image => pagesOfImage.get(image) ?? [],
    pagesOfPassage: text => { const k = firstPassageKey(text); return (k && pagesOfPassage.get(k)) || []; },
    imagesOfPassage: text => { const k = firstPassageKey(text); return (k && imagesOfPassage.get(k)) || []; },
    passagesOnPage: page => passagesOnPage.get(page) ?? [],
    passagesOnImage: image => passagesOnImage.get(image) ?? [],
  };
}

/** @typedef {{text: string | null, page: string | null, image: string | null}} LocationParams */

/**
 * The page to open for the parameters of an address: `page` first, then `image`, then `text`
 * (the first of these that gives a page of the release wins).
 * @param {Locator} loc
 * @param {LocationParams} p
 * @returns {{page: string} | {error: string} | null}  Null if no parameter is given.
 */
export function resolvePage(loc, p) {
  if (p.page && loc.isPage(p.page)) return { page: p.page };
  const fromImage = p.image ? loc.pagesOfImage(p.image)[0] : '';
  if (fromImage) return { page: fromImage };
  const fromText = p.text ? loc.pagesOfPassage(p.text)[0] : '';
  if (fromText) return { page: fromText };
  const given = p.page || p.image || p.text;
  if (!given) return null;
  return { error: `No page of a codex in this release goes with ${given}.` };
}

/**
 * The image to open for the parameters of an address: `image` first (as it is; the caller checks it), then `page`,
 * then `text`.
 * @param {Locator} loc
 * @param {LocationParams} p
 * @returns {{image: string} | {error: string} | null}  Null if no parameter is given.
 */
export function resolveImage(loc, p) {
  if (p.image) return { image: p.image };
  const fromPage = p.page ? loc.imageOfPage(p.page) : '';
  if (fromPage) return { image: fromPage };
  const fromText = p.text ? loc.imagesOfPassage(p.text)[0] : '';
  if (fromText) return { image: fromText };
  const given = p.page || p.text;
  return given ? { error: `No image in this release goes with ${given}.` } : null;
}
