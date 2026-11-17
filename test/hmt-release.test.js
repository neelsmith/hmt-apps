import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  HmtRelease, parseRelease, splitBlocks,
  isCollectionUrn, collectionOfObject, collectionOfProperty, propertyUrn,
  ctsWorkOf, ctsVersionOf,
} from '../src/hmt-release.js';

// A small, fully consistent release.
const GOOD = `// comment before anything
#!cexversion
3.0.2

#!citelibrary
// comment inside a block
name|Test library
urn|urn:cite2:test:lib.v1:all
license|Public domain
namespace|hmt|http://www.homermultitext.org/citens/hmt
namespace|greekLit|http://chs.harvard.edu/ctsns/greekLit

#!citecollections
URN|Description|Labelling property|Ordering property|License
urn:cite2:test:pages.v1:|Pages|urn:cite2:test:pages.v1.label:|urn:cite2:test:pages.v1.sequence:|PD

#!citeproperties
Property|Label|Type|Authority list
urn:cite2:test:pages.v1.urn:|URN|Cite2Urn|
urn:cite2:test:pages.v1.label:|Label|String|
urn:cite2:test:pages.v1.sequence:|Sequence|Number|

#!citedata
sequence|urn|label
1|urn:cite2:test:pages.v1:1r|Folio 1 recto
2|urn:cite2:test:pages.v1:1v|Folio 1 verso

#!datamodels
Collection|Model|Label|Description
urn:cite2:test:pages.v1:|urn:cite2:hmt:datamodels.v1:codexmodel|Test codex|A test
urn:cite2:test:idx.v1:all|urn:cite2:cite:datamodels.v1:indexmodel|Test index|Index

#!ctscatalog
urn|citationScheme|groupName|workTitle|versionLabel|exemplarLabel|online|language
urn:cts:greekLit:tlg0012.tlg001.msA:|book,line|Homeric poetry|Iliad|Venetus A||true|grc

#!ctsdata
urn:cts:greekLit:tlg0012.tlg001.msA:1.1|μῆνιν ἄειδε θεὰ
urn:cts:greekLit:tlg0012.tlg001.msA.normalized:1.2|οὐλομένην

#!citerelationset
urn|urn:cite2:test:idx.v1:all
label|Test index
passage|page
urn:cts:greekLit:tlg0012.tlg001.msA:1.1|urn:cite2:test:pages.v1:1r

#!ctsdata
urn:cts:greekLit:tlg0012.tlg001.msA:1.3|ἀχαιοῖς
`;

test('splitBlocks skips comments and blank lines, keeps repeated blocks', () => {
  const { blocks, warnings } = splitBlocks(GOOD);
  assert.deepEqual(warnings, []);
  assert.deepEqual(blocks.map(b => b.type),
    ['cexversion', 'citelibrary', 'citecollections', 'citeproperties', 'citedata',
     'datamodels', 'ctscatalog', 'ctsdata', 'citerelationset', 'ctsdata']);
  assert.deepEqual(blocks[0].lines, ['3.0.2']);
  assert.equal(blocks[1].lines.length, 5); // comment dropped
  assert.equal(blocks[0].startLine, 2);
});

test('splitBlocks handles CRLF and warns on stray content and unknown types', () => {
  const { blocks, warnings } = splitBlocks('stray\r\n#!cexversion\r\n3.0.2\r\n#!nonsense\r\nx\r\n');
  assert.equal(blocks[0].lines[0], '3.0.2');
  assert.equal(warnings.length, 2);
});

test('getBlock composites all blocks of a type', () => {
  const r = parseRelease(GOOD);
  assert.deepEqual(r.blockTypes(), ['cexversion', 'citelibrary', 'citecollections', 'citeproperties',
    'citedata', 'datamodels', 'ctscatalog', 'ctsdata', 'citerelationset']);
  assert.equal(r.getBlock('ctsdata').length, 3);
  assert.deepEqual(r.getBlock('nonexistent'), []);
});

test('getBlock drops repeated header lines of fixed-header types', () => {
  const r = parseRelease('#!datamodels\nA|B\n1|2\n#!datamodels\nA|B\n3|4\n');
  assert.deepEqual(r.getBlock('datamodels'), ['A|B', '1|2', '3|4']);
  assert.deepEqual(r.validate().filter(w => w.includes('differs')), []);
});

test('typed accessors', () => {
  const r = parseRelease(GOOD);
  assert.equal(r.cexVersion, '3.0.2');
  assert.deepEqual(r.library, {
    name: 'Test library', urn: 'urn:cite2:test:lib.v1:all', license: 'Public domain',
    namespaces: [
      { abbreviation: 'hmt', uri: 'http://www.homermultitext.org/citens/hmt' },
      { abbreviation: 'greekLit', uri: 'http://chs.harvard.edu/ctsns/greekLit' },
    ],
  });
  assert.equal(r.collections()[0].orderingProperty, 'urn:cite2:test:pages.v1.sequence:');
  assert.equal(r.properties().length, 3);
  assert.equal(r.dataModels().length, 2);
  assert.equal(r.ctsCatalog()[0].language, 'grc');
  assert.equal(r.ctsData()[0].text, 'μῆνιν ἄειδε θεὰ');
  const cd = r.citeData();
  assert.equal(cd.length, 1);
  assert.deepEqual(cd[0].collections, ['urn:cite2:test:pages.v1:']);
  assert.equal(cd[0].rows[1].label, 'Folio 1 verso');
  const rs = r.relationSets();
  assert.equal(rs[0].urn, 'urn:cite2:test:idx.v1:all');
  assert.deepEqual(rs[0].header, ['passage', 'page']);
  assert.equal(rs[0].rows.length, 1);
});

