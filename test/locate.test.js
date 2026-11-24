import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { parseRelease } from '../src/hmt-release.js';
import { buildTextIndex } from '../src/text-index.js';
import { iliadVersions, commentaryPairs, iliadRangeOf } from '../src/iliad-scholia.js';
import { firstPassageKey, createLocator, resolvePage, resolveImage } from '../src/locate.js';

const IMG = 'urn:cite2:hmt:vaimg.2017a:';
const MSA = 'urn:cts:greekLit:tlg0012.tlg001.msA:';
const CEX = `#!ctscatalog
urn|citationScheme|groupName|workTitle|versionLabel|exemplarLabel|online|language
${MSA}|book/line|Homer|Iliad|Venetus A||true|grc
${MSA.replace(/:$/, '.diplomatic:')}|book/line|Homer|Iliad|Venetus A|diplomatic|true|grc
urn:cts:greekLit:tlg5026.msAint.hmt:|book,scholion,part|Scholia|Interior scholia|HMT||true|grc
urn:cts:greekLit:tlg5026.msAint.hmt.diplomatic:|book,scholion,part|Scholia|Interior scholia|HMT|diplomatic|true|grc
#!ctsdata
${MSA}1.1|a
${MSA}1.2|b
${MSA}1.3|c
${MSA}2.1|d
${MSA}2.2|e
urn:cts:greekLit:tlg5026.msAint.hmt:2.1.comment|s
urn:cts:greekLit:tlg5026.msAint.hmt:5.1.comment|t
#!datamodels
Collection|Model|Label|Description
urn:cite2:hmt:msA.v1:|urn:cite2:hmt:datamodels.v1:codexmodel|Codex|x
${IMG}|urn:cite2:cite:datamodels.v1:imagemodel|Images|x
urn:cite2:hmt:commentary.v1:all|urn:cite2:cite:datamodels.v1:commentarymodel|Commentary|x
#!citecollections
URN|Description|Labelling property|Ordering property|License
urn:cite2:hmt:msA.v1:|Venetus A manuscript|urn:cite2:hmt:msA.v1.label:|urn:cite2:hmt:msA.v1.sequence:|CC
${IMG}|Venetus A images|${IMG.replace(/:$/, '.caption:')}||CC
#!citedata
sequence|urn|rv|label|image
1|urn:cite2:hmt:msA.v1:1r|recto|Venetus A, folio 1, recto|${IMG}I1R
2|urn:cite2:hmt:msA.v1:1v|verso|Venetus A, folio 1, verso|${IMG}I1V
3|urn:cite2:hmt:msA.v1:2r|recto|Venetus A, folio 2, recto|${IMG}I2R
4|urn:cite2:hmt:msA.v1:2v|verso|Venetus A, folio 2, verso|${IMG}I2V
#!citedata
urn|caption|rights
${IMG}I1R|folio 1, recto|r
${IMG}I1V|folio 1, verso|r
${IMG}I2R|folio 2, recto|r
${IMG}I2V|folio 2, verso|r
#!citerelationset
urn|urn:cite2:hmt:commentary.v1:all
label|Commentary

scholion|iliad
urn:cts:greekLit:tlg5026.msAint.hmt:2.1|${MSA}1.3-2.1
urn:cts:greekLit:tlg5026.msAint.hmt:5.1|${MSA}1.1
#!citerelationset
urn|urn:cite2:hmt:hmtdse.v1:all
label|DSE

passage|imageroi|surface
${MSA}1.1|${IMG}I1R@0.1,0.1,0.2,0.2|urn:cite2:hmt:msA.v1:1r
${MSA}1.2|${IMG}I1R@0.1,0.3,0.2,0.2|urn:cite2:hmt:msA.v1:1r
${MSA}1.3|${IMG}I1V@0.1,0.3,0.2,0.2|urn:cite2:hmt:msA.v1:1v
${MSA}2.1|${IMG}I1V@0.1,0.5,0.2,0.2|urn:cite2:hmt:msA.v1:1v
urn:cts:greekLit:tlg5026.msAint.hmt:2.1.comment|${IMG}I2R@0.1,0.1,0.2,0.2|urn:cite2:hmt:msA.v1:2r
urn:cts:greekLit:tlg5026.msAint.hmt:2.1.lemma|${IMG}I2R@0.1,0.3,0.2,0.2|urn:cite2:hmt:msA.v1:2r
`;
const rel = parseRelease(CEX);
const loc = createLocator(rel);

