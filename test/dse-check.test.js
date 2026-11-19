import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { parseRelease } from '../src/hmt-release.js';
import { checkDse, reportCsv } from '../src/dse-check.js';

const T = 'urn:cts:greekLit:tlg0012.tlg001';
const S = 'urn:cts:greekLit:tlg5026';
const IMG = 'urn:cite2:hmt:vaimg.2017a:';
const CEX = `#!ctscatalog
urn|citationScheme|groupName|workTitle|versionLabel|exemplarLabel|online|language
${T}.msA:|book,line|Homeric poetry|Iliad|Version A||true|grc
${T}.msB:|book,line|Homeric poetry|Iliad|Version B||true|grc
${S}.msAint.hmt:|book,scholion|Scholia|Interior scholia|HMT edition||true|grc
#!datamodels
Collection|Model|Label|Description
urn:cite2:hmt:vaimg.2017a:|urn:cite2:cite:datamodels.v1:imagemodel|Images|x
#!citecollections
URN|Description|Labelling property|Ordering property|License
urn:cite2:hmt:vaimg.2017a:|Venetus A images|urn:cite2:hmt:vaimg.2017a.caption:||CC
#!citedata
urn|caption|rights
${IMG}I1|one|r
${IMG}I2|two|r
#!ctsdata
${T}.msA.diplomatic:1.1|d1
${T}.msA.diplomatic:1.2|d2
${T}.msA.diplomatic:1.3|d3
${T}.msA.diplomatic:1.only_dipl|dd
${T}.msA.normalized:1.1|n1
${T}.msA.normalized:1.2|n2
${T}.msA.normalized:1.3|n3
${T}.msB.normalized:9.1|b1
${T}.msB.normalized:9.2|b2
${S}.msAint.hmt.normalized:1.28.lemma|lemma 28
${S}.msAint.hmt.normalized:1.28.comment|comment 28
${S}.msAint.hmt.normalized:1.29.lemma|lemma 29
${S}.msAint.hmt.normalized:1.29.comment|comment 29
${S}.msAint.hmt.diplomatic:1.28.lemma|DL 28
#!citerelationset
urn|urn:cite2:hmt:hmtdse.v1:all
label|DSE

passage|imageroi|surface
${T}.msA:1.1|${IMG}I1@0.1,0.1,0.2,0.2|urn:cite2:hmt:msA.v1:1r
${T}.msA:1.1|${IMG}I1@0.5,0.1,0.2,0.2|urn:cite2:hmt:msA.v1:1r
${T}.msA:1.2@word|${IMG}I2@0.1,0.4,0.2,0.2|urn:cite2:hmt:msA.v1:1r
${T}.msA:1.77|${IMG}I2@0.1,0.5,0.2,0.2|urn:cite2:hmt:msA.v1:1r
${T}.msA:2.1|${IMG}GONE@0.1,0.5,0.2,0.2|urn:cite2:hmt:msA.v1:1r
${S}.msAint.hmt:1.28|${IMG}I1@0.1,0.7,0.2,0.2|urn:cite2:hmt:msA.v1:1r
${S}.msAint.hmt:1.30|${IMG}GONE@0.1,0.8,0.2,0.2|urn:cite2:hmt:msA.v1:1r
${S}.msAmeta.hmt:2.133|urn:cite2:hmt:msA.v1:91r|urn:cite2:hmt:msA.v1:91r
${S}.msAmeta.hmt:2.134|${IMG}I2@0.1,0.9,0.2,0.2|urn:cite2:hmt:msA.v1:1r
not-a-urn|${IMG}I1@0.1,0.1,0.2,0.2|urn:cite2:hmt:msA.v1:1r
${T}.msA:1.3||urn:cite2:hmt:msA.v1:1r
`;
const check = checkDse(parseRelease(CEX));
const byLabel = l => check.versions.find(v => v.label.startsWith(l));

test('records and versions', () => {
  assert.equal(check.found, true);
  assert.equal(check.records, 11);
  assert.deepEqual(check.versions.map(v => v.version.split(':')[3]),
    ['tlg0012.tlg001.msA', 'tlg0012.tlg001.msB', 'tlg5026.msAint.hmt', 'tlg5026.msAmeta.hmt']);
  assert.equal(byLabel('Iliad — Version A').label, 'Iliad — Version A');
  assert.equal(byLabel('Interior scholia — HMT edition').hasText, true);
  assert.equal(check.versions[3].label, 'tlg5026.msAmeta.hmt', 'a version not in the catalog is named by its URN');
});

test('1. text passages missing from DSE: passages of the text that no record names', () => {
  const a = byLabel('Iliad — Version A');
  assert.equal(a.passages, 4);                                   // 1.1, 1.2, 1.3, and 1.only_dipl (diplomatic only)
  assert.deepEqual(a.missing.map(m => m.ref), ['1.only_dipl']);  // 1.3 is named by a record that has no image
  assert.equal(a.indexed, 3);
  assert.equal(a.records, 6);
  assert.equal(a.missing[0].text, 'dd');
  const int = byLabel('Interior scholia');
  assert.equal(int.passages, 2);                                 // lemma and comment make one passage
  assert.deepEqual(int.missing.map(m => m.ref), ['1.29']);
  assert.equal(int.missing[0].text, 'lemma 29 comment 29', 'display text: lemma and comment of one exemplar');
  assert.equal(int.indexed, 1);
});

