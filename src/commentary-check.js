// @ts-check
/**
 * Checks of the index of scholia to the *Iliad* passages they comment on (the commentary relation
 * set) against the editions of the scholia and the DSE records of a release.  Findings are warnings.
 * Pure functions; no DOM access.
 *
 * Convention for inlining (see scripts/build.js): imports are single-line.
 */
import { ctsVersionOf } from './hmt-release.js';
import { DSE_URN, dseKey } from './dse.js';
import { iliadVersions, commentaryPairs, resolveRange } from './iliad-scholia.js';
import { BOOKS, manuscriptOfScholia } from './coverage.js';

/**
 * @typedef {Object} Finding
 * @property {string} group      Version URN of the group of scholia, e.g. `urn:cts:greekLit:tlg5026.msAint.hmt:`.
 * @property {string} groupLabel Label of the group from the catalogue (`Interior scholia of the Venetus A manuscript`).
 * @property {string} manuscript Short name of the manuscript (`Venetus A`), or the group's label if no Iliad version matches.
 * @property {string} ref        Reference of the scholion in its group, e.g. `12.B1`.
 * @property {number | null} book Book of the scholion (1 to 24), or null.
 * @property {string} [target]   Iliad passage the scholion is indexed to, as written in the index.
 * @property {string[]} [scholionPages] Pages (surfaces) of the scholion in DSE records, as short names.
 * @property {string[]} [iliadPages]    Pages of the Iliad passage in DSE records, as short names.
 * @property {string} [problem]  Why an index entry could not be checked.
 */

/**
 * @typedef {Object} GroupSummary
 * @property {string} urn
 * @property {string} label
 * @property {string} manuscript
 * @property {number} editions  Scholia in the editions.
 * @property {number} indexed   Scholia of the group named by the commentary index.
 * @property {number} unindexed Scholia in editions that the index does not name.
 * @property {number} missing   Scholia named by the index that are not in the editions.
 */

/**
 * @typedef {Object} CommentaryCheck
 * @property {boolean} found        The release has a commentary index.
 * @property {GroupSummary[]} groups
 * @property {Finding[]} unindexed  Scholia in editions with no index entry.
 * @property {Finding[]} missing    Index entries naming scholia that are not in the editions.
 * @property {Finding[]} unresolved Index entries whose Iliad passage cannot be found in the Iliad.
 * @property {Finding[]} offPage    Scholia whose pages share none with the pages of the Iliad passage they are indexed to.
 * @property {{checked: number, noScholionPage: number, noIliadPage: number, otherManuscript: number}} pages
 *   How many index entries were compared by page, and how many could not be (and why).
 * @property {number} relations     Index entries read.
 * @property {number} skipped       Index entries that do not name a scholion or an Iliad passage.
 * @property {string[]} manuscripts Manuscripts that have findings, in order of the release.
 */

const SPLIT = /^(urn:cts:[^:]+:[^:]+:)(.*)$/;
const ILIAD = /^urn:cts:[^:]+:tlg0012\.tlg001\.[^.:]+:$/;
const SCHOLIA = /^urn:cts:[^:]+:tlg5026\.[^.:]+\.[^.:]+:$/;

/** Short form of a surface URN: `urn:cite2:hmt:msA.v1:12r` gives `12r`. @param {string} s */
const pageName = s => s.split(':').pop() ?? s;

/** Book of a scholion reference (`12.B1` gives 12), or null if not 1 to 24. @param {string} ref */
export function scholionBook(ref) {
  const n = Number(/^(\d+)\./.exec(ref)?.[1]);
  return n >= 1 && n <= BOOKS ? n : null;
}

/** Reference `book.scholion` of a scholion passage, ignoring lemma and comment parts. @param {string} ref */
const scholionRef = ref => { const m = /^(\d+)\.([^.]+)(?:\.|$)/.exec(ref); return m ? `${m[1]}.${m[2]}` : null; };

