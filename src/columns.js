// @ts-check
/**
 * The parallel columns of `iliad-scholia-columns.html`: a passage of the *Iliad* in a reference version, with the same
 * lines of every other version of the *Iliad* that has them, the words that differ from the reference marked (punctuation and case ignored), and for
 * each line of each version the scholia indexed to that version.  No DOM access.
 *
 * Convention for inlining (see scripts/build.js): imports are single-line.
 */
import { resolveRange, commentarySpans, annotateRange } from './iliad-scholia.js';
import { weave } from './interweave.js';

/** A word without its punctuation (and elision marks) and in lower case, for comparing; a word that is all punctuation stays as it is. @param {string} w */
const colKey = w => (w.replace(/[\p{P}\p{Sk}]/gu, '') || w).toLowerCase();

/**
 * Compare a line with the reference line, word by word, ignoring punctuation and case: the segments hold the words as each text
 * has them (equal stretches in the line's own spelling, with its punctuation).
 * @param {string} ref @param {string} line
 * @returns {import('./interweave.js').Segment[]}
 */
export function compareLines(ref, line) {
  const a = ref.split(/\s+/).filter(Boolean), b = line.split(/\s+/).filter(Boolean);
  const segs = weave(a.map(colKey).join(' '), b.map(colKey).join(' '));
  let i = 0, j = 0;
  const count = (/** @type {string} */ t) => t.split(/\s+/).filter(Boolean).length;
  /** @type {import('./interweave.js').Segment[]} */
  const out = [];
  for (const seg of segs) {
    if ('text' in seg) {
      const n = count(seg.text);
      out.push({ text: b.slice(j, j + n).join(' ') });
      i += n; j += n;
    } else {
      const n = count(seg.base), m = count(seg.alt);
      out.push({ base: a.slice(i, i + n).join(' '), alt: b.slice(j, j + m).join(' ') });
      i += n; j += m;
    }
  }
  return out;
}

/** Most lines shown (a whole book is about 600). */
export const COL_MAX_ROWS = 600;

/**
 * @typedef {Object} ColumnLine
 * @property {string} text
 * @property {string[]} scholia    Scholia indexed to this line of this version (URNs).
 * @property {import('./interweave.js').Segment[] | null} segments  The text compared with the reference line (null in the reference column, or if the reference lacks the line).
 */

/**
 * @typedef {Object} Column
 * @property {string} urn          Version URN.
 * @property {string} label
 * @property {string} kind         The text used (`diplomatic`, `normalized`): the requested one if the version has it.
 * @property {Map<string, ColumnLine>} lines   By reference; only the lines this version has.
 * @property {number} different    Lines whose text differs from the reference's.
 */

/**
 * @typedef {Object} Columns
 * @property {string[]} refs       The references of the passage in the reference version, in its order (at most `COL_MAX_ROWS`).
 * @property {number} omitted      Lines of the passage not shown, beyond the limit.
 * @property {Column[]} columns    The reference version first, then the others in the order of `versions`, each with at least one of the lines.
 * @property {number} scholiaTotal Distinct scholia shown in all columns.
 */

/**
 * @param {{urn: string, label: string, online: boolean, texts: {urn: string, kind: string}[]}[]} versions
 * @param {Map<string, import('./text-index.js').TextIndex>} textIndex
 * @param {{scholion: string, target: string}[]} pairs  The commentary index.
 * @returns {(refVersion: string, kind: string, input: string) => Columns | {error: string}}
 */
export function createColumns(versions, textIndex, pairs) {
  /** @type {Map<string, {scholion: string, start: number, end: number}[]>} */
  const spanCache = new Map();
  const spansOf = (/** @type {string} */ version, /** @type {import('./text-index.js').TextIndex} */ text) => {
    let s = spanCache.get(text.urn);
    if (!s) { s = commentarySpans(pairs, version, text).spans; spanCache.set(text.urn, s); }
    return s;
  };
  /** The text of a version of the requested kind (else its first). */
  const pick = (/** @type {typeof versions[number]} */ v, /** @type {string} */ kind) => {
    const t = v.texts.find(x => x.kind === kind) ?? v.texts[0];
    const text = t ? textIndex.get(t.urn) : undefined;
    return t && text ? { kind: t.kind, text } : null;
  };

  return (refVersion, kind, input) => {
    const ref = versions.find(v => v.urn === refVersion);
    const refText = ref ? pick(ref, kind) : null;
    if (!ref || !refText) return { error: 'The reference version has no text in this release.' };
    const range = resolveRange(refText.text, input);
    if ('error' in range) return { error: `${ref.label}: ${range.error}` };
    const all = refText.text.refs.slice(range.start, range.end + 1);
    const refs = all.slice(0, COL_MAX_ROWS);

    /** @type {Column[]} */
    const columns = [];
    const scholia = new Set();
    for (const v of [ref, ...versions.filter(x => x.urn !== ref.urn && x.online)]) {
      const picked = v === ref ? refText : pick(v, kind);
      if (!picked) continue;
      const { text } = picked;
      const here = refs.filter(r => text.pos.has(r));
      if (!here.length) continue;
      const positions = here.map(r => /** @type {number} */ (text.pos.get(r)));
      const annotated = annotateRange(text, { start: Math.min(...positions), end: Math.max(...positions) }, spansOf(v.urn, text));
      const byRef = new Map(annotated.lines.map(l => [l.ref, l]));
      /** @type {Map<string, ColumnLine>} */
      const lines = new Map();
      let different = 0;
      for (const r of here) {
        const l = byRef.get(r);
        const t = text.texts[/** @type {number} */ (text.pos.get(r))];
        const refLine = refText.text.texts[/** @type {number} */ (refText.text.pos.get(r))];
        const segments = v === ref ? null : compareLines(refLine, t);
        if (segments && segments.some(g => 'base' in g)) different++;
        for (const s of l?.scholia ?? []) scholia.add(s);
        lines.set(r, { text: t, scholia: l?.scholia ?? [], segments });
      }
      columns.push({ urn: v.urn, label: v.label, kind: picked.kind, lines, different });
    }
    return { refs, omitted: all.length - refs.length, columns, scholiaTotal: scholia.size };
  };
}
