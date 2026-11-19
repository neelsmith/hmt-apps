import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { parseRelease } from '../src/hmt-release.js';
import { buildTextIndex } from '../src/text-index.js';
import {
  iliadVersions, resolveRange, commentaryPairs, commentarySpans, commentarySpansAllVersions, annotateRange,
  shortVersionLabel,
} from '../src/iliad-scholia.js';

const T = 'urn:cts:greekLit:tlg0012.tlg001';
const CEX = `#!ctscatalog
urn|citationScheme|groupName|workTitle|versionLabel|exemplarLabel|online|language
${T}.msA:|book,line|Homeric poetry|Iliad|Version A||true|grc
${T}.msB:|book,line|Homeric poetry|Iliad|Version B||true|grc
${T}.msC:|book,line|Homeric poetry|Iliad|Version C||true|grc
${T}.e4:|book,line|Homeric poetry|Iliad|Version E4||false|grc
#!datamodels
Collection|Model|Label|Description
urn:cite2:hmt:commentary.v1:all|urn:cite2:cite:datamodels.v1:commentarymodel|Commentary
#!ctsdata
${T}.msA.normalized:1.1|a1
${T}.msA.normalized:1.2|a2
${T}.msA.normalized:1.3|a3
${T}.msA.normalized:1.4|a4
${T}.msB.normalized:1.1|b1
${T}.msB.normalized:1.2|b2
${T}.msB.normalized:1.2a|b2a
${T}.msB.normalized:1.3|b3
${T}.msC.normalized:1.3|c3
${T}.msC.normalized:1.1|c1
#!citerelationset
urn|urn:cite2:hmt:commentary.v1:all
label|Commentary

scholion|iliad
urn:cts:greekLit:tlg5026.A.hmt:1|${T}.msA:1.1-1.2
urn:cts:greekLit:tlg5026.B.hmt:range|${T}.msB:1.1-1.3
urn:cts:greekLit:tlg5026.B.hmt:onlyB|${T}.msB:1.2a
urn:cts:greekLit:tlg5026.B.hmt:endmissing|${T}.msB:1.3-1.4
urn:cts:greekLit:tlg5026.B.hmt:unknown|${T}.msB:13.UNKNOWN
urn:cts:greekLit:tlg5026.C.hmt:reordered|${T}.msC:1.3-1.1
urn:cts:greekLit:tlg5026.E.hmt:notext|${T}.e4:1.1
urn:cts:greekLit:tlg5026.Z.hmt:other|urn:cts:greekLit:tlg7000.tlg001.msA:1.1
`;
const release = parseRelease(CEX);
const idx = buildTextIndex(release);
const versions = iliadVersions(release, idx);
const pairs = commentaryPairs(release);
const textOf = v => idx.get(`${T}.${v}.normalized:`);
const A = textOf('msA');
const lines = (text, spans) => annotateRange(text, { start: 0, end: text.refs.length - 1 }, spans).lines
  .map(l => `${l.ref}:${l.scholia.map(u => u.split(':').pop()).sort().join(',')}`);

test('all versions: scholia of other versions land on the same passages of the shown text', () => {
  const { spans } = commentarySpansAllVersions(pairs, versions, idx, A);
  assert.deepEqual(lines(A, spans), [
    '1.1:1,range,reordered',      // A's own, B's range, C's range (1.3-1.1 in C's order covers 1.3 and 1.1)
    '1.2:1,range',
    '1.3:range,reordered',
    '1.4:',
  ]);
});

test('all versions: a range is resolved in its own text and may cross passages the shown text lacks', () => {
  const { spans } = commentarySpansAllVersions(pairs, versions, idx, A);
  // B's 1.1-1.3 runs through 1.2a, which A lacks: one run, not two
  const b = spans.filter(s => s.scholion.endsWith(':range'));
  assert.deepEqual(b.map(s => [s.start, s.end]), [[0, 2]]);
  // C's 1.3-1.1 follows C's order (1.3, 1.1): two separate passages in A
  const c = spans.filter(s => s.scholion.endsWith(':reordered')).map(s => [s.start, s.end]).sort();
  assert.deepEqual(c, [[0, 0], [2, 2]]);
  // a scholion on a passage the shown text lacks adds nothing and is not "unresolved"
  assert.ok(!spans.some(s => s.scholion.endsWith(':onlyB')));
});

test('all versions: the text shown can be any version, and its own scholia are kept', () => {
  const B = textOf('msB');
  const { spans } = commentarySpansAllVersions(pairs, versions, idx, B);
  assert.deepEqual(lines(B, spans), [
    '1.1:1,range,reordered',
    '1.2:1,range',
    '1.2a:onlyB,range',
    '1.3:range,reordered',
  ]);
});