/**
 * Compare the index of scholia to Iliad passages with the editions and the DSE.
 * @param {import('./hmt-release.js').HmtRelease} release
 * @param {Map<string, import('./text-index.js').TextIndex>} textIndex
 * @returns {CommentaryCheck}
 */
export function checkCommentary(release, textIndex) {
  const pairs = commentaryPairs(release);
  const found = release.relationSets().some(r => r.rows.length && r.header.includes('scholion'));
  const iliad = iliadVersions(release, textIndex);
  const cat = release.ctsCatalog();
  const catalog = new Map(cat.map(c => [c.urn, c.workTitle]));
  const catalogOrder = cat.map(c => c.urn);

  // scholia in the editions, by group
  /** @type {Map<string, Set<string>>} */
  const inEditions = new Map();
  for (const [key, ex] of textIndex) {
    const v = ctsVersionOf(key);
    if (!v || !SCHOLIA.test(v)) continue;
    const set = inEditions.get(v) ?? new Set();
    for (const ref of ex.refs) { const r = scholionRef(ref); if (r) set.add(r); }
    inEditions.set(v, set);
  }

  // the index: scholion -> Iliad passages
  /** @type {Map<string, Set<string>>} */
  const indexed = new Map();
  /** @type {{group: string, ref: string, target: string}[]} */
  const entries = [];
  let skipped = 0;
  for (const p of pairs) {
    const sm = SPLIT.exec(p.scholion), tm = SPLIT.exec(p.target);
    const group = sm ? ctsVersionOf(sm[1]) : '';
    if (!sm || !tm || !SCHOLIA.test(group) || !ILIAD.test(ctsVersionOf(tm[1]) ?? '')) { skipped++; continue; }
    const set = indexed.get(group) ?? new Set();
    set.add(sm[2]);
    indexed.set(group, set);
    entries.push({ group, ref: sm[2], target: p.target });
  }

  const order = iliad.map(i => i.urn);
  /** @param {string} group */
  const msOf = group => manuscriptOfScholia(group, iliad);
  /** @param {string} group @param {string} ref @param {Partial<Finding>} [more] @returns {Finding} */
  const finding = (group, ref, more = {}) => ({
    group, groupLabel: catalog.get(group) ?? group, manuscript: msOf(group)?.short ?? catalog.get(group) ?? group,
    ref, book: scholionBook(ref), ...more,
  });

  /** @type {GroupSummary[]} */
  const groups = [];
  /** @type {Finding[]} */ const unindexed = [];
  /** @type {Finding[]} */ const missing = [];
  const allGroups = [...new Set([...inEditions.keys(), ...indexed.keys()])];
  allGroups.sort((a, b) => (order.indexOf(msOf(a)?.urn ?? '') + 1 || 99) - (order.indexOf(msOf(b)?.urn ?? '') + 1 || 99) || catalogOrder.indexOf(a) - catalogOrder.indexOf(b) || a.localeCompare(b));
  for (const g of allGroups) {
    const e = inEditions.get(g) ?? new Set(), i = indexed.get(g) ?? new Set();
    const un = [...e].filter(r => !i.has(r)), mi = [...i].filter(r => !e.has(r));
    for (const r of un) unindexed.push(finding(g, r));
    for (const r of mi) missing.push(finding(g, r, { target: entries.filter(x => x.group === g && x.ref === r).map(x => x.target.split(':').pop()).join('; ') }));
    groups.push({ urn: g, label: catalog.get(g) ?? g, manuscript: msOf(g)?.short ?? catalog.get(g) ?? g, editions: e.size, indexed: i.size, unindexed: un.length, missing: mi.length });
  }

  // pages: surfaces of every passage in the DSE
  /** @type {Map<string, Set<string>>} */
  const surfaces = new Map();
  const dse = release.relationSets().find(r => r.urn === DSE_URN);
  for (const row of dse?.rows ?? []) {
    const k = dseKey(row.passage ?? '');
    const s = (row.surface ?? '').trim();
    if (!k || !s) continue;
    const set = surfaces.get(k) ?? new Set();
    set.add(s);
    surfaces.set(k, set);
  }
  /** @type {Map<string, import('./text-index.js').TextIndex | null>} */
  const ownText = new Map(iliad.map(v => [v.urn, v.texts.length ? (textIndex.get(v.texts[0].urn) ?? null) : null]));

  /** @type {Finding[]} */ const unresolved = [];
  /** @type {Finding[]} */ const offPage = [];
  const pages = { checked: 0, noScholionPage: 0, noIliadPage: 0, otherManuscript: 0 };
  for (const e of entries) {
    const tm = /** @type {RegExpExecArray} */ (SPLIT.exec(e.target));
    const version = ctsVersionOf(tm[1]) ?? '';
    const text = ownText.get(version);
    const range = text ? resolveRange(text, tm[2], { allowBook: false }) : null;
    if (!text || !range || 'error' in range) {
      unresolved.push(finding(e.group, e.ref, { target: e.target.split(':').pop(), problem: !text ? `the release has no text of ${version.split('.').slice(2).join('.').replace(/:$/, '')}` : range && 'error' in range ? range.error : '' }));
      continue;
    }
    if (msOf(e.group)?.urn !== version) { pages.otherManuscript++; continue; }
    const mine = surfaces.get(dseKey(`${e.group}${e.ref}`) ?? '');
    if (!mine) { pages.noScholionPage++; continue; }
    /** @type {Set<string>} */
    const theirs = new Set();
    for (let i = range.start; i <= range.end; i++) for (const s of surfaces.get(version + text.refs[i]) ?? []) theirs.add(s);
    if (!theirs.size) { pages.noIliadPage++; continue; }
    pages.checked++;
    if (![...mine].some(s => theirs.has(s))) {
      offPage.push(finding(e.group, e.ref, { target: e.target.split(':').pop(), scholionPages: [...mine].map(pageName), iliadPages: [...theirs].map(pageName) }));
    }
  }

  const withFindings = new Set([...unindexed, ...missing, ...unresolved, ...offPage].map(f => f.manuscript));
  const msOrder = allGroups.map(g => msOf(g)?.short ?? catalog.get(g) ?? g);
  return {
    found, groups, unindexed, missing, unresolved, offPage, pages, relations: pairs.length, skipped,
    manuscripts: [...new Set(msOrder)].filter(m => withFindings.has(m)),
  };
}

