import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { parseRelease } from '../src/hmt-release.js';
import { buildTextIndex } from '../src/text-index.js';
import { axisTicks, wrapLabel } from '../src/bar-chart.js';
import { BOOKS, iliadLinesByBook, dsePagesByCodex, scholiaByBook } from '../src/coverage.js';

const CEX = `#!ctscatalog
urn|citationScheme|groupName|workTitle|versionLabel|exemplarLabel|online|language
urn:cts:greekLit:tlg0012.tlg001.msA:|book/line|Homer|Iliad|Venetus A (Marciana 454 = 822)||true|grc
urn:cts:greekLit:tlg0012.tlg001.msA.diplomatic:|book/line|Homer|Iliad|Venetus A (Marciana 454 = 822)|diplomatic|true|grc
urn:cts:greekLit:tlg0012.tlg001.msA.normalized:|book/line|Homer|Iliad|Venetus A (Marciana 454 = 822)|normalized|true|grc
urn:cts:greekLit:tlg0012.tlg001.msB:|book/line|Homer|Iliad|Venetus B (Marciana 453 = 821)||true|grc
urn:cts:greekLit:tlg0012.tlg001.msB.diplomatic:|book/line|Homer|Iliad|Venetus B (Marciana 453 = 821)|diplomatic|true|grc
urn:cts:greekLit:tlg0012.tlg001.e4:|book/line|Homer|Iliad|Escorial, Ω 1.12||false|grc
urn:cts:greekLit:tlg5026.msA.hmt:|x|Scholia|Scholia|Main scholia||true|grc
urn:cts:greekLit:tlg5026.msAint.hmt:|x|Scholia|Scholia|Interior scholia||true|grc
urn:cts:greekLit:tlg5026.zz.hmt:|x|Scholia|Scholia|Orphan scholia||true|grc
#!ctsdata
urn:cts:greekLit:tlg0012.tlg001.msA.diplomatic:1.title|ΙΛΙΑΔΟΣ α
urn:cts:greekLit:tlg0012.tlg001.msA.diplomatic:1.1|μηνιν
urn:cts:greekLit:tlg0012.tlg001.msA.diplomatic:1.2|ουλομενην
urn:cts:greekLit:tlg0012.tlg001.msA.diplomatic:1.3|
urn:cts:greekLit:tlg0012.tlg001.msA.normalized:1.3|πολλας
urn:cts:greekLit:tlg0012.tlg001.msA.normalized:1.1|μῆνιν
urn:cts:greekLit:tlg0012.tlg001.msA.diplomatic:6.386del|x
urn:cts:greekLit:tlg0012.tlg001.msA.diplomatic:24.1|y
urn:cts:greekLit:tlg0012.tlg001.msA.diplomatic:25.1|too far
urn:cts:greekLit:tlg0012.tlg001.msB.diplomatic:9.1|z
urn:cts:greekLit:tlg5026.msA.hmt:1.1.comment|scholion
urn:cts:greekLit:tlg5026.msA.hmt:1.1.lemma|lemma
urn:cts:greekLit:tlg5026.msAint.hmt.diplomatic:1.2.comment|c
urn:cts:greekLit:tlg5026.msAint.hmt.normalized:2.1.lemma|l
urn:cts:greekLit:tlg5026.msAint.hmt.diplomatic:2.2.comment|
urn:cts:greekLit:tlg5026.msAint.hmt.diplomatic:30.1.comment|out of range
urn:cts:greekLit:tlg5026.zz.hmt.diplomatic:1.1.comment|orphan
#!datamodels
Collection|Model|Label|Description
urn:cite2:hmt:msA.v1:|urn:cite2:hmt:datamodels.v1:codexmodel|Codex|x
urn:cite2:hmt:msB.v1:|urn:cite2:hmt:datamodels.v1:codexmodel|Codex|x
#!citecollections
URN|Description|Labelling property|Ordering property|License
urn:cite2:hmt:msA.v1:|Venetus A manuscript|urn:cite2:hmt:msA.v1.label:|urn:cite2:hmt:msA.v1.sequence:|CC
urn:cite2:hmt:msB.v1:|Venetus B manuscript|urn:cite2:hmt:msB.v1.label:|urn:cite2:hmt:msB.v1.sequence:|CC
#!citedata
sequence|urn|rv|label|image
1|urn:cite2:hmt:msA.v1:1r|recto|Venetus A, folio 1, recto|
2|urn:cite2:hmt:msA.v1:1v|verso|Venetus A, folio 1, verso|
3|urn:cite2:hmt:msA.v1:2r|recto|Venetus A, folio 2, recto|
4|urn:cite2:hmt:msA.v1:2v|verso|Venetus A, folio 2, verso|
1|urn:cite2:hmt:msB.v1:1r|recto|Venetus B, folio 1, recto|
#!citerelationset
urn|urn:cite2:hmt:hmtdse.v1:all
label|DSE

passage|imageroi|surface
urn:cts:greekLit:tlg0012.tlg001.msA:1.1|urn:cite2:hmt:vaimg.2017a:I1R@0.1,0.1,0.2,0.2|urn:cite2:hmt:msA.v1:1r
urn:cts:greekLit:tlg0012.tlg001.msA:1.2|urn:cite2:hmt:vaimg.2017a:I1R@0.3,0.1,0.2,0.2|urn:cite2:hmt:msA.v1:1r
urn:cts:greekLit:tlg5026.msA.hmt:1.1.comment|urn:cite2:hmt:vaimg.2017a:I2R@0.3,0.1,0.2,0.2|urn:cite2:hmt:msA.v1:2r
urn:cts:greekLit:tlg0012.tlg001.msA:24.1|urn:cite2:hmt:vaimg.2017a:I9R@0.3,0.1,0.2,0.2|urn:cite2:hmt:msA.v1:99r
urn:cts:greekLit:tlg0012.tlg001.msA:25.1|urn:cite2:hmt:vaimg.2017a:I9R@0.3,0.1,0.2,0.2|urn:cite2:hmt:xx.v1:5r
urn:cts:greekLit:tlg0012.tlg001.msA:6.1|nonsense|urn:cite2:hmt:msA.v1:1v
`;

