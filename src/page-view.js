// @ts-check
/**
 * Shared view of a manuscript page: the Iliad lines and scholia the DSE records
 * put on it, each scholion under the Iliad line it comments on, as in
 * `iliad-scholia.html`.  Used by the proper names and string search apps.
 *
 * The app decides what is *marked* in the text: it supplies `fillText` (writes
 * the text of one passage into an element, with its marks) and `isHit` (does
 * the passage contain what the user looked for).  Scholia and panels with a
 * hit, and the chosen passage, are unfolded; the rest are rolled up.
 *
 * DOM code, for the browser.  Convention for inlining (see scripts/build.js):
 * imports are single-line.
 */
import { ctsVersionOf } from './hmt-release.js';
import { textsOfVersion, passageText } from './text-index.js';
import { passageLabel, catalogTitles } from './dse.js';
import { iliadVersions, commentaryPairs, commentarySpansAllVersions } from './iliad-scholia.js';
import { passageKey, sectionOf, attachScholia } from './propernames.js';

/** Version URN of a passage key (version URN + reference). @param {string} pk */
export const versionOf = pk => ctsVersionOf(/** @type {RegExpExecArray} */ (/^(urn:cts:[^:]+:[^:]+:)/.exec(pk))[1]);

/** Reference part of a passage key. @param {string} pk */
export const refOf = pk => pk.slice(versionOf(pk).length);

/**
 * Position of a passage in its text, for ordering.
 * @param {Map<string, import('./text-index.js').TextIndex>} textIndex
 * @param {string} pk
 */
export function positionIn(textIndex, pk) {
  const m = /^(urn:cts:[^:]+:[^:]+:)(.*)$/.exec(pk);
  if (!m) return 1e9;
  const t = textsOfVersion(textIndex, ctsVersionOf(m[1]))[0];
  const tx = t && textIndex.get(t.urn);
  if (!tx) return 1e9;
  return tx.pos.get(m[2]) ?? tx.pos.get(m[2] + '.lemma') ?? 1e9;
}

/**
 * Passage keys grouped by version of the text: Iliad first, then scholia, then
 * the rest, each in text order.
 * @param {Map<string, import('./text-index.js').TextIndex>} textIndex
 * @param {string[]} keys
 * @param {string[]} versionOrder  version URNs in catalog order
 * @returns {{version: string, list: string[]}[]}
 */
export function groupByVersion(textIndex, keys, versionOrder) {
  /** @type {Map<string, string[]>} */
  const by = new Map();
  for (const pk of keys) {
    const v = versionOf(pk);
    const list = by.get(v);
    if (list) list.push(pk); else by.set(v, [pk]);
  }
  const rank = { iliad: 0, scholia: 1, other: 2 };
  const groups = [...by].map(([version, list]) => ({ version, list: list.sort((a, b) => positionIn(textIndex, a) - positionIn(textIndex, b)) }));
  groups.sort((a, b) => rank[sectionOf(a.list[0])] - rank[sectionOf(b.list[0])]
    || (versionOrder.indexOf(a.version) + 1 || 999) - (versionOrder.indexOf(b.version) + 1 || 999));
  return groups;
}

