import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { parseRelease } from '../src/hmt-release.js';
import { buildTextIndex } from '../src/text-index.js';
import {
  iliadVersions, splitReference, resolveRange,
  commentaryPairs, commentarySpans, annotateRange, scholionPassage, parseUrnParam,
} from '../src/iliad-scholia.js';

const CEX = `#!ctscatalog
urn|citationScheme|groupName|workTitle|versionLabel|exemplarLabel|online|language
urn:cts:greekLit:tlg0012.tlg001.msA:|book,line|Homeric poetry|Iliad|Venetus A||true|grc
urn:cts:greekLit:tlg0012.tlg001.e4:|book,line|Homeric poetry|Iliad|Escorial 4||false|grc
urn:cts:greekLit:tlg7000.tlg001.msA:|book,line|Anthology|Poems|Poems||true|grc
#!datamodels
Collection|Model|Label|Description
urn:cite2:hmt:commentary.v1:all|urn:cite2:cite:datamodels.v1:commentarymodel|Commentary
urn:cite2:hmt:other.v1:all|urn:cite2:cite:datamodels.v1:somethingelse|Other|x
#!ctsdata
urn:cts:greekLit:tlg0012.tlg001.msA.diplomatic:1.title|Title
urn:cts:greekLit:tlg0012.tlg001.msA.diplomatic:1.1|d1
urn:cts:greekLit:tlg0012.tlg001.msA.diplomatic:1.2|d2
urn:cts:greekLit:tlg0012.tlg001.msA.normalized:1.title|Title
urn:cts:greekLit:tlg0012.tlg001.msA.normalized:1.1|n1
urn:cts:greekLit:tlg0012.tlg001.msA.normalized:1.2|n2
urn:cts:greekLit:tlg0012.tlg001.msA.normalized:1.3|n3
urn:cts:greekLit:tlg0012.tlg001.msA.normalized:1.10|n10
urn:cts:greekLit:tlg0012.tlg001.msA.normalized:1.75|n75
urn:cts:greekLit:tlg0012.tlg001.msA.normalized:1.76|n76
urn:cts:greekLit:tlg0012.tlg001.msA.normalized:2.1|m1
urn:cts:greekLit:tlg0012.tlg001.msA.normalized:2.2|m2
urn:cts:greekLit:tlg5026.msAint.hmt.normalized:1.28.lemma|the lemma
urn:cts:greekLit:tlg5026.msAint.hmt.normalized:1.28.comment|the comment
#!citerelationset
urn|urn:cite2:hmt:commentary.v1:all
label|Commentary

scholion|iliad
urn:cts:greekLit:tlg5026.msAint.hmt:1.28|urn:cts:greekLit:tlg0012.tlg001.msA:1.1-1.3
urn:cts:greekLit:tlg5026.msAint.hmt:1.29|urn:cts:greekLit:tlg0012.tlg001.msA:1.2
urn:cts:greekLit:tlg5026.msAint.hmt:1.30|urn:cts:greekLit:tlg0012.tlg001.msA:1.75-6
urn:cts:greekLit:tlg5026.msAint.hmt:1.31|urn:cts:greekLit:tlg0012.tlg001.msA:13.UNKNOWN
urn:cts:greekLit:tlg5026.msAint.hmt:1.32|urn:cts:greekLit:tlg0012.tlg001.msA:1.2@word-x
urn:cts:greekLit:tlg5026.msAint.hmt:1.33|urn:cts:greekLit:tlg0012.tlg001.msB:1.1
#!citerelationset
urn|urn:cite2:hmt:other.v1:all
label|Not commentary
a|b
urn:cts:greekLit:tlg5026.msAint.hmt:9.9|urn:cts:greekLit:tlg0012.tlg001.msA:1.1
`;
const release = parseRelease(CEX);
const idx = buildTextIndex(release);
const VA = 'urn:cts:greekLit:tlg0012.tlg001.msA:';
const text = idx.get('urn:cts:greekLit:tlg0012.tlg001.msA.normalized:');