test('firstPassageKey: the DSE key of a passage, or of the start of a range', () => {
  assert.equal(firstPassageKey(MSA + '1.1'), MSA + '1.1');
  assert.equal(firstPassageKey(MSA.replace(/:$/, '.normalized:') + '1.2-1.10'), MSA + '1.2');
  assert.equal(firstPassageKey(MSA + '1.2–1.10'), MSA + '1.2', 'en dash');
  assert.equal(firstPassageKey(MSA + '1.1@μῆνιν'), MSA + '1.1');
  assert.equal(firstPassageKey('urn:cts:greekLit:tlg5026.msAint.hmt:2.1.comment'), 'urn:cts:greekLit:tlg5026.msAint.hmt:2.1');
  assert.equal(firstPassageKey(MSA), null, 'a version has no passage');
  assert.equal(firstPassageKey('nonsense'), null);
  assert.equal(firstPassageKey(''), null);
});

test('page <-> image', () => {
  assert.equal(loc.isPage('urn:cite2:hmt:msA.v1:1r'), true);
  assert.equal(loc.isPage('urn:cite2:hmt:msA.v1:9r'), false);
  assert.equal(loc.imageOfPage('urn:cite2:hmt:msA.v1:1r'), IMG + 'I1R');
  assert.equal(loc.imageOfPage('urn:cite2:hmt:msA.v1:2v'), IMG + 'I2V', 'a page without DSE records: the catalogue image');
  assert.equal(loc.imageOfPage('urn:cite2:hmt:msA.v1:nope'), '');
  assert.deepEqual(loc.pagesOfImage(IMG + 'I1V'), ['urn:cite2:hmt:msA.v1:1v']);
  assert.deepEqual(loc.pagesOfImage(IMG + 'NOPE'), []);
});

test('passage -> page and image, from the DSE', () => {
  assert.deepEqual(loc.pagesOfPassage(MSA + '1.3'), ['urn:cite2:hmt:msA.v1:1v']);
  assert.deepEqual(loc.pagesOfPassage(MSA + '1.1-1.3'), ['urn:cite2:hmt:msA.v1:1r'], 'a range: its first passage');
  assert.deepEqual(loc.imagesOfPassage(MSA.replace(/:$/, '.diplomatic:') + '2.1'), [IMG + 'I1V']);
  assert.deepEqual(loc.pagesOfPassage('urn:cts:greekLit:tlg5026.msAint.hmt:2.1.comment'), ['urn:cite2:hmt:msA.v1:2r']);
  assert.deepEqual(loc.pagesOfPassage(MSA + '2.2'), [], 'not indexed');
  assert.deepEqual(loc.pagesOfPassage('nonsense'), []);
});

test('passages on a page or an image, in index order and without repeats', () => {
  assert.deepEqual(loc.passagesOnPage('urn:cite2:hmt:msA.v1:1r'), [MSA + '1.1', MSA + '1.2']);
  assert.deepEqual(loc.passagesOnPage('urn:cite2:hmt:msA.v1:2r'), ['urn:cts:greekLit:tlg5026.msAint.hmt:2.1']);
  assert.deepEqual(loc.passagesOnImage(IMG + 'I1V'), [MSA + '1.3', MSA + '2.1']);
  assert.deepEqual(loc.passagesOnPage('urn:cite2:hmt:msA.v1:2v'), []);
});

