// @ts-check
/**
 * Illustrations: other images of a citable object (a manuscript page, say).  A release that follows the
 * illustration data model (`urn:cite2:cite:datamodels.v1:illustrationmodel`) has a relation set (`#!citerelationset`)
 * with the heading `image|illustrated`: each row gives an image URN and the URN of the object it illustrates.
 *
 * Convention for inlining (see scripts/build.js): imports are single-line.
 */

/** The data model of an index of images to the objects they illustrate. */
export const ILLUSTRATION_MODEL = 'urn:cite2:cite:datamodels.v1:illustrationmodel';

/**
 * The images that illustrate each object, from every relation set that follows the illustration model
 * (or, if the release does not say, any relation set with `image` and `illustrated` columns).
 * @param {import('./hmt-release.js').HmtRelease} release
 * @returns {Map<string, string[]>}  Object URN to the URNs of its images, in release order, without repeats.
 */
export function illustrationsOf(release) {
  const modelled = new Set(release.dataModels().filter(m => m.model === ILLUSTRATION_MODEL).map(m => m.collection));
  /** @type {Map<string, string[]>} */
  const out = new Map();
  for (const set of release.relationSets()) {
    const columns = set.header.map(h => h.trim().toLowerCase());
    if (!(modelled.has(set.urn) || (columns.includes('image') && columns.includes('illustrated')))) continue;
    for (const row of set.rows) {
      const image = (row.image ?? '').trim(), object = (row.illustrated ?? '').trim();
      if (!image || !object) continue;
      const list = out.get(object) ?? [];
      if (!list.includes(image)) list.push(image);
      out.set(object, list);
    }
  }
  return out;
}

/**
 * Address of the images app showing a list of images (`images.html?urns=…`).
 * @param {string[]} urns
 * @param {string} base  e.g. `https://neelsmith.github.io/hmt-apps/images.html`
 */
export function imagesListUrl(urns, base) {
  return `${base}?urns=${urns.join(',')}`;
}