/**
 * Findings per book for a chart: one series per manuscript that has findings.
 * @param {Finding[]} findings
 * @returns {{manuscript: string, byBook: number[], other: number}[]}  `other` counts findings without a book 1-24.
 */
export function countByBook(findings) {
  /** @type {Map<string, {manuscript: string, byBook: number[], other: number}>} */
  const m = new Map();
  for (const f of findings) {
    const rec = m.get(f.manuscript) ?? { manuscript: f.manuscript, byBook: new Array(BOOKS).fill(0), other: 0 };
    if (f.book) rec.byBook[f.book - 1]++; else rec.other++;
    m.set(f.manuscript, rec);
  }
  return [...m.values()];
}

/**
 * The findings as CSV text: kind, manuscript, group, scholion, Iliad passage, pages, note.
 * @param {CommentaryCheck} c
 */
export function commentaryCsv(c) {
  /** @param {string} x */
  const q = x => (/[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x);
  const rows = [['finding', 'manuscript', 'group', 'scholion', 'iliad', 'scholion pages', 'iliad pages', 'note']];
  /** @param {string} kind @param {Finding[]} list */
  const add = (kind, list) => { for (const f of list) rows.push([kind, f.manuscript, f.groupLabel, f.ref, f.target ?? '', (f.scholionPages ?? []).join(' '), (f.iliadPages ?? []).join(' '), f.problem ?? '']); };
  add('not indexed', c.unindexed);
  add('not in editions', c.missing);
  add('unresolved Iliad passage', c.unresolved);
  add('not on same page', c.offPage);
  return rows.map(r => r.map(q).join(',')).join('\n') + '\n';
}
