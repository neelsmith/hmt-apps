// @ts-check
/**
 * Pictures of the regions of interest (RoIs) that the DSE records index passages to: for a passage key, the part of the
 * manuscript image the region covers, cut out by the IIIF image service.  The page view of `iliad-scholia-image.html`
 * puts one under each Iliad line and under the text of each scholion.
 *
 * `roisByPassage` and `regionRequest` are plain functions; `createRoiImages` makes DOM elements (browser only).
 * Convention for inlining (see scripts/build.js): imports are single-line.
 */
import { indexDse, dseKey } from './dse.js';
import { imageService, parseInfo } from './images.js';
import { iiifImageUrl, matchProtocol } from './iiif.js';
import { formatQuery } from './location.js';

/** The images app on GitHub Pages, which a picture links to. */
export const RI_IMAGES_APP = 'https://neelsmith.github.io/hmt-apps/images.html';

/** Widest picture asked of the image service, in pixels. */
export const RI_MAX_WIDTH = 1200;

/**
 * The regions of every passage in the DSE, by passage key (see `dseKey`), in index order.
 * @param {import('./hmt-release.js').HmtRelease} release
 * @returns {Map<string, {image: string, roi: import('./dse.js').Roi}[]>}
 */
export function roisByPassage(release) {
  /** @type {Map<string, {image: string, roi: import('./dse.js').Roi}[]>} */
  const out = new Map();
  for (const [image, regions] of indexDse(release).byImage) {
    for (const r of regions) {
      const key = dseKey(r.passage);
      if (!key) continue;
      const list = out.get(key) ?? [];
      list.push({ image, roi: r.roi });
      out.set(key, list);
    }
  }
  return out;
}

/**
 * Link to the image with its region in the images app: `images.html?image=<image URN>@x,y,w,h`, which opens the image
 * with the region highlighted.
 * @param {string} image
 * @param {import('./dse.js').Roi} roi
 */
export function imageRoiLink(image, roi) {
  return RI_IMAGES_APP + formatQuery({ image: `${image}@${roi.x},${roi.y},${roi.w},${roi.h}` });
}

/**
 * The region and size parts of an IIIF request for a region of interest.  With the image's size in pixels the region is
 * in pixels; without it, as percentages (which the IIIF Image API also allows).
 * @param {import('./dse.js').Roi} roi
 * @param {{width: number, height: number} | null} size  Image size, if known.
 * @returns {{region: string, size: string}}
 */
export function regionRequest(roi, size) {
  if (!size) {
    const pct = (/** @type {number} */ v) => String(Math.round(v * 1e4) / 100);
    return { region: `pct:${pct(roi.x)},${pct(roi.y)},${pct(roi.w)},${pct(roi.h)}`, size: `${RI_MAX_WIDTH},` };
  }
  const x = Math.round(roi.x * size.width), y = Math.round(roi.y * size.height);
  const w = Math.max(1, Math.min(Math.round(roi.w * size.width), size.width - x));
  const h = Math.max(1, Math.min(Math.round(roi.h * size.height), size.height - y));
  return { region: `${x},${y},${w},${h}`, size: `${Math.min(w, RI_MAX_WIDTH)},` };
}

/**
 * A maker of RoI pictures for a release.
 * @param {import('./hmt-release.js').HmtRelease} release
 * @param {string} pageProtocol  `location.protocol`
 * @returns {(pk: string) => HTMLElement | null}  The element for a passage key, or null if the DSE has no region for it.
 */
export function createRoiImages(release, pageProtocol) {
  const byPassage = roisByPassage(release);
  /** @type {Map<string, Promise<{width: number, height: number} | null>>} */
  const sizes = new Map();
  const sizeOf = (/** @type {string} */ service) => {
    let p = sizes.get(service);
    if (!p) {
      p = fetch(matchProtocol(`${service}/info.json`, pageProtocol))
        .then(r => (r.ok ? r.json() : null))
        .then(parseInfo)
        .catch(() => null);
      sizes.set(service, p);
    }
    return p;
  };
  return pk => {
    const key = dseKey(pk);
    const regions = key ? byPassage.get(key) : null;
    if (!regions || !regions.length) return null;
    const box = document.createElement('div');
    box.className = 'roi-pics';
    for (const { image, roi } of regions) {
      const service = imageService(image);
      if (!service) continue;
      const fig = document.createElement('figure');
      fig.className = 'roi-pic';
      const link = document.createElement('a');
      link.href = imageRoiLink(image, roi);
      link.target = '_blank';
      link.rel = 'noopener';
      link.title = `Open ${image} with this region in the images app`;
      const img = document.createElement('img');
      img.alt = `Region of the manuscript image indexed to ${pk.slice(pk.lastIndexOf(':') + 1)}`;
      img.loading = 'lazy';
      img.decoding = 'async';
      img.addEventListener('error', () => { fig.classList.add('missing'); img.alt = `Could not load the region of ${image}`; });
      link.appendChild(img);
      fig.appendChild(link);
      box.appendChild(fig);
      sizeOf(service).then(size => {
        const r = regionRequest(roi, size);
        img.src = matchProtocol(iiifImageUrl(service, r.region, r.size), pageProtocol);
      });
    }
    return box.childElementCount ? box : null;
  };
}
