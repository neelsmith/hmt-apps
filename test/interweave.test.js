import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { weave, baseOf, altOf, hasDifference } from '../src/interweave.js';

test('identical texts give one unchanged segment', () => {
  assert.deepEqual(weave('a b c', 'a b c'), [{ text: 'a b c' }]);
  assert.deepEqual(weave('a  b ', 'a  b '), [{ text: 'a  b ' }]);        // verbatim, spacing kept
  assert.deepEqual(weave('', ''), [{ text: '' }]);
  assert.equal(hasDifference(weave('a b', 'a b')), false);
});

test('a differing word is shown with its normalized counterpart', () => {
  assert.deepEqual(weave('βῆ δε κατ χοώμενος κῆρ.', 'βῆ δε κατ χωόμενος κῆρ.'),
    [{ text: 'βῆ δε κατ' }, { base: 'χοώμενος', alt: 'χωόμενος' }, { text: 'κῆρ.' }]);
});

test('words added or omitted by the normalized text', () => {
  assert.deepEqual(weave('οὐδέ τί πω ἴ̈δμεν', 'οὐδέ τί οϋ πω ἴ̈δμεν'),
    [{ text: 'οὐδέ τί' }, { base: '', alt: 'οϋ' }, { text: 'πω ἴ̈δμεν' }]);
  assert.deepEqual(weave('a b c d', 'a d'),
    [{ text: 'a' }, { base: 'b c', alt: '' }, { text: 'd' }]);
});

test('several differences in one line; differences at the ends', () => {
  assert.deepEqual(weave('x b c y e', 'z b c w e'),
    [{ base: 'x', alt: 'z' }, { text: 'b c' }, { base: 'y', alt: 'w' }, { text: 'e' }]);
  assert.deepEqual(weave('a b', 'q'), [{ base: 'a b', alt: 'q' }]);
  assert.deepEqual(weave('a', ''), [{ base: 'a', alt: '' }]);
  assert.deepEqual(weave('', 'a'), [{ base: '', alt: 'a' }]);
});

test('texts that differ only in spacing are not reported as different', () => {
  assert.deepEqual(weave('a  b', 'a b'), [{ text: 'a b' }]);
});

test('baseOf and altOf recover both texts', () => {
  const s = weave('a b c d', 'a x c e f');
  assert.equal(baseOf(s), 'a b c d');
  assert.equal(altOf(s), 'a x c e f');
});

test('very different long texts still work (single block, no blow-up)', () => {
  const a = Array.from({ length: 3000 }, (_, i) => 'a' + i).join(' ');
  const b = Array.from({ length: 3000 }, (_, i) => 'b' + i).join(' ');
  const s = weave(a, b);
  assert.deepEqual(s, [{ base: a, alt: b }]);
});

const REAL = new URL('../scratch/hmt-current.cex', import.meta.url);
test('real release: weaving loses nothing for any diplomatic/normalized pair', { skip: !existsSync(REAL) }, () => {
  const d = new Map(), n = new Map();
  for (const line of readFileSync(REAL, 'utf8').split('\n')) {
    const m = /^(urn:cts:greekLit:[^:]+)\.(diplomatic|normalized):([^|]*)\|(.*)$/.exec(line);
    if (m) (m[2] === 'diplomatic' ? d : n).set(m[1] + ':' + m[3], m[4]);
  }
  const norm = s => s.split(/\s+/).filter(Boolean).join(' ');
  let pairs = 0, differing = 0, iliadDiffering = 0, bad = 0;
  for (const [k, a] of d) {
    const b = n.get(k);
    if (b === undefined) continue;
    pairs++;
    const s = weave(a, b);
    // (identical lines are returned verbatim, so compare ignoring spacing)
    if (norm(baseOf(s)) !== norm(a) || norm(altOf(s)) !== norm(b)) bad++;
    if (a !== b) { differing++; if (k.startsWith('urn:cts:greekLit:tlg0012')) iliadDiffering++; }
    assert.equal(hasDifference(s), norm(a) !== norm(b));
  }
  assert.equal(bad, 0, `${bad} pairs not recovered`);
  assert.ok(pairs > 20000, `${pairs} pairs checked`);
  assert.ok(differing > 1000, `${differing} pairs differ`);
  assert.ok(iliadDiffering > 400, `${iliadDiffering} Iliad lines differ`);
});
