import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { parseRelease } from '../src/hmt-release.js';
import { buildTextIndex } from '../src/text-index.js';
import { checkCommentary, countByBook, scholionBook, commentaryCsv } from '../src/commentary-check.js';

const CEX = `#!ctscatalog
urn|citationScheme|groupName|workTitle|versionLabel|exemplarLabel|online|language
urn:cts:greekLit:tlg0012.tlg001.msA:|book/line|Homer|Iliad|Venetus A (Marciana 454 = 822)||true|grc
urn:cts:greekLit:tlg0012.tlg001.msA.diplomatic:|book/line|Homer|Iliad|Venetus A (Marciana 454 = 822)|diplomatic|true|grc
urn:cts:greekLit:tlg0012.tlg001.msB:|book/line|Homer|Iliad|Venetus B (Marciana 453 = 821)||true|grc
urn:cts:greekLit:tlg0012.tlg001.msB.diplomatic:|book/line|Homer|Iliad|Venetus B (Marciana 453 = 821)|diplomatic|true|grc
urn:cts:greekLit:tlg5026.msA.hmt:|book,scholion,part|Scholia|Main scholia of the Venetus A manuscript|HMT edition||true|grc
urn:cts:greekLit:tlg5026.msA.hmt.diplomatic:|book,scholion,part|Scholia|Main scholia of the Venetus A manuscript|HMT edition|diplomatic|true|grc
urn:cts:greekLit:tlg5026.msAint.hmt:|book,scholion,part|Scholia|Interior scholia of the Venetus A manuscript|HMT edition||true|grc
urn:cts:greekLit:tlg5026.msAint.hmt.diplomatic:|book,scholion,part|Scholia|Interior scholia of the Venetus A manuscript|HMT edition|diplomatic|true|grc
urn:cts:greekLit:tlg5026.msB.hmt:|book,scholion,part|Scholia|Scholia of the Venetus B manuscript|HMT edition||true|grc
urn:cts:greekLit:tlg5026.msB.hmt.diplomatic:|book,scholion,part|Scholia|Scholia of the Venetus B manuscript|HMT edition|diplomatic|true|grc
urn:cts:greekLit:tlg5026.zz.hmt:|book,scholion,part|Scholia|Scholia of an unknown manuscript|HMT edition||true|grc
urn:cts:greekLit:tlg5026.zz.hmt.diplomatic:|book,scholion,part|Scholia|Scholia of an unknown manuscript|HMT edition|diplomatic|true|grc
#!ctsdata
urn:cts:greekLit:tlg0012.tlg001.msA.diplomatic:1.1|μηνιν
urn:cts:greekLit:tlg0012.tlg001.msA.diplomatic:1.2|ουλομενην
urn:cts:greekLit:tlg0012.tlg001.msA.diplomatic:1.3|πολλας
urn:cts:greekLit:tlg0012.tlg001.msB.diplomatic:1.1|μηνιν
urn:cts:greekLit:tlg5026.msA.hmt.diplomatic:1.1.lemma|μηνιν
urn:cts:greekLit:tlg5026.msA.hmt.diplomatic:1.1.comment|a
urn:cts:greekLit:tlg5026.msA.hmt.diplomatic:1.2.comment|b
urn:cts:greekLit:tlg5026.msA.hmt.diplomatic:2.1.comment|c
urn:cts:greekLit:tlg5026.msAint.hmt.diplomatic:1.1.comment|d
urn:cts:greekLit:tlg5026.msAint.hmt.diplomatic:1.2.comment|e
urn:cts:greekLit:tlg5026.msB.hmt.diplomatic:1.1.comment|f
urn:cts:greekLit:tlg5026.zz.hmt.diplomatic:30.1.comment|g
#!datamodels
Collection|Model|Label|Description
urn:cite2:hmt:commentary.v1:all|urn:cite2:cite:datamodels.v1:commentarymodel|Commentary|x
#!citerelationset
urn|urn:cite2:hmt:commentary.v1:all
label|Commentary

scholion|iliad
urn:cts:greekLit:tlg5026.msA.hmt:1.1|urn:cts:greekLit:tlg0012.tlg001.msA:1.1
urn:cts:greekLit:tlg5026.msA.hmt:1.2|urn:cts:greekLit:tlg0012.tlg001.msA:1.2-1.3
urn:cts:greekLit:tlg5026.msA.hmt:9.9|urn:cts:greekLit:tlg0012.tlg001.msA:1.1
urn:cts:greekLit:tlg5026.msA.hmt:2.1|urn:cts:greekLit:tlg0012.tlg001.msA:1.2
urn:cts:greekLit:tlg5026.msAint.hmt:1.1|urn:cts:greekLit:tlg0012.tlg001.msA:1.XXX
urn:cts:greekLit:tlg5026.msB.hmt:1.1|urn:cts:greekLit:tlg0012.tlg001.msA:1.1
urn:cts:greekLit:tlg5026.zz.hmt:30.1|urn:cts:greekLit:tlg0016.tlg001.x:1.1
#!citerelationset
urn|urn:cite2:hmt:hmtdse.v1:all
label|DSE

passage|imageroi|surface
urn:cts:greekLit:tlg0012.tlg001.msA:1.1|urn:cite2:hmt:vaimg.2017a:I1R@0.1,0.1,0.2,0.2|urn:cite2:hmt:msA.v1:1r
urn:cts:greekLit:tlg0012.tlg001.msA:1.2|urn:cite2:hmt:vaimg.2017a:I1R@0.1,0.3,0.2,0.2|urn:cite2:hmt:msA.v1:1r
urn:cts:greekLit:tlg0012.tlg001.msA:1.3|urn:cite2:hmt:vaimg.2017a:I2R@0.1,0.3,0.2,0.2|urn:cite2:hmt:msA.v1:2r
urn:cts:greekLit:tlg5026.msA.hmt:1.1.comment|urn:cite2:hmt:vaimg.2017a:I1R@0.5,0.1,0.2,0.2|urn:cite2:hmt:msA.v1:1r
urn:cts:greekLit:tlg5026.msA.hmt:1.2.comment|urn:cite2:hmt:vaimg.2017a:I3R@0.5,0.1,0.2,0.2|urn:cite2:hmt:msA.v1:3r
urn:cts:greekLit:tlg5026.msA.hmt:2.1.comment|urn:cite2:hmt:vaimg.2017a:I3R@0.6,0.1,0.2,0.2|urn:cite2:hmt:msA.v1:1r
`;

