// @ts-check
/**
 * Building IIIF Image API URLs.  No DOM access.
 */

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
