// @ts-check
/**
 * Reading an IIIF Presentation 3 manifest of a manuscript, and building IIIF
 * Image API URLs.  No DOM access.
 */

/** Manifest of the Venetus A images in the HMT archive. */
export const VA_MANIFEST_URL =
  'https://raw.githubusercontent.com/homermultitext/hmt-archive/refs/heads/master/iiif/vaimg.2017a.json';

/**
 * @typedef {Object} Canvas
 * @property {string} id         Last part of the canvas id, e.g. `12r` or `insidefrontcover`.
 * @property {string} label      Label with the manuscript-wide prefix removed, e.g. `folio 12, recto`.
 * @property {string} fullLabel  Label as given in the manifest.
 * @property {string} gridLabel  Short label for a grid: `12r` for folios, otherwise `label`.
 * @property {number} width      Image width in pixels.
 * @property {number} height     Image height in pixels.
 * @property {string} service    IIIF Image API base URL (without region/size/...).
 * @property {string | null} imageUrn  CITE2 URN of the image, e.g. `urn:cite2:hmt:vaimg.2017a:VA012RN_0013`, or null.
 */

/**
 * CITE2 image URN for an image service URL whose path ends in
 * `hmt/<collection>/<version>/<image>.tif`.  For example
 * `.../hmt/vaimg/2017a/VA012RN_0013.tif` gives
 * `urn:cite2:hmt:vaimg.2017a:VA012RN_0013`.
 * @param {string} service
 * @returns {string | null}
 */
export function imageUrnFromService(service) {
  const m = /\/hmt\/([^/?#]+)\/([^/?#]+)\/([^/?#]+?)\.tif$/i.exec(service);
  return m ? `urn:cite2:hmt:${m[1]}.${m[2]}:${m[3]}` : null;
}

/** First string of an IIIF language map (`{"en": ["..."]}`) or a plain string. */
function firstLabel(label) {
  if (typeof label === 'string') return label;
  if (label && typeof label === 'object') {
    const first = Object.values(label)[0];
    if (Array.isArray(first) && first.length) return String(first[0]);
    if (typeof first === 'string') return first;
  }
  return '';
}

/** Longest prefix shared by all labels, cut after the last ", ". */
function commonLabelPrefix(labels) {
  if (labels.length < 2) return '';
  let p = labels[0];
  for (const l of labels) { while (p && !l.startsWith(p)) p = p.slice(0, -1); }
  const cut = p.lastIndexOf(', ');
  return cut < 0 ? '' : p.slice(0, cut + 2);
}

/**
 * Canvases of a manifest, in order.  Canvases without a usable image service
 * are skipped; their number is returned as `skipped`.
 * @param {any} manifest  Parsed JSON.
 * @returns {{label: string, canvases: Canvas[], skipped: number}}
 */
export function parseManifest(manifest) {
  const items = Array.isArray(manifest?.items) ? manifest.items : [];
  const raw = [];
  let skipped = 0;
  for (const c of items) {
    const anno = c?.items?.[0]?.items?.[0];
    const body = anno?.body;
    const svc = [].concat(anno?.service ?? body?.service ?? [])[0];
    const service = svc?.id ?? svc?.['@id'];
    const width = Number(body?.width ?? c?.width);
    const height = Number(body?.height ?? c?.height);
    if (typeof service !== 'string' || !(width > 0) || !(height > 0)) { skipped++; continue; }
    raw.push({
      id: String(c.id ?? '').split('/').pop() || String(raw.length),
      fullLabel: firstLabel(c.label),
      width, height, service,
    });
  }
  const prefix = commonLabelPrefix(raw.map(r => r.fullLabel));
  const canvases = raw.map(r => {
    const label = r.fullLabel.slice(prefix.length) || r.fullLabel;
    return {
      ...r,
      label,
      gridLabel: /^\d+[rv]$/.test(r.id) ? r.id : label,
      imageUrn: imageUrnFromService(r.service),
    };
  });
  return { label: firstLabel(manifest?.label), canvases, skipped };
}

/**
 * IIIF Image API URL.
 * @param {string} service  Image service base URL.
 * @param {string} region   `full` or `x,y,w,h` in pixels.
 * @param {string} size     e.g. `256,` (width 256, height by aspect ratio).
 */
export function iiifImageUrl(service, region, size) {
  return `${service}/${region}/${size}/0/default.jpg`;
}

/**
 * Use https for an http image service when the page itself is served over
 * https, since browsers block mixed content.  Other pages keep the URL as is.
 * @param {string} url
 * @param {string} pageProtocol  `location.protocol`, e.g. `https:`.
 */
export function matchProtocol(url, pageProtocol) {
  return pageProtocol === 'https:' ? url.replace(/^http:\/\//i, 'https://') : url;
}
