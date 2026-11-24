import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { parseRelease } from '../src/hmt-release.js';
import { checkDse, reportCsv, describeRun } from '../src/dse-check.js';

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
urn:cite2:hmt:msA.v1:|urn:cite2:hmt:datamodels.v1:codexmodel|Codex|x
urn:cite2:hmt:e3.v1:|urn:cite2:hmt:datamodels.v1:codexmodel|Codex|x
#!citecollections
URN|Description|Labelling property|Ordering property|License
urn:cite2:hmt:vaimg.2017a:|Venetus A images|urn:cite2:hmt:vaimg.2017a.caption:||CC
urn:cite2:hmt:msA.v1:|Venetus A|urn:cite2:hmt:msA.v1.label:|urn:cite2:hmt:msA.v1.sequence:|CC
urn:cite2:hmt:e3.v1:|Escorial|urn:cite2:hmt:e3.v1.label:|urn:cite2:hmt:e3.v1.sequence:|CC
#!citedata
urn|caption|rights
${IMG}I1|one|r
${IMG}I2|two|r
#!citedata
sequence|urn|rv|label|image
1|urn:cite2:hmt:msA.v1:1r|recto|Venetus A: folio 1, recto|${IMG}I1
2|urn:cite2:hmt:msA.v1:1v|verso|Venetus A: folio 1, verso|${IMG}I2
3|urn:cite2:hmt:msA.v1:2r|recto|Venetus A: folio 2, recto|
4|urn:cite2:hmt:msA.v1:2v|verso|Venetus A: folio 2, verso|
5|urn:cite2:hmt:msA.v1:3r|recto|Venetus A: folio 3, recto|
6|urn:cite2:hmt:msA.v1:91r|recto|Venetus A: folio 91, recto|
7|urn:cite2:hmt:msA.v1:91v|verso|Venetus A: folio 91, verso|
8|urn:cite2:hmt:msA.v1:92r|recto|Venetus A: folio 92, recto|
#!citedata
sequence|urn|rv|label|image
1|urn:cite2:hmt:e3.v1:1r|recto|Escorial: folio 1, recto|
2|urn:cite2:hmt:e3.v1:1v|verso|Escorial: folio 1, verso|
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
${T}.msA:1.1|${IMG}I1@0.1,0.1,0.2,0.2|urn:cite2:hmt:msA.v1:92r
${T}.msA:1.1|${IMG}I1@0.1,0.1,0.2,0.2|urn:cite2:hmt:msA.v1:211v1
`;
const check = checkDse(parseRelease(CEX));
const byLabel = l => check.versions.find(v => v.label.startsWith(l));

test('records and versions', () => {
  assert.equal(check.found, true);
  assert.equal(check.records, 13);
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
  assert.equal(a.records, 8);
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

test('4. codex pages without DSE records, as runs of consecutive pages', () => {
  const by = Object.fromEntries(check.codices.map(c => [c.urn, c]));
  assert.deepEqual(check.codices.map(c => c.label), ['Escorial', 'Venetus A'], 'codices in label order');
  const va = by['urn:cite2:hmt:msA.v1:'];
  assert.equal(va.pages, 8);
  assert.equal(va.covered, 3, '1r, 91r (even by a record with no usable image) and 92r');
  assert.equal(va.uncovered, 5);
  assert.deepEqual(va.runs.map(r => [r.from.id, r.to.id, r.count]), [['1v', '3r', 4], ['91v', '91v', 1]]);
  assert.equal(va.runs[0].from.label, 'folio 1, verso', 'label without the codex name');
  assert.equal(va.runs[0].to.urn, 'urn:cite2:hmt:msA.v1:3r');
  assert.equal(describeRun(va.runs[0]), 'folio 1, verso to folio 3, recto (4 pages)');
  assert.equal(describeRun(va.runs[1]), 'folio 91, verso');
  assert.equal(va.runs.reduce((n, r) => n + r.count, 0), va.uncovered);
});

test('4. a codex that no record mentions is one run; a surface that is no page is ignored', () => {
  const e3 = check.codices.find(c => c.label === 'Escorial');
  assert.deepEqual([e3.pages, e3.covered, e3.uncovered, e3.runs.length], [2, 0, 2, 1]);
  assert.deepEqual([e3.runs[0].from.id, e3.runs[0].to.id], ['1r', '1v']);
  assert.ok(!check.codices.some(c => c.runs.some(r => r.from.id.includes('211'))), '211v1 is not a page of the codex');
});

test('4. pages are compared in codex order, whatever the order of the data', () => {
  const rel = parseRelease(`#!datamodels