test('a consistent release has no warnings', () => {
  assert.deepEqual(parseRelease(GOOD).validate(), []);
});

test('missing data yields empty results, not exceptions', () => {
  const r = parseRelease('');
  assert.equal(r.cexVersion, null);
  assert.deepEqual(r.collections(), []);
  assert.deepEqual(r.validate(), []);
});

test('ctsdata keeps "|"-free URN and warns on malformed lines', () => {
  const r = parseRelease('#!ctsdata\nurn:cts:a:b.c.d:1|text|more\nno delimiter\n');
  assert.deepEqual(r.ctsData(), [{ urn: 'urn:cts:a:b.c.d:1', text: 'text|more' }]);
  assert.equal(r.validate().filter(w => w.startsWith('ctsdata:')).length >= 2, true);
});

test('validate reports each consistency problem as a warning', () => {
  const bad = GOOD
    .replace('urn:cite2:test:pages.v1.label:|Label', 'urn:cite2:other:x.v1.label:|Label')   // property of undocumented collection; labelling prop undocumented
    .replace('urn:cite2:test:idx.v1:all|urn:cite2:cite', 'urn:cite2:test:nowhere.v1:|urn:cite2:cite') // datamodels target undocumented; relset w/o model
    .replace('urn:cts:greekLit:tlg0012.tlg001.msA:1.3', 'urn:cts:greekLit:tlg9999.tlg001.msZ:1.3'); // no catalog entry
  const w = parseRelease(bad).validate().join('\n');
  assert.match(w, /labelling property .* not documented/);
  assert.match(w, /collection urn:cite2:other:x\.v1: of property .* not documented in citecollections/);
  assert.match(w, /properties of urn:cite2:test:pages\.v1: not documented/);
  assert.match(w, /urn:cite2:test:nowhere\.v1: is neither/);
  assert.match(w, /urn:cite2:test:idx\.v1:all has no entry in datamodels/);
  assert.match(w, /no ctscatalog entry for version urn:cts:greekLit:tlg9999\.tlg001\.msZ:/);
});

test('ragged rows are summarized in one warning per table', () => {
  const r = parseRelease('#!datamodels\nCollection|Model|Label|Description\na|b|c\nd|e|f\n');
  const w = r.validate().filter(m => m.includes("rows do not"));
  assert.equal(w.length, 1);
  assert.match(w[0], /2 of 2 rows/);
});

test('URN helpers', () => {
  assert.equal(isCollectionUrn('urn:cite2:hmt:e3pages.v1:'), true);
  assert.equal(isCollectionUrn('urn:cite2:hmt:e3pages.v1:98r'), false);
  assert.equal(collectionOfObject('urn:cite2:hmt:e3pages.v1:98r'), 'urn:cite2:hmt:e3pages.v1:');
  assert.equal(collectionOfProperty('urn:cite2:citebl:burney86pages.v1.sequence:'), 'urn:cite2:citebl:burney86pages.v1:');
  assert.equal(collectionOfProperty('urn:cite2:hmt:e3pages.v1:98r'), null);
  assert.equal(propertyUrn('urn:cite2:hmt:e3pages.v1:', 'image'), 'urn:cite2:hmt:e3pages.v1.image:');
  assert.equal(ctsWorkOf('urn:cts:greekLit:tlg0012.tlg001.msA.diplomatic:1.1'), 'urn:cts:greekLit:tlg0012.tlg001.msA.diplomatic:');
  assert.equal(ctsVersionOf('urn:cts:greekLit:tlg0012.tlg001.msA.diplomatic:1.1'), 'urn:cts:greekLit:tlg0012.tlg001.msA:');
});

// The real 2024c release is kept in scratch/ (git-ignored); skip if absent.
const REAL = new URL('../scratch/hmt-current.cex', import.meta.url);
test('real release: shape and counts (2024c)', { skip: !existsSync(REAL) }, () => {
  const t0 = Date.now();
  const r = new HmtRelease(readFileSync(REAL, 'utf8'));
  assert.equal(r.cexVersion, '3.0.2');
  assert.match(r.library.name, /Homer Multitext project/);
  assert.equal(r.collections().length, 23);
  assert.equal(r.ctsCatalog().length, 16);
  assert.equal(r.ctsData().length, 80970);
  assert.equal(r.citeData().length, 22);
  assert.equal(r.relationSets().length, 13);
  assert.equal(r.getBlock('ctsdata').length, 80970);
  const warnings = r.validate();
  assert.ok(warnings.length < 100, `unexpectedly many warnings: ${warnings.length}`);
  assert.ok(Date.now() - t0 < 5000, 'parsing should take well under 5 s');
});
