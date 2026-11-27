// @ts-check
/**
 * DSE inconsistencies by manuscript page, for the light table of `dsecheck-viz.html`.  A page is charged with:
 *
 *  - `badRecords`: DSE records that name it as their surface but whose passage is not in the release's texts (or is not a CTS URN)
 *    (see `checkDse`; image problems are not counted here);
 *  - `missingScholia`: scholia of the editions that no DSE record names, placed on the page as `scholiaMissingByPage` places them
 *    (the page of the *Iliad* line the scholion comments on);
 *
 * A page that no DSE record names (a cover, a blank leaf) has no text to be inconsistent about, so it counts 0.
 * `total` is the sum of the two.  Pure functions; no DOM access.
 *
 * Convention for inlining (see scripts/build.js): imports are single-line.
 */
import { checkDse } from './dse-check.js';
import { scholiaMissingByPage } from './scholia-check.js';
import { codices } from './codices.js';

/**
 * @typedef {Object} PageProblems
 * @property {number} records         DSE records naming the page.
 * @property {number} badRecords
 * @property {number} missingScholia
 * @property {number} total
 */

/**
 * @typedef {Object} CodexProblems
 * @property {string} urn
 * @property {string} label
 * @property {import('./codices.js').CodexPage[]} pages
 * @property {Map<string, PageProblems>} byPage   Every page of the codex.
 * @property {number} total                       Sum over the pages.
 * @property {number} pagesWithProblems
 */

/**
 * @param {import('./hmt-release.js').HmtRelease} release
 * @returns {CodexProblems[]}  Every codex with at least one page, in the order of `codices`.
 */
export function pageProblems(release) {
  const check = checkDse(release);
  const scholia = scholiaMissingByPage(release);
  /** @type {Map<string, number>} */
  const missing = new Map();
  for (const p of scholia.pages) if (p.page) missing.set(p.page, p.scholia.length);
  /** @type {CodexProblems[]} */
  const out = [];
  for (const c of codices(release)) {
    if (!c.pages.length) continue;
    /** @type {Map<string, PageProblems>} */
    const byPage = new Map();
    let total = 0, pagesWithProblems = 0;
    for (const p of c.pages) {
      const st = check.surfaces.get(p.urn);
      const records = st?.records ?? 0;
      const badRecords = st?.badText ?? 0;
      const missingScholia = missing.get(p.urn) ?? 0;
      const t = badRecords + missingScholia;
      byPage.set(p.urn, { records, badRecords, missingScholia, total: t });
      total += t;
      if (t) pagesWithProblems++;
    }
    out.push({ urn: c.urn, label: c.label, pages: c.pages, byPage, total, pagesWithProblems });
  }
  return out;
}