function check() {
  const rel = parseRelease(CEX);
  return checkCommentary(rel, buildTextIndex(rel));
}

test('scholia in editions that are not indexed, and index entries for scholia not in editions', () => {
  const c = check();
  assert.equal(c.found, true);
  assert.deepEqual(c.unindexed.map(f => `${f.manuscript} | ${f.groupLabel.split(' ')[0]} ${f.ref}`).sort(),
    ['Scholia of an unknown manuscript | Scholia 30.1', 'Venetus A | Interior 1.2'],
    'the second is indexed to something that is not an Iliad passage; the first has no entry');
  assert.deepEqual(c.missing.map(f => `${f.manuscript} ${f.ref}`), ['Venetus A 9.9']);
  assert.equal(c.missing[0].book, 9);
  assert.equal(c.missing[0].target, '1.1');
  assert.equal(c.skipped, 1, 'the entry for a passage of another work');
});

test('summary per group of scholia, in catalogue order, with the manuscript of each', () => {
  const g = check().groups;
  assert.deepEqual(g.map(x => [x.manuscript, x.editions, x.indexed, x.unindexed, x.missing]), [
    ['Venetus A', 3, 4, 0, 1],
    ['Venetus A', 2, 1, 1, 0],
    ['Venetus B', 1, 1, 0, 0],
    ['Scholia of an unknown manuscript', 1, 0, 1, 0],
  ]);
});