Collection|Model|Label|Description
urn:cite2:hmt:x.v1:|urn:cite2:hmt:datamodels.v1:codexmodel|Codex|x
#!citecollections
URN|Description|Labelling property|Ordering property|License
urn:cite2:hmt:x.v1:|X|urn:cite2:hmt:x.v1.label:|urn:cite2:hmt:x.v1.sequence:|CC
#!citedata
sequence|urn|rv|label|image
3|urn:cite2:hmt:x.v1:c|recto|X: c|
1|urn:cite2:hmt:x.v1:a|recto|X: a|
5|urn:cite2:hmt:x.v1:e|recto|X: e|
2|urn:cite2:hmt:x.v1:b|recto|X: b|
4|urn:cite2:hmt:x.v1:d|recto|X: d|
#!citerelationset
urn|urn:cite2:hmt:hmtdse.v1:all
label|DSE

passage|imageroi|surface
urn:cts:greekLit:tlg0012.tlg001.msA:1.1|u:i@0,0,1,1|urn:cite2:hmt:x.v1:b
urn:cts:greekLit:tlg0012.tlg001.msA:1.2|u:i@0,0,1,1|urn:cite2:hmt:x.v1:d
`);
  const c = checkDse(rel).codices[0];
  assert.deepEqual(c.runs.map(r => [r.from.id, r.to.id]), [['a', 'a'], ['c', 'c'], ['e', 'e']]);
  assert.equal(c.covered, 2);
});

test('5. pages with DSE records for Iliad lines not in the text, by manuscript and book', () => {
  const c = checkDse(parseRelease(CEX));
  assert.equal(c.iliadPages.length, 1, 'only Iliad versions with such records');
  const a = c.iliadPages[0];
  assert.equal(a.version, `${T}.msA:`);
  assert.equal(a.byBook.length, 24);
  assert.deepEqual([a.byBook[0].records, a.byBook[0].pages, a.byBook[0].text], [1, 1, '1r'], '1.77 on 1r');
  assert.deepEqual([a.byBook[1].records, a.byBook[1].text !== ''], [1, true], '2.1');
  assert.equal(a.byBook[2].records, 0);
  assert.equal(a.byBook[2].text, '');
  assert.equal(a.records, a.byBook.reduce((n, b) => n + b.records, 0) + a.other);
});

test('5. consecutive pages are joined in codex order; pages outside the codex follow', () => {
  const rel = parseRelease(`#!datamodels
Collection|Model|Label|Description
urn:cite2:hmt:msA.v1:|urn:cite2:hmt:datamodels.v1:codexmodel|Codex|x
#!citecollections
URN|Description|Labelling property|Ordering property|License
urn:cite2:hmt:msA.v1:|Venetus A|urn:cite2:hmt:msA.v1.label:|urn:cite2:hmt:msA.v1.sequence:|CC
#!citedata
sequence|urn|rv|label|image
1|urn:cite2:hmt:msA.v1:1r|recto|f1r|
2|urn:cite2:hmt:msA.v1:1v|verso|f1v|
3|urn:cite2:hmt:msA.v1:2r|recto|f2r|
4|urn:cite2:hmt:msA.v1:2v|verso|f2v|
#!citerelationset
urn|urn:cite2:hmt:hmtdse.v1:all
label|DSE