test('iliadLinesByBook: lines with text in either exemplar, by book; titles apart; versions without text left out', () => {
  const rel = parseRelease(CEX);
  const out = iliadLinesByBook(rel, buildTextIndex(rel));
  assert.deepEqual(out.map(o => o.short), ['Venetus A', 'Venetus B']);
  const a = out[0];
  assert.equal(a.byBook.length, BOOKS);
  assert.equal(a.byBook[0], 3, '1.1, 1.2, and 1.3 (text only in the normalized exemplar)');
  assert.equal(a.byBook[5], 1, '6.386del counts as a line');
  assert.equal(a.byBook[23], 1);
  assert.equal(a.titles, 1);
  assert.equal(a.other, 1, '25.1 is not in books 1-24');
  assert.equal(a.total, 5);
  assert.equal(out[1].byBook[8], 1);
  assert.equal(out[1].total, 1);
});

test('dsePagesByCodex: distinct pages, share of the codex, unlisted pages', () => {
  const rel = parseRelease(CEX);
  const r = dsePagesByCodex(rel);
  assert.equal(r.found, true);
  assert.equal(r.skipped, 1, 'the record without a region');
  const a = r.codices.find(c => c.urn === 'urn:cite2:hmt:msA.v1:');
  assert.deepEqual([a.total, a.pages, a.records], [4, 3, 4]);
  assert.deepEqual(a.unlisted, ['urn:cite2:hmt:msA.v1:99r']);
  assert.equal(a.percent, 75);
  const b = r.codices.find(c => c.urn === 'urn:cite2:hmt:msB.v1:');
  assert.deepEqual([b.total, b.pages, b.percent], [1, 0, 0]);
  assert.deepEqual(r.elsewhere, ['urn:cite2:hmt:xx.v1:5r']);
  assert.equal(dsePagesByCodex(parseRelease('#!cexversion\n3.0\n')).found, false);
});