test('iliadVersions lists only Iliad versions, with texts (normalized first)', () => {
  const v = iliadVersions(release, idx);
  assert.deepEqual(v.map(x => x.urn), [VA, 'urn:cts:greekLit:tlg0012.tlg001.e4:']);
  assert.equal(v[0].online, true);
  assert.deepEqual(v[0].texts.map(t => t.kind), ['normalized', 'diplomatic']);
  assert.equal(v[1].online, false);
});

test('splitReference', () => {
  assert.deepEqual(splitReference('1.1-1.10'), ['1.1', '1.10']);
  assert.deepEqual(splitReference(' 1.5 '), ['1.5']);
  assert.deepEqual(splitReference('1.1–1.10'), ['1.1', '1.10']);
  assert.deepEqual(splitReference('12.10.-12.12'), ['12.10', '12.12']);
  assert.deepEqual(splitReference('15.339@Μηκιστῆ-δ'), ['15.339']);
  assert.deepEqual(splitReference('1.1@a-1.5@b'), ['1.1', '1.5']);
});

test('resolveRange follows the order of the text', () => {
  assert.deepEqual(resolveRange(text, '1.1-1.10'), { start: 1, end: 4 });
  assert.deepEqual(resolveRange(text, '1.2'), { start: 2, end: 2 });
  assert.deepEqual(resolveRange(text, '1.1-10'), { start: 1, end: 4 });
  assert.deepEqual(resolveRange(text, '1.75-6'), { start: 5, end: 6 });
  assert.deepEqual(resolveRange(text, '1.title-1.2'), { start: 0, end: 2 });
  assert.deepEqual(resolveRange(text, '1'), { start: 0, end: 6 });
  assert.deepEqual(resolveRange(text, '1-2'), { start: 0, end: 8 });
});

test('resolveRange reports errors instead of guessing', () => {
  assert.match(resolveRange(text, '').error, /Enter a passage/);
  assert.match(resolveRange(text, '1.999').error, /1\.999 is not in this text/);
  assert.match(resolveRange(text, '1.1-1.999').error, /1\.999 is not in this text/);
  assert.match(resolveRange(text, '1.10-1.1').error, /ends before it starts/);
  assert.match(resolveRange(text, '7').error, /Book 7/);
  assert.match(resolveRange(text, '13.', { allowBook: false }).error, /not a passage reference/);
});

test('commentary relations are found through the data model, not by name', () => {
  const pairs = commentaryPairs(release);
  assert.equal(pairs.length, 6); // the "other" relation set is excluded
  assert.deepEqual(pairs[0], {
    scholion: 'urn:cts:greekLit:tlg5026.msAint.hmt:1.28',
    target: 'urn:cts:greekLit:tlg0012.tlg001.msA:1.1-1.3',
  });
});

test('commentarySpans keeps the version asked for and counts unresolvable relations', () => {
  const { spans, unresolved } = commentarySpans(commentaryPairs(release), VA, text);
  assert.equal(unresolved, 1); // 13.UNKNOWN; the msB relation is simply not for this version
  assert.deepEqual(spans.map(s => [s.scholion.split(':').pop(), s.start, s.end]),
    [['1.28', 1, 3], ['1.29', 2, 2], ['1.30', 5, 6], ['1.32', 2, 2]]);
});

test('annotateRange counts distinct scholia per line', () => {
  const { spans } = commentarySpans(commentaryPairs(release), VA, text);
  const r = annotateRange(text, resolveRange(text, '1.1-1.10'), spans);
  assert.deepEqual(r.lines.map(l => [l.ref, l.scholia.length]),
    [['1.1', 1], ['1.2', 3], ['1.3', 1], ['1.10', 0]]);
  assert.equal(r.scholiaTotal, 3);
  const partial = annotateRange(text, resolveRange(text, '1.75-1.76'), spans);
  assert.equal(partial.scholiaTotal, 1);
});