/** @param {string} tag @param {string} [cls] @param {string} [text] */
function pvEl(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
/** Is `pk` the chosen passage?  `current` is one key, or a set of keys (a range). @param {string | Set<string>} current @param {string} pk */
const isCur = (current, pk) => typeof current === 'string' ? pk === current : current.has(pk);
const pvPlural = (/** @type {number} */ n, /** @type {string} */ one, /** @type {string} */ many) => `${n.toLocaleString('en')} ${n === 1 ? one : many}`;

/**
 * @typedef {Object} PageData
 * @property {any} release
 * @property {Map<string, import('./text-index.js').TextIndex>} textIndex
 * @property {Map<string, string>} versionLabels  Version URN to "Iliad — Venetus A".
 * @property {Map<string, string>} pageLabels     Page URN to a readable label.
 * @property {Map<string, string[]>} surfacesOf   Passage key to its pages.
 * @property {Map<string, string[]>} passagesOn   Page URN to the passage keys on it.
 */

/**
 * @typedef {Object} PageOptions
 * @property {() => string} textKind                  `diplomatic` or `normalized`.
 * @property {(box: HTMLElement, pk: string) => void} fillText   Write the text of a passage, marks included.
 * @property {(pk: string) => boolean} isHit          The passage contains what was looked for.
 * @property {string} hitLabel                         Said in the badges: "with “Achilles”".
 * @property {string} hitNoun                          "name", "match": "Fold scholia without the name"; empty: "Fold scholia".
 * @property {boolean} [scroll]                        Scroll the first chosen passage into view (default true).
 */

/**
 * A page view over the data of a release.
 * @param {PageData} data
 */
export function createPageView(data) {
  const { release, textIndex, versionLabels, pageLabels, surfacesOf, passagesOn } = data;
  /** @type {Map<string, any[]>} */ const spansCache = new Map();
  /** @type {any} */ let pairs = null;
  /** @type {any} */ let iVers = null;
  /** @type {Map<string, string[]> | null} */ let targets = null;
  /** @type {Map<string, string> | null} */ let titles = null;

  const titlesOf = () => titles ?? (titles = catalogTitles(release));
  const commentary = () => pairs ?? (pairs = commentaryPairs(release));
  const iVersions = () => iVers ?? (iVers = iliadVersions(release, textIndex));

  /** The text a version's scholia are positioned in. @param {string} version */
  function shownText(version) {
    const t = textsOfVersion(textIndex, version)[0];
    return t ? textIndex.get(t.urn) : null;
  }
  /** Commentary relations as positions in the text of a version (computed once). @param {string} version */
  function spansFor(version) {
    let sp = spansCache.get(version);
    if (!sp) {
      const shown = shownText(version);
      sp = shown ? commentarySpansAllVersions(commentary(), iVersions(), textIndex, shown).spans : [];
      spansCache.set(version, sp);
    }
    return sp;
  }
  /** "Iliad 1.13-1.16": what a scholion is indexed to, for scholia not placed under a line. @param {string} pk */
  function commentedOn(pk) {
    if (!targets) {
      targets = new Map();
      for (const p of commentary()) {
        const k = passageKey(p.scholion);
        if (!k) continue;
        const list = targets.get(k) ?? [];
        const label = passageLabel(p.target, titlesOf());
        if (!list.includes(label)) list.push(label);
        targets.set(k, list);
      }
    }
    return (targets.get(pk) ?? []).join(', ');
  }

  /**
   * One scholion, folded unless it has a hit or is the chosen passage.
   * @param {string} pk @param {string} current @param {string} on  range commented on, "" to look it up
   * @param {PageOptions} o
   */
  function scholionEl(pk, current, on, o) {
    const d = pvEl('details', 'scholion');
    d.dataset.passage = pk;
    const has = o.isHit(pk);
    d.open = has || isCur(current, pk);
    if (has) d.classList.add('has');
    if (isCur(current, pk)) d.classList.add('cur');
    const sm = pvEl('summary');
    sm.appendChild(pvEl('span', 'id', passageLabel(pk, titlesOf())));
    const target = on || commentedOn(pk);
    if (target) sm.appendChild(pvEl('span', 'on', `on ${target}`));
    const lemma = passageText(textIndex, pk, o.textKind()).parts.find(p => p.part === 'lemma');
    if (lemma) { const pre = pvEl('span', 'pre greek', lemma.text.length > 60 ? lemma.text.slice(0, 60) + '…' : lemma.text); pre.lang = 'grc'; sm.appendChild(pre); }
    if (has) sm.appendChild(pvEl('span', 'hasname', o.hitLabel));
    d.appendChild(sm);
    const body = pvEl('div', 'body greek');
    o.fillText(body, pk);
    d.appendChild(body);
    return d;
  }

  /** A passage with no page: the passage alone. */
  function renderLoose(box, pk, o) {
    box.appendChild(pvEl('h2', '', `${versionLabels.get(versionOf(pk)) ?? versionOf(pk)} ${refOf(pk)}`));
    box.appendChild(pvEl('p', 'sub', 'The DSE records do not place this passage on a page; here is the passage alone.'));
    const t = pvEl('div', 'greek');
    o.fillText(t, pk);
    box.appendChild(t);
  }

  function renderPage(box, surface, current, surfaces, o) {
    box.appendChild(pvEl('h2', '', pageLabels.get(surface) ?? surface));
    const sub = pvEl('p', 'sub', surface);
    if (surfaces.length > 1) {
      sub.append(' · also on: ');
      for (const s of surfaces.filter(x => x !== surface)) {
        const b = pvEl('button', 'btn', pageLabels.get(s) ?? s);
        b.addEventListener('click', () => { box.textContent = ''; renderPage(box, s, current, surfaces, o); });
        sub.appendChild(b);
      }
    }
    box.appendChild(sub);

    const keys = (passagesOn.get(surface) ?? []).slice();
    /** @type {Record<string, string[]>} */
    const secs = { iliad: [], scholia: [], other: [] };
    for (const pk of keys) secs[sectionOf(pk)].push(pk);
    for (const s of Object.keys(secs)) secs[s].sort((a, b) => (versionOf(a) === versionOf(b) ? positionIn(textIndex, a) - positionIn(textIndex, b) : versionOf(a).localeCompare(versionOf(b))));

    // Iliad lines, each followed by the scholia of the page that comment on it
    /** @type {Map<string, string[]>} */
    const iliadBy = new Map();
    for (const pk of secs.iliad) { const v = versionOf(pk); if (!iliadBy.has(v)) iliadBy.set(v, []); /** @type {string[]} */ (iliadBy.get(v)).push(pk); }
    let rest = secs.scholia.slice();
    const nHas = secs.scholia.filter(o.isHit).length;
    for (const [version, lines] of iliadBy) {
      const shown = shownText(version);
      const { byLine, loose } = shown ? attachScholia(lines.map(refOf), shown, spansFor(version), rest) : { byLine: new Map(), loose: rest };
      rest = loose;
      const label = iliadBy.size > 1 ? ` · ${(versionLabels.get(version) ?? version).replace(/^Iliad — /, '')}` : '';
      box.appendChild(pvEl('h3', '', `Iliad${label} · ${pvPlural(lines.length, 'line', 'lines')}`));
      for (const pk of lines) {
        const row = pvEl('div', 'line');
        row.dataset.passage = pk;
        if (isCur(current, pk)) row.classList.add('cur');
        row.appendChild(pvEl('span', 'ref', refOf(pk)));
        const t = pvEl('span', 'greek');
        o.fillText(t, pk);
        row.appendChild(t);
        box.appendChild(row);
        const attached = byLine.get(refOf(pk));
        if (!attached) continue;
        const panel = pvEl('div', 'panel');
        for (const a of attached) panel.appendChild(scholionEl(a.key, current, a.from === a.to ? a.from : `${a.from}–${a.to}`, o));
        const nOpen = attached.filter(a => o.isHit(a.key) || isCur(current, a.key)).length;
        const badge = pvEl('button', 'badge', `${pvPlural(attached.length, 'scholion', 'scholia')}${nOpen ? ` · ${nOpen} with ${o.hitLabel}` : ''}`);
        badge.type = 'button';
        if (nOpen) badge.classList.add('hot');
        panel.hidden = !nOpen;
        badge.setAttribute('aria-expanded', String(!panel.hidden));
        badge.title = 'Show the scholia';
        badge.addEventListener('click', () => { panel.hidden = !panel.hidden; badge.setAttribute('aria-expanded', String(!panel.hidden)); });
        row.appendChild(badge);
        box.appendChild(panel);
      }
    }

    // scholia that comment on no line of this page
    const hasLines = iliadBy.size > 0;
    if (rest.length || (!hasLines && secs.scholia.length)) {
      box.appendChild(pvEl('h3', '', `${hasLines ? 'Other scholia on this page' : 'Scholia'} · ${pvPlural(rest.length, 'scholion', 'scholia')}`));
      for (const pk of rest) box.appendChild(scholionEl(pk, current, '', o));
    }

    if (secs.scholia.length) {
      const fold = pvEl('button', 'btn', 'Unfold all scholia');
      let all = false;
      fold.addEventListener('click', () => {
        all = !all;
        for (const pn of box.querySelectorAll('.panel')) {
          const open = all || !!pn.querySelector('details.scholion.has, details.scholion.cur');
          /** @type {HTMLElement} */ (pn).hidden = !open;
          const b = pn.previousElementSibling && pn.previousElementSibling.querySelector('.badge');
          if (b) b.setAttribute('aria-expanded', String(open));
        }
        for (const d of box.querySelectorAll('details.scholion')) d.open = all || d.classList.contains('has') || d.classList.contains('cur');
        fold.textContent = all ? (o.hitNoun ? `Fold scholia without the ${o.hitNoun}` : 'Fold scholia') : 'Unfold all scholia';
      });
      const top = pvEl('p', 'sub', `${pvPlural(secs.scholia.length, 'scholion', 'scholia')} on this page` + (nHas ? `, ${nHas} with ${o.hitLabel}. ` : '. '));
      top.appendChild(fold);
      sub.after(top);
    }

    if (secs.other.length) {
      box.appendChild(pvEl('h3', '', `Other text · ${pvPlural(secs.other.length, 'passage', 'passages')}`));
      for (const pk of secs.other) {
        const row = pvEl('div', 'line');
        if (isCur(current, pk)) row.classList.add('cur');
        row.appendChild(pvEl('span', 'ref', refOf(pk)));
        const t = pvEl('span', 'greek');
        o.fillText(t, pk);
        row.appendChild(t);
        box.appendChild(row);
      }
    }
    const cur = box.querySelector('.cur');
    if (cur && o.scroll !== false) cur.scrollIntoView({ block: 'center' });
  }

  return {
    /**
     * Show the page of a passage in `box` (or the passage alone if the DSE
     * records give it no page).
     * @param {HTMLElement} box @param {string} pk @param {PageOptions} o
     */
    show(box, pk, o) {
      box.textContent = '';
      const surfaces = surfacesOf.get(pk);
      if (!surfaces) renderLoose(box, pk, o);
      else renderPage(box, surfaces[0], pk, surfaces, o);
    },

    /**
     * Show one page, given by its surface URN, with the passages of `current`
     * marked: one passage key, or a set of keys (the lines of a range).
     * @param {HTMLElement} box @param {string} surface @param {string | Set<string>} current @param {PageOptions} o
     */
    showPage(box, surface, current, o) {
      box.textContent = '';
      renderPage(box, surface, current, [surface], o);
    },
  };
}