passage|imageroi|surface
${T}.msA:3.1|u:i@0,0,1,1|urn:cite2:hmt:msA.v1:2v
${T}.msA:3.2|u:i@0,0,1,1|urn:cite2:hmt:msA.v1:1v
${T}.msA:3.3|u:i@0,0,1,1|urn:cite2:hmt:msA.v1:2r
${T}.msA:3.4|u:i@0,0,1,1|urn:cite2:hmt:msA.v1:1r
${T}.msA:3.5|u:i@0,0,1,1|urn:cite2:hmt:msA.v1:99r
${T}.msA:x.1|u:i@0,0,1,1|urn:cite2:hmt:msA.v1:1r
`);
  const a = checkDse(rel).iliadPages[0];
  assert.equal(a.byBook[2].text, '1r–2v, 99r');
  assert.equal(a.byBook[2].pages, 5);
  assert.deepEqual(a.byBook[2].parts.map(p => [p.from.urn, p.to.urn]),
    [['urn:cite2:hmt:msA.v1:1r', 'urn:cite2:hmt:msA.v1:2v'], ['urn:cite2:hmt:msA.v1:99r', 'urn:cite2:hmt:msA.v1:99r']]);
  assert.equal(a.other, 1);
});

test('missing passages carry the text of every exemplar', () => {
  const rel = parseRelease(`#!ctsdata
${T}.msA.diplomatic:1.1|dip
${T}.msA.normalized:1.1|norm
${T}.msA.normalized:1.2|only norm
`);
  const m = checkDse(rel).versions[0].missing;
  assert.deepEqual(m.map(x => x.ref), ['1.1', '1.2']);
  assert.deepEqual(m[0].texts, [{ exemplar: 'diplomatic', text: 'dip' }, { exemplar: 'normalized', text: 'norm' }]);
  assert.equal(m[0].text, 'dip');
  assert.deepEqual(m[1].texts, [{ exemplar: 'normalized', text: 'only norm' }]);
});

test('a release with no DSE relation set', () => {
  const c = checkDse(parseRelease('#!ctsdata\nurn:cts:greekLit:tlg0012.tlg001.msA.normalized:1.1|x\n'));
  assert.equal(c.found, false);
  assert.equal(c.records, 0);
  assert.deepEqual(c.versions.map(v => v.missing.length), [1]);
  assert.deepEqual(c.imageProblems, []);
  assert.deepEqual(c.codices, []);
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
    'codex page without DSE record': 2 + 1,                                    // msA 2 runs, Escorial 1
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
  const ip = c.iliadPages.find(v => v.version.endsWith('.msA:'));
  assert.deepEqual(ip.byBook.map((b, i) => b.records ? [i + 1, b.records, b.text] : null).filter(Boolean),
    [[4, 1, '58v'], [7, 1, '98v'], [14, 1, '188v'], [16, 6, '213v, 214v, 218r, 219v'], [24, 1, '324v']]);
  assert.equal(ip.other, 5);
  const vb = c.versions.find(v => v.version === `${T}.msB:`);
  assert.deepEqual([vb.records, vb.missing.length], [0, 710]);
  assert.equal(c.versions.filter(v => !v.hasText).length, 2);        // msAmeta, msAimLater
  assert.equal(c.imageProblems.reduce((n, p) => n + p.records.length, 0), 70);
  assert.equal(c.imageProblems.find(p => p.kind === 'item').image, 'urn:cite2:hmt:e3bifolio.v1:E3_120v_121r');
  // every passage is accounted for: indexed + missing = passages
  for (const v of c.versions) assert.equal(v.indexed + v.missing.length, v.passages, v.label);
  const vaCodex = c.codices.find(x => x.label.startsWith('Venetus A'));
  assert.deepEqual([vaCodex.pages, vaCodex.covered, vaCodex.uncovered, vaCodex.runs.length], [662, 630, 32, 3]);   // agrees with coverage.html (631 less the surface `211v1`, not a page)
  assert.deepEqual(vaCodex.runs.map(r => [r.from.id, r.to.id, r.count]).slice(1, 2), [['211v', '211v', 1]]);
  const e3 = c.codices.find(x => x.label.startsWith('Escorial Y'));
  assert.deepEqual([e3.pages, e3.covered], [660, 71]);
  assert.ok(c.codices.filter(x => x.covered === 0).every(x => x.runs.length === 1 && x.runs[0].count === x.pages), 'a codex with no records is one run');
});
