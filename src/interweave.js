// @ts-check
/**
 * Interweave two versions of a text: the base text (here, diplomatic) with the
 * places where the other text (normalized) differs marked.  The comparison is
 * word by word.  No DOM access.
 */

/**
 * A stretch of text that is the same in both versions, or a place where they
 * differ: `base` is what the base text has there and `alt` what the other text
 * has.  Either may be empty (the other text adds, or omits, words).
 * @typedef {{text: string} | {base: string, alt: string}} Segment
 */

/** Largest word-count product compared exactly; bigger differences become one block. */
const MAX_CELLS = 2_500_000;

/**
 * Compare two word lists.  Returns the middle part of the comparison as
 * alternating runs of equal words and differing blocks.
 * @param {string[]} x
 * @param {string[]} y
 * @returns {Segment[]}
 */
function diffWords(x, y) {
  const n = x.length, m = y.length;
  if (n === 0 && m === 0) return [];
  if (n === 0 || m === 0 || n * m > MAX_CELLS) return [{ base: x.join(' '), alt: y.join(' ') }];

  // lcs[i][j]: length of the longest common subsequence of x[i:] and y[j:]
  const w = m + 1;
  const lcs = new Uint16Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i * w + j] = x[i] === y[j] ? lcs[(i + 1) * w + j + 1] + 1
        : Math.max(lcs[(i + 1) * w + j], lcs[i * w + j + 1]);
    }
  }

  /** @type {Segment[]} */
  const out = [];
  /** @type {string[]} */ let same = [];
  /** @type {string[]} */ let del = [];
  /** @type {string[]} */ let ins = [];
  const flushBlock = () => {
    if (del.length || ins.length) out.push({ base: del.join(' '), alt: ins.join(' ') });
    del = []; ins = [];
  };
  const flushSame = () => { if (same.length) out.push({ text: same.join(' ') }); same = []; };

  let i = 0, j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && x[i] === y[j]) {
      flushBlock(); same.push(x[i]); i++; j++;
    } else if (j < m && (i === n || lcs[i * w + j + 1] >= lcs[(i + 1) * w + j])) {
      flushSame(); ins.push(y[j++]);
    } else {
      flushSame(); del.push(x[i++]);
    }
  }
  flushBlock(); flushSame();
  return out;
}

/**
 * Weave the base text and the other text into segments.  Words are separated
 * by whitespace; when the texts differ, spacing is normalized to single
 * spaces.  Identical texts give one segment holding the base text unchanged.
 * @param {string} base
 * @param {string} alt
 * @returns {Segment[]}
 */
export function weave(base, alt) {
  if (base === alt) return [{ text: base }];
  const a = base.split(/\s+/).filter(Boolean);
  const b = alt.split(/\s+/).filter(Boolean);
  let lo = 0;
  while (lo < a.length && lo < b.length && a[lo] === b[lo]) lo++;
  let ha = a.length, hb = b.length;
  while (ha > lo && hb > lo && a[ha - 1] === b[hb - 1]) { ha--; hb--; }
  if (lo === a.length && lo === b.length) return [{ text: a.join(' ') }];   // differ only in spacing

  /** @type {Segment[]} */
  const out = [];
  if (lo > 0) out.push({ text: a.slice(0, lo).join(' ') });
  out.push(...diffWords(a.slice(lo, ha), b.slice(lo, hb)));
  if (ha < a.length) out.push({ text: a.slice(ha).join(' ') });
  return out;
}

/** The base text recovered from segments (words separated by single spaces). */
export function baseOf(segments) {
  return segments.map(s => 'text' in s ? s.text : s.base).filter(Boolean).join(' ');
}

/** The other text recovered from segments (words separated by single spaces). */
export function altOf(segments) {
  return segments.map(s => 'text' in s ? s.text : s.alt).filter(Boolean).join(' ');
}

/** True if the segments contain any difference. */
export function hasDifference(segments) {
  return segments.some(s => 'base' in s);
}