test('Iliad passages that cannot be found are reported, not guessed at', () => {
  const c = check();
  assert.deepEqual(c.unresolved.map(f => [f.manuscript, f.ref, f.target]), [['Venetus A', '1.1', '1.XXX']]);
  assert.match(c.unresolved[0].problem, /1\.XXX/);
});

test('scholia on a page that the Iliad passage is not on', () => {
  const c = check();
  assert.deepEqual(c.offPage.map(f => [f.ref, f.target, f.scholionPages, f.iliadPages]), [['1.2', '1.2-1.3', ['3r'], ['1r', '2r']]]);
  assert.deepEqual(c.pages, { checked: 3, noScholionPage: 1, noIliadPage: 0, otherManuscript: 1 });
  // 1.1 shares 1r (ok); 1.2 does not (flagged); 2.1 (page 1r) is indexed to 1.2 (page 1r): ok;
  // 9.9 has no DSE record of its own; the Venetus B scholion is indexed to a passage of the Venetus A
});

test('findings by book, one series per manuscript', () => {
  const c = check();
  const rows = countByBook([...c.unindexed, ...c.missing]);
  assert.deepEqual(rows.map(r => r.manuscript).sort(), ['Scholia of an unknown manuscript', 'Venetus A']);
  const va = rows.find(r => r.manuscript === 'Venetus A');
  assert.equal(va.byBook.length, 24);
  assert.deepEqual([va.byBook[0], va.byBook[8], va.other], [1, 1, 0]);
  assert.equal(rows.find(r => r.manuscript !== 'Venetus A').other, 1, 'book 30 is not a book of the Iliad');
  assert.deepEqual(c.manuscripts, ['Venetus A', 'Scholia of an unknown manuscript']);
  assert.equal(scholionBook('12.B1'), 12);
  assert.equal(scholionBook('25.1'), null);
});

test('CSV report of the findings', () => {
  const lines = commentaryCsv(check()).trim().split('\n');
  assert.equal(lines[0], 'finding,manuscript,group,scholion,iliad,scholion pages,iliad pages,note');
  assert.equal(lines.length, 1 + 2 + 1 + 1 + 1);
  assert.ok(lines.some(l => l.startsWith('not on same page,Venetus A,Main scholia of the Venetus A manuscript,1.2,1.2-1.3,3r,1r 2r')));
});

test('a release without a commentary index', () => {
  const rel = parseRelease(CEX.replace(/#!citerelationset\nurn\|urn:cite2:hmt:commentary[\s\S]*?(?=#!citerelationset)/, ''));
  const c = checkCommentary(rel, buildTextIndex(rel));
  assert.equal(c.found, false);
  assert.equal(c.unindexed.length, 7, 'every scholion is unindexed');
});

const REAL = new URL('../scratch/hmt-current.cex', import.meta.url);
test('on the real release', { skip: !existsSync(REAL) }, () => {
  const rel = parseRelease(readFileSync(REAL, 'utf8'));
  const c = checkCommentary(rel, buildTextIndex(rel));
  assert.equal(c.found, true);
  assert.equal(c.groups.length, 8);
  assert.equal(c.groups.reduce((n, g) => n + g.editions, 0), 1107 + 4732 + 351 + 3 + 2343 + 1724 + 324 + 627);
  assert.equal(c.unindexed.length, 7, 'six interior and one main scholion');
  assert.ok(c.unindexed.some(f => f.ref === '16.209r4' && f.groupLabel.startsWith('Main')));
  assert.equal(c.missing.length, 0);
  assert.ok(c.unresolved.length > 50 && c.offPage.length > 50);
  assert.equal(c.pages.checked + c.pages.noScholionPage + c.pages.noIliadPage + c.pages.otherManuscript + c.unresolved.length, c.relations - c.skipped);
  assert.ok(c.offPage.every(f => f.scholionPages.every(p => !f.iliadPages.includes(p))));
  assert.deepEqual(c.manuscripts, ['Venetus A', 'Escorial, Upsilon 1.1']);
});