test('1. a text with no DSE record at all lists all its passages', () => {
  const b = byLabel('Iliad — Version B');
  assert.equal(b.records, 0);
  assert.deepEqual(b.missing.map(m => m.ref), ['9.1', '9.2']);
  assert.equal(b.indexed, 0);
});

test('2. DSE records for passages not in the editions', () => {
  const a = byLabel('Iliad — Version A');
  assert.deepEqual(a.unknown.map(r => [r.ref, r.row]), [['1.77', 4], ['2.1', 5]]);
  assert.equal(a.unknown[0].surface, 'urn:cite2:hmt:msA.v1:1r');
  assert.equal(a.unknown[0].passage, `${T}.msA:1.77`);
  const int = byLabel('Interior scholia');
  assert.deepEqual(int.unknown.map(r => r.ref), ['1.30']);
  const meta = check.versions.find(v => v.version.includes('msAmeta'));
  assert.equal(meta.hasText, false);
  assert.deepEqual(meta.unknown.map(r => r.ref), ['2.133', '2.134']);
  assert.equal(meta.passages, 0);
});

test('2. a subreference is ignored; a passage that is not a CTS URN is reported apart', () => {
  const a = byLabel('Iliad — Version A');
  assert.ok(!a.unknown.some(r => r.ref.startsWith('1.2')), '1.2@word counts as 1.2');
  assert.deepEqual(check.badPassages.map(r => [r.passage, r.row]), [['not-a-urn', 10]]);
});

test('3. images not in the catalog: missing item, non-image collection, no image', () => {
  const by = Object.fromEntries(check.imageProblems.map(p => [p.image || '(none)', p]));
  assert.deepEqual(Object.keys(by).sort(), ['(none)', 'urn:cite2:hmt:msA.v1:91r', `${IMG}GONE`].sort());
  assert.equal(by[`${IMG}GONE`].kind, 'item');
  assert.equal(by[`${IMG}GONE`].collection, IMG);
  assert.equal(by[`${IMG}GONE`].records.length, 2);
  assert.equal(by['urn:cite2:hmt:msA.v1:91r'].kind, 'collection');
  assert.equal(by['(none)'].kind, 'none');
  assert.equal(by['(none)'].records[0].row, 11);
  assert.equal(check.imagesChecked, 4);          // I1, I2, GONE, msA.v1:91r
  assert.equal(check.catalogImages, 2);
});

test('a release with no DSE relation set', () => {
  const c = checkDse(parseRelease('#!ctsdata\nurn:cts:greekLit:tlg0012.tlg001.msA.normalized:1.1|x\n'));
  assert.equal(c.found, false);
  assert.equal(c.records, 0);
  assert.deepEqual(c.versions.map(v => v.missing.length), [1]);
  assert.deepEqual(c.imageProblems, []);
});

test('reportCsv: one line per inconsistency, quoted where needed', () => {
  const lines = reportCsv(check).trimEnd().split('\n');
  assert.equal(lines[0], 'group,version,passage,image,surface,detail');
  const groups = {};
  for (const l of lines.slice(1)) { const g = l.split(',')[0]; groups[g] = (groups[g] ?? 0) + 1; }
  assert.deepEqual(groups, {
    'text passage missing from DSE': 1 + 2 + 1,                                 // msA 1, msB 2, scholia 1
    'DSE record for text passage not in textual editions': 2 + 1 + 2 + 1,      // msA 2, scholia 1, meta 2, bad passage
    'reference to image not in catalog': 2 + 1 + 1,                            // GONE x2, msA.v1:91r, none
  });
  assert.ok(lines.some(l => l.includes('"Iliad — Version B"') === false && l.includes('no DSE records for this text at all')));
  assert.ok(lines.some(l => l.endsWith('the release has no text of this version')));
  const tricky = checkDse(parseRelease(CEX.replace('Version B', 'Version "B", second')));
  assert.ok(reportCsv(tricky).includes('"Iliad — Version ""B"", second"'));
});

const REAL = new URL('../scratch/hmt-current.cex', import.meta.url);
test('real release: figures that were checked by hand', { skip: !existsSync(REAL) }, () => {
  const c = checkDse(parseRelease(readFileSync(REAL, 'utf8')));
  assert.equal(c.records, 26666);
  assert.equal(c.badPassages.length, 0);
  const va = c.versions.find(v => v.version === `${T}.msA:`);
  assert.deepEqual([va.passages, va.records, va.indexed, va.missing.length, va.unknown.length], [15645, 15618, 15602, 43, 15]);
  const vb = c.versions.find(v => v.version === `${T}.msB:`);
  assert.deepEqual([vb.records, vb.missing.length], [0, 710]);
  assert.equal(c.versions.filter(v => !v.hasText).length, 2);        // msAmeta, msAimLater
  assert.equal(c.imageProblems.reduce((n, p) => n + p.records.length, 0), 70);
  assert.equal(c.imageProblems.find(p => p.kind === 'item').image, 'urn:cite2:hmt:e3bifolio.v1:E3_120v_121r');
  // every passage is accounted for: indexed + missing = passages
  for (const v of c.versions) assert.equal(v.indexed + v.missing.length, v.passages, v.label);
});