test('all versions: unresolvable relations are counted; other works are ignored', () => {
  const r = commentarySpansAllVersions(pairs, versions, idx, A);
  // unresolved: 1.3-1.4 in B (no 1.4 there), 13.UNKNOWN, and the version with no text (e4)
  assert.equal(r.unresolved, 3);
  assert.equal(r.relations, 7);            // 8 relations, one of them to another work
});

test('all versions: never fewer scholia than the same version alone', () => {
  for (const v of ['msA', 'msB', 'msC']) {
    const text = textOf(v);
    const one = lines(text, commentarySpans(pairs, `${T}.${v}:`, text).spans);
    const all = lines(text, commentarySpansAllVersions(pairs, versions, idx, text).spans);
    one.forEach((l, i) => {
      const [ref, own] = l.split(':');
      const [ref2, more] = all[i].split(':');
      assert.equal(ref, ref2);
      for (const s of own.split(',').filter(Boolean)) assert.ok(more.split(',').includes(s), `${v} ${ref}: ${s}`);
    });
  }
});

test('byVersion groups each line\'s scholia by the version their relation names', () => {
  const { spans } = commentarySpansAllVersions(pairs, versions, idx, A);
  const out = annotateRange(A, { start: 0, end: A.refs.length - 1 }, spans);
  const short = u => u.split(':').pop();
  const by = l => Object.fromEntries(Object.entries(l.byVersion).map(([v, ss]) => [v.split('.').pop().replace(':', ''), ss.map(short).sort()]));
  assert.deepEqual(by(out.lines[0]), { msA: ['1'], msB: ['range'], msC: ['reordered'] });        // 1.1
  assert.deepEqual(by(out.lines[1]), { msA: ['1'], msB: ['range'] });                           // 1.2
  assert.deepEqual(by(out.lines[3]), {});                                                        // 1.4
  for (const l of out.lines) {                                                                   // the groups are exactly the scholia
    assert.deepEqual(Object.values(l.byVersion).flat().sort(), [...l.scholia].sort(), l.ref);
  }
  // one version at a time: a single group, the version itself
  const one = annotateRange(A, { start: 0, end: 1 }, commentarySpans(pairs, `${T}.msA:`, A).spans);
  assert.deepEqual(Object.keys(one.lines[0].byVersion), [`${T}.msA:`]);
  // spans without a version (from other callers) go under ''
  const plain = annotateRange(A, { start: 0, end: 0 }, [{ scholion: 'urn:x:1', start: 0, end: 0 }]);
  assert.deepEqual(plain.lines[0].byVersion, { '': ['urn:x:1'] });
});

test('shortVersionLabel drops the parenthesis', () => {
  assert.equal(shortVersionLabel('Venetus A (Marciana 454 = 822)'), 'Venetus A');
  assert.equal(shortVersionLabel('Escorial, Upsilon 1.1'), 'Escorial, Upsilon 1.1');
  assert.equal(shortVersionLabel('(odd)'), '(odd)');
  assert.equal(shortVersionLabel('Geneva 44'), 'Geneva 44');
});

const REAL = new URL('../scratch/hmt-current.cex', import.meta.url);
test('real release: other manuscripts add scholia, and nothing is lost', { skip: !existsSync(REAL) }, () => {
  const rel = parseRelease(readFileSync(REAL, 'utf8'));
  const ti = buildTextIndex(rel);
  const vs = iliadVersions(rel, ti);
  const ps = commentaryPairs(rel);
  const va = vs.find(v => v.urn.endsWith('.msA:'));
  const text = ti.get(va.texts[0].urn);
  const whole = { start: 0, end: text.refs.length - 1 };
  const one = annotateRange(text, whole, commentarySpans(ps, va.urn, text).spans);
  const all = commentarySpansAllVersions(ps, vs, ti, text);
  const many = annotateRange(text, whole, all.spans);
  assert.ok(many.scholiaTotal > one.scholiaTotal, `${many.scholiaTotal} vs ${one.scholiaTotal}`);
  // every relation resolves except the ones that cannot, so Venetus A (which has every passage) shows all the rest
  assert.equal(many.scholiaTotal, ps.length - all.unresolved);
  one.lines.forEach((l, i) => {
    const set = new Set(many.lines[i].scholia);
    for (const s of l.scholia) assert.ok(set.has(s), `${l.ref}: ${s} lost`);
  });
  // 9.1: Venetus A's own two scholia, plus two from Venetus B and two from the Escorial Upsilon 1.1
  const r = resolveRange(text, '9.1');
  const line = annotateRange(text, r, all.spans).lines[0];
  const by = k => line.scholia.filter(u => u.includes(`tlg5026.${k}.`)).length;
  assert.deepEqual([line.scholia.length, by('msB'), by('e3')], [6, 2, 2], line.scholia.join(' '));
  const counts = Object.fromEntries(Object.entries(line.byVersion).map(([v, ss]) => [v.split('.').pop().replace(':', ''), ss.length]));
  assert.deepEqual(counts, { msA: 2, msB: 2, e3: 2 });
});
