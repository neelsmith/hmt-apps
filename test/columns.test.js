import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRelease } from '../src/hmt-release.js';
import { buildTextIndex } from '../src/text-index.js';
import { iliadVersions, commentaryPairs } from '../src/iliad-scholia.js';
import { createColumns, compareLines } from '../src/columns.js';

const A = 'urn:cts:greekLit:tlg0012.tlg001.msA', B = 'urn:cts:greekLit:tlg0012.tlg001.msB', C = 'urn:cts:greekLit:tlg0012.tlg001.msC';
const S = 'urn:cts:greekLit:tlg5026.msAint.hmt';
const CEX = `#!ctscatalog
urn|citationScheme|groupName|workTitle|versionLabel|exemplarLabel|online|language
${A}:|book,line|Homeric poetry|Iliad|Venetus A||true|grc
${B}:|book,line|Homeric poetry|Iliad|Venetus B||true|grc
${C}:|book,line|Homeric poetry|Iliad|Town C||true|grc
${S}:|book,scholion|Scholia|Interior scholia|HMT||true|grc
#!datamodels
Collection|Model|Label|Description
urn:cite2:hmt:commentary.v1:all|urn:cite2:cite:datamodels.v1:commentarymodel|Commentary|x
#!ctsdata
${A}.normalized:1.1|μῆνιν ἄειδε θεὰ
${A}.normalized:1.2|οὐλομένην ἣ μυρί
${A}.normalized:1.3|πολλὰς δ᾽ ἰφθίμους
${A}.diplomatic:1.1|μηνιν αειδε θεα
${A}.diplomatic:1.2|ουλομενην ε μυρι
${B}.normalized:1.1|μῆνιν ἄειδε θεὰ
${B}.normalized:1.2|οὐλομένην μυρί ἀχαιοῖς
${B}.diplomatic:1.2|ουλομενην μυρι αχαιοις
${C}.normalized:1.2|οὐλομένην ἣ μυρί
${C}.normalized:7.1|ἄλλο
${S}.normalized:1.10.lemma|lemma A
${S}.normalized:1.10.comment|comment on A
${S}.normalized:1.11.lemma|lemma B
${S}.normalized:1.11.comment|comment on B
#!citerelationset
urn|urn:cite2:hmt:commentary.v1:all
label|Commentary

scholion|iliad
${S}:1.10|${A}:1.1
${S}:1.11|${B}:1.2
`;

function setup() {
  const rel = parseRelease(CEX);
  const ti = buildTextIndex(rel);
  const versions = iliadVersions(rel, ti);
  return { build: createColumns(versions, ti, commentaryPairs(rel)), versions };
}

test('columns: the reference first, then every other version that has a line of the passage', () => {
  const { build } = setup();
  const r = build(`${A}:`, 'normalized', '1.1-1.2');
  assert.deepEqual(r.refs, ['1.1', '1.2']);
  assert.deepEqual(r.columns.map(c => c.label), ['Venetus A', 'Venetus B', 'Town C']);
  assert.deepEqual([...r.columns[1].lines.keys()], ['1.1', '1.2']);
  assert.deepEqual([...r.columns[2].lines.keys()], ['1.2'], 'a version lacking a line has no entry for it');
});

test('columns: a version with none of the lines has no column', () => {
  const { build } = setup();
  const r = build(`${A}:`, 'normalized', '1.1');
  assert.deepEqual(r.columns.map(c => c.label), ['Venetus A', 'Venetus B']);
});

test('columns: words that differ from the reference', () => {
  const { build } = setup();
  const r = build(`${A}:`, 'normalized', '1.1-1.2');
  assert.equal(r.columns[0].lines.get('1.2').segments, null, 'reference: nothing marked');
  assert.deepEqual(r.columns[1].lines.get('1.1').segments, [{ text: 'μῆνιν ἄειδε θεὰ' }], 'identical');
  assert.deepEqual(r.columns[1].lines.get('1.2').segments, [{ text: 'οὐλομένην' }, { base: 'ἣ', alt: '' }, { text: 'μυρί' }, { base: '', alt: 'ἀχαιοῖς' }]);
  assert.equal(r.columns[1].different, 1);
  assert.equal(r.columns[2].different, 0);
});

test('columns: scholia go with the version they comment on', () => {
  const { build } = setup();
  const r = build(`${A}:`, 'normalized', '1.1-1.2');
  assert.deepEqual(r.columns[0].lines.get('1.1').scholia, [`${S}:1.10`]);
  assert.deepEqual(r.columns[1].lines.get('1.1').scholia, []);
  assert.deepEqual(r.columns[1].lines.get('1.2').scholia, [`${S}:1.11`]);
  assert.deepEqual(r.columns[0].lines.get('1.2').scholia, []);
  assert.equal(r.scholiaTotal, 2);
});

test('columns: the requested kind of text, else the version\'s first', () => {
  const { build } = setup();
  const r = build(`${A}:`, 'diplomatic', '1.2');
  assert.equal(r.columns[0].kind, 'diplomatic');
  assert.equal(r.columns[0].lines.get('1.2').text, 'ουλομενην ε μυρι');
  assert.equal(r.columns[1].kind, 'diplomatic');
  assert.equal(r.columns[2].kind, 'normalized', 'Town C has only a normalized text');
});

test('columns: errors', () => {
  const { build } = setup();
  assert.ok('error' in build(`${A}:`, 'normalized', '9.9'));
  assert.ok('error' in build('urn:cts:greekLit:nope:', 'normalized', '1.1'));
});

test('compareLines: punctuation is ignored, and each text keeps its own', () => {
  assert.deepEqual(compareLines('ἄειδε θεὰ Πηληϊάδεω', 'ἄειδε, θεὰ· Πηληϊάδεω.'), [{ text: 'ἄειδε, θεὰ· Πηληϊάδεω.' }]);
  assert.deepEqual(compareLines('δ᾽ ἰφθίμους', 'δ’ ἰφθίμους'), [{ text: 'δ’ ἰφθίμους' }], 'elision marks');
  assert.deepEqual(compareLines('οὐλομένην, ἣ μυρί', 'οὐλομένην μυρί, ἀχαιοῖς.'),
    [{ text: 'οὐλομένην' }, { base: 'ἣ', alt: '' }, { text: 'μυρί,' }, { base: '', alt: 'ἀχαιοῖς.' }]);
  assert.deepEqual(compareLines('· ἄειδε', '· ἄειδε'), [{ text: '· ἄειδε' }], 'a word of punctuation only');
  assert.deepEqual(compareLines('ἄειδε θεὰ', 'ἄειδε θεά'), [{ text: 'ἄειδε' }, { base: 'θεὰ', alt: 'θεά' }], 'accents still count');
});

test('compareLines: case is ignored, accents are not', () => {
  assert.deepEqual(compareLines('Μῆνιν ἄειδε Θεὰ', 'μῆνιν ἄειδε θεὰ'), [{ text: 'μῆνιν ἄειδε θεὰ' }], 'capital vs small');
  assert.deepEqual(compareLines('ΜΗΝΙΝ αειδε', 'μηνιν αειδε'), [{ text: 'μηνιν αειδε' }], 'all capitals');
  assert.deepEqual(compareLines('Μῆνιν', 'μηνιν'), [{ base: 'Μῆνιν', alt: 'μηνιν' }], 'accents still count');
});