test('iliadRangeOf: the Iliad lines on a page as a range; for a page of scholia only, what they comment on', () => {
  const ti = buildTextIndex(rel), versions = iliadVersions(rel, ti), pairs = commentaryPairs(rel);
  const range = keys => iliadRangeOf(keys, versions, ti, pairs);
  assert.deepEqual(range(loc.passagesOnPage('urn:cite2:hmt:msA.v1:1r')), { text: MSA + '1.1-1.2' });
  assert.deepEqual(range(loc.passagesOnImage(IMG + 'I1V')), { text: MSA + '1.3-2.1' }, 'across books');
  assert.deepEqual(range([MSA + '2.2']), { text: MSA + '2.2' }, 'one line');
  assert.deepEqual(range(loc.passagesOnPage('urn:cite2:hmt:msA.v1:2r')), { text: MSA + '1.3-2.1' }, 'only a scholion, indexed to 1.3-2.1');
  assert.ok('error' in range([]));
  assert.ok('error' in range([MSA + '9.9']), 'a line the text does not have');
  assert.ok('error' in range(['urn:cts:greekLit:tlg5026.msAint.hmt:7.7']), 'a scholion that is not indexed');
});

test('resolvePage and resolveImage: precedence and errors', () => {
  const P = 'urn:cite2:hmt:msA.v1:';
  const n = { text: null, page: null, image: null };
  assert.equal(resolvePage(loc, n), null);
  assert.equal(resolveImage(loc, n), null);
  assert.deepEqual(resolvePage(loc, { ...n, page: P + '2r', image: IMG + 'I1R' }), { page: P + '2r' }, 'page beats image');
  assert.deepEqual(resolvePage(loc, { ...n, image: IMG + 'I1V', text: MSA + '1.1' }), { page: P + '1v' }, 'image beats text');
  assert.deepEqual(resolvePage(loc, { ...n, text: MSA + '1.2' }), { page: P + '1r' });
  assert.deepEqual(resolvePage(loc, { ...n, page: P + '9r', text: MSA + '1.2' }), { page: P + '1r' }, 'a bad page falls through');
  assert.ok('error' in resolvePage(loc, { ...n, text: MSA + '2.2' }));
  assert.deepEqual(resolveImage(loc, { ...n, image: IMG + 'X', page: P + '1r' }), { image: IMG + 'X' }, 'image as given');
  assert.deepEqual(resolveImage(loc, { ...n, page: P + '1v', text: MSA + '1.1' }), { image: IMG + 'I1V' });
  assert.deepEqual(resolveImage(loc, { ...n, text: MSA + '1.1' }), { image: IMG + 'I1R' });
  assert.ok('error' in resolveImage(loc, { ...n, text: MSA + '2.2' }));
});

const REAL = new URL('../scratch/hmt-current.cex', import.meta.url);
test('on the real release', { skip: !existsSync(REAL) }, () => {
  const r = parseRelease(readFileSync(REAL, 'utf8'));
  const l = createLocator(r);
  const ti = buildTextIndex(r);
  const P = 'urn:cite2:hmt:msA.v1:12r';
  assert.ok(l.isPage(P));
  const image = l.imageOfPage(P);
  assert.match(image, /^urn:cite2:hmt:vaimg\.2017a:VA012RN_0013$/);
  assert.ok(l.pagesOfImage(image).includes(P));
  assert.deepEqual(l.pagesOfPassage('urn:cts:greekLit:tlg0012.tlg001.msA:1.1'), [P]);
  assert.ok(l.imagesOfPassage('urn:cts:greekLit:tlg0012.tlg001.msA:1.1-1.10').includes(image));
  const out = iliadRangeOf(l.passagesOnPage(P), iliadVersions(r, ti), ti, commentaryPairs(r));
  assert.ok('text' in out && out.text.startsWith('urn:cts:greekLit:tlg0012.tlg001.msA:1.'), JSON.stringify(out));
});
