// @ts-check
/**
 * What the address of a page can say, shared by the apps that open at a text, a page or an image:
 * optional query parameters (`?name=value`, never a `#` fragment), each a URN.
 *
 *   text   a CTS URN: a passage or range of a text (`urn:cts:greekLit:tlg0012.tlg001.msA:1.1-1.10`),
 *          in the text apps also a version or one of its texts (`…msA.normalized:`).
 *   page   a CITE2 URN of a page of a codex (`urn:cite2:hmt:msA.v1:12r`).
 *   image  a CITE2 URN of an image (`urn:cite2:hmt:vaimg.2017a:VA012RN_0013`); the images app also
 *          takes the URN of an image collection.
 *
 * The functions that read and format are pure.  `setQuery` changes the address of the page without
 * reloading it, so a copy of the address is a bookmark; where the browser does not allow that (for
 * some pages opened from a file) it does nothing and returns false.
 *
 * Convention for inlining (see scripts/build.js): imports are single-line.
 */

/** The names of the parameters that hold a URN. */
export const PARAM_NAMES = /** @type {const} */ (['text', 'page', 'image']);

/**
 * The values of the named parameters in a query string; null for one that is missing or empty.
 * @template {string} K
 * @param {string} search  e.g. `location.search`
 * @param {readonly K[]} [names]
 * @returns {Record<K, string | null>}
 */
export function readParams(search, names = /** @type {readonly K[]} */ (/** @type {unknown} */ (PARAM_NAMES))) {
  const q = new URLSearchParams((search ?? '').replace(/^\?/, ''));
  /** @type {Record<string, string | null>} */
  const out = {};
  for (const name of names) out[name] = q.get(name)?.trim() || null;
  return /** @type {Record<K, string | null>} */ (out);
}

/**
 * Query string for the given parameters, in the order given, without the empty ones: `?page=urn:cite2:hmt:msA.v1:12r`,
 * or the empty string when none is left.  URN punctuation (`:` `@` `,`) is left readable.
 * @param {Record<string, string | number | null | undefined>} params
 */
export function formatQuery(params) {
  const parts = [];
  for (const [name, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue;
    const v = encodeURIComponent(String(value)).replace(/%3A/gi, ':').replace(/%40/g, '@').replace(/%2C/g, ',');
    parts.push(`${name}=${v}`);
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

/**
 * Put these parameters in the address of the page (and nothing else: no `#`), as a new entry of the
 * history or, with `replace`, in place of the current one.
 * @param {Record<string, string | number | null | undefined>} params
 * @param {boolean} [replace]
 * @returns {boolean}  False if the browser would not change the address.
 */
export function setQuery(params, replace = false) {
  const url = location.pathname + formatQuery(params);
  if (url === location.pathname + location.search && !location.hash) return true;
  try {
    if (replace) history.replaceState(null, '', url); else history.pushState(null, '', url);
    return true;
  } catch (e) {
    return false;
  }
}