test('scholionPassage returns lemma and comment', () => {
  const s = scholionPassage(idx, 'urn:cts:greekLit:tlg5026.msAint.hmt:1.28', 'normalized');
  assert.deepEqual(s, { label: 'msAint 1.28', lemma: 'the lemma', comment: 'the comment' });
  assert.equal(scholionPassage(idx, 'urn:cts:greekLit:tlg5026.msAint.hmt:9.9', 'normalized').comment, '');
});

const REAL = new URL('../scratch/hmt-current.cex', import.meta.url);
test('real release: versions, ranges and scholia', { skip: !existsSync(REAL) }, () => {
  const r = parseRelease(readFileSync(REAL, 'utf8'));
  const ti = buildTextIndex(r);
  const versions = iliadVersions(r, ti);
  assert.deepEqual(versions.map(v => v.urn.split('.').pop()),
    ['msA:', 'msB:', 'e3:', 'e4:', 'u4:', 'gen4:', 'laur32_3:']);
  assert.deepEqual(versions.filter(v => v.online).map(v => v.urn.split('.').pop()), ['msA:', 'msB:', 'e3:']);
  const pairs = commentaryPairs(r);
  assert.ok(pairs.length > 10000);
  const va = versions[0];
  const t = ti.get(va.texts[0].urn);
  const { spans, unresolved } = commentarySpans(pairs, va.urn, t);
  assert.ok(spans.length > 10000 && unresolved < 100, `${spans.length} spans, ${unresolved} unresolved`);
  const rng = resolveRange(t, '1.1-1.10');
  assert.equal(rng.end - rng.start, 9);
  const out = annotateRange(t, rng, spans);
  assert.equal(out.lines.length, 10);
  assert.ok(out.scholiaTotal > 0);
  assert.ok(out.lines.some(l => l.scholia.length > 0));
  const book1 = resolveRange(t, '1');
  assert.ok(book1.end - book1.start > 600);
});

test('parseUrnParam: version, exemplar and passage from a CTS URN', () => {
  const rel = parseRelease(CEX);
  const versions = iliadVersions(rel, buildTextIndex(rel));
  const ok = parseUrnParam(versions, 'urn:cts:greekLit:tlg0012.tlg001.msA:1.1-1.10');
  assert.equal(ok.version.urn, 'urn:cts:greekLit:tlg0012.tlg001.msA:');
  assert.equal(ok.kind, null);
  assert.equal(ok.ref, '1.1-1.10');

  const ex = parseUrnParam(versions, 'urn:cts:greekLit:tlg0012.tlg001.msA.normalized:1.5');
  assert.equal(ex.kind, 'normalized');
  assert.equal(ex.ref, '1.5');

  const only = parseUrnParam(versions, 'urn:cts:greekLit:tlg0012.tlg001.msA:');
  assert.equal(only.ref, '');

  const unknownKind = parseUrnParam(versions, 'urn:cts:greekLit:tlg0012.tlg001.msA.bogus:1.1');
  assert.equal(unknownKind.kind, null);
  assert.match(unknownKind.note, /no bogus text/);
});

test('parseUrnParam: reports URNs it cannot use', () => {
  const rel = parseRelease(CEX);
  const versions = iliadVersions(rel, buildTextIndex(rel));
  for (const [urn, re] of [
    ['hello', /not a CTS URN/],
    ['urn:cts:greekLit:tlg0012.tlg001:1.1', /does not name a version/],
    ['urn:cts:greekLit:tlg0012.tlg001.zzz:1.1', /not a version of the Iliad/],
    ['urn:cts:greekLit:tlg7000.tlg001.msA:1.1', /not a version of the Iliad/],
    ['urn:cts:greekLit:tlg0012.tlg001.e4:1.1', /no online text/],
  ]) {
    const r = parseUrnParam(versions, urn);
    assert.ok('error' in r && re.test(r.error), `${urn}: ${JSON.stringify(r)}`);
  }
});
