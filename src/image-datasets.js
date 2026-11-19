// @ts-check
/**
 * Datasets derived from the image collections of a release: a IIIF
 * Presentation 3 manifest and a three-column CEX table (`image|urn|label`) per
 * collection.  Pure functions; the script scripts/make-image-datasets.js does
 * the reading, fetching and writing.
 */
import { imageService } from './images.js';

/** Width of the picture each canvas shows, as in the Venetus A manifest. */
export const PICTURE_WIDTH = 2000;

/**
 * @typedef {import('./images.js').ImageCollection} ImageCollection
 * @typedef {import('./images.js').ImageItem} ImageItem
 */

/**
 * File-name stem of a collection: `urn:cite2:hmt:vaimg.2017a:` gives `vaimg.2017a`.
 * @param {string} collectionUrn
 */
export function collectionKey(collectionUrn) {
  const m = /^urn:cite2:[^:]+:([^:]+):$/.exec(collectionUrn);
  if (!m) throw new Error(`not a collection URN: ${collectionUrn}`);
  return m[1];
}

/**
 * URL of the picture of an image (the one a manifest's painting annotation uses).
 * @param {string} service  IIIF Image API base URL.
 */
export function pictureUrl(service) {
  return `${service}/full/${PICTURE_WIDTH},/0/default.jpg`;
}

/** Readable label: the release's caption, tidied for a one-line table cell; the id if there is no caption. */
export function imageLabel(item) {
  const s = item.caption.replace(/[\r\n|]+/g, ' ').replace(/\s+/g, ' ').replace(/[\s.]+$/, '').trim();
  return s || item.id;
}

/**
 * The CEX table of a collection: a header line `image|urn|label`, then one line per image.
 * The `image` column is the image's IIIF Image API service id, the same value as the
 * manifest's `body.service[0].id` (no `/full/…` request, no `/info.json`), because that is
 * what software looks images up by.
 * @param {ImageCollection} collection
 * @param {(urn: string) => string | null} [serviceFor]
 * @returns {{text: string, rows: number, skipped: string[]}}  `skipped` lists images whose location could not be worked out.
 */
export function buildCex(collection, serviceFor = imageService) {
  const lines = ['image|urn|label'];
  /** @type {string[]} */ const skipped = [];
  for (const item of collection.items) {
    const service = serviceFor(item.urn);
    if (!service) { skipped.push(item.urn); continue; }
    lines.push(`${service}|${item.urn}|${imageLabel(item)}`);
  }
  return { text: lines.join('\n') + '\n', rows: lines.length - 1, skipped };
}

/**
 * IIIF Presentation 3 manifest of a collection.  Images whose size is not
 * known (`sizes` has no entry for their URN) cannot be canvases and are
 * returned in `missing`.
 * @param {ImageCollection} collection
 * @param {Map<string, {width: number, height: number}>} sizes  By image URN.
 * @param {{id: string, source?: string, serviceFor?: (urn: string) => string | null}} opts
 *        `id` is the manifest's own URL; `source` names the release it was made from.
 * @returns {{manifest: any, missing: string[]}}
 */
export function buildManifest(collection, sizes, opts) {
  const serviceFor = opts.serviceFor ?? imageService;
  /** @type {string[]} */ const missing = [];
  const items = [];
  for (const item of collection.items) {
    const service = serviceFor(item.urn);
    const size = sizes.get(item.urn);
    if (!service || !size) { missing.push(item.urn); continue; }
    const canvasId = `${opts.id}/canvas/${encodeURIComponent(item.id)}`;
    const meta = [{ label: { en: ['Image URN'] }, value: { en: [item.urn] } }];
    if (item.rights) meta.push({ label: { en: ['Rights'] }, value: { en: [item.rights] } });
    items.push({
      id: canvasId,
      type: 'Canvas',
      label: { en: [imageLabel(item)] },
      width: size.width,
      height: size.height,
      metadata: meta,
      items: [{
        id: `${canvasId}/page`,
        type: 'AnnotationPage',
        items: [{
          id: `${canvasId}/page/image`,
          type: 'Annotation',
          motivation: 'painting',
          body: {
            id: pictureUrl(service),
            type: 'Image',
            format: 'image/jpeg',
            width: PICTURE_WIDTH,
            height: Math.round(PICTURE_WIDTH * size.height / size.width),
            service: [{ id: service, type: 'ImageService2', profile: 'level1' }],
          },
          target: canvasId,
        }],
      }],
    });
  }
  const metadata = [{ label: { en: ['Collection URN'] }, value: { en: [collection.urn] } }];
  if (opts.source) metadata.push({ label: { en: ['Made from'] }, value: { en: [opts.source] } });
  const manifest = {
    '@context': 'http://iiif.io/api/presentation/3/context.json',
    id: opts.id,
    type: 'Manifest',
    label: { en: [collection.label] },
    metadata,
    ...(collection.license ? { requiredStatement: { label: { en: ['License'] }, value: { en: [collection.license] } } } : {}),
    items,
  };
  return { manifest, missing };
}