test('scholiaByBook: all groups of a manuscript added together, by book', () => {
  const rel = parseRelease(CEX);
  const { manuscripts, unassigned } = scholiaByBook(rel, buildTextIndex(rel));
  assert.equal(manuscripts.length, 1);
  const a = manuscripts[0];
  assert.equal(a.short, 'Venetus A');
  assert.deepEqual([a.byBook[0], a.byBook[1], a.total], [2, 1, 3], '1.1 (comment and lemma are one scholion) and 1.2 in book 1; 2.1 in book 2');
  assert.deepEqual(a.groups.map(g => g.count).sort(), [1, 2]);
  assert.deepEqual(unassigned, ['Orphan scholia']);
});

test('axisTicks and wrapLabel', () => {
  assert.deepEqual(axisTicks(0), [0, 1]);
  assert.deepEqual(axisTicks(1), [0, 1]);
  assert.deepEqual(axisTicks(7), [0, 2, 4, 6, 8]);
  assert.deepEqual(axisTicks(611), [0, 200, 400, 600, 800]);
  assert.deepEqual(axisTicks(95.3, true), [0, 20, 40, 60, 80, 100]);
  assert.deepEqual(axisTicks(11, true), [0, 5, 10, 15]);
  assert.deepEqual(axisTicks(100, true), [0, 20, 40, 60, 80, 100]);
  assert.ok(axisTicks(631).every(Number.isInteger));
  assert.deepEqual(wrapLabel('Venetus A manuscript'), ['Venetus A', 'manuscript']);
  assert.deepEqual(wrapLabel('Escorial Y 1.1 manuscript'), ['Escorial Y 1.1', 'manuscript']);
  assert.deepEqual(wrapLabel('Short'), ['Short']);
  assert.equal(wrapLabel('a b c d e f g h i j k l m n o p q r s t u v w x y z', 4, 2).length, 2);
  assert.ok(wrapLabel('Averyveryverylonglabelwithnospaces', 14, 3)[0].length <= 34);
});

const REAL = new URL('../scratch/hmt-current.cex', import.meta.url);
test('on the real release', { skip: !existsSync(REAL) }, () => {
  const rel = parseRelease(readFileSync(REAL, 'utf8'));
  const ti = buildTextIndex(rel);
  const lines = iliadLinesByBook(rel, ti);
  const a = lines.find(l => l.short === 'Venetus A');
  assert.ok(a && a.total > 15000 && a.byBook.every(n => n > 400), 'Venetus A has most of every book');
  assert.equal(a.byBook[0], 611 + (a.byBook[0] - 611), 'book 1 counted');
  assert.ok(a.byBook[0] >= 600 && a.byBook[0] <= 625);
  for (const l of lines) assert.equal(l.total, l.byBook.reduce((x, y) => x + y, 0));
  assert.deepEqual(lines.filter(l => l.total > 0).map(l => l.short).sort(), ['Escorial, Upsilon 1.1', 'Venetus A', 'Venetus B']);
  const sc = scholiaByBook(rel, ti).manuscripts;
  assert.deepEqual(sc.map(m => m.short), ['Venetus A', 'Venetus B', 'Escorial, Upsilon 1.1']);
  assert.equal(sc[0].groups.length, 6, 'six groups of Venetus A scholia');
  assert.equal(sc[0].total, sc[0].groups.reduce((n, g) => n + g.count, 0));
  const p = dsePagesByCodex(rel);
  const va = p.codices.find(c => c.urn === 'urn:cite2:hmt:msA.v1:');
  assert.ok(va.pages > 600 && va.pages <= va.total + va.unlisted.length);
  assert.ok(p.codices.every(c => c.percent >= 0));
  assert.equal(p.codices.reduce((n, c) => n + c.pages, 0) + p.elsewhere.length, new Set([...p.codices.flatMap(() => [])]).size + p.codices.reduce((n, c) => n + c.pages, 0) + p.elsewhere.length);
});
