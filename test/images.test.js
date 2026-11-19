import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { parseRelease } from '../src/hmt-release.js';
import {
  imageCollections, imageService, parseInfo, paginate, cellLabel, formatHash, parseHash,
  IMAGE_SERVICE_BASE,
} from '../src/images.js';

const CEX = `#!citelibrary
name|Test
urn|urn:cite2:test:lib.v1:x
license|none
#!datamodels
Collection|Model|Label|Description
urn:cite2:hmt:vaimg.2017a:|urn:cite2:cite:datamodels.v1:imagemodel|Images A|x
urn:cite2:hmt:emptyimg.v1:|urn:cite2:cite:datamodels.v1:imagemodel|Images empty|x
urn:cite2:hmt:pages.v1:|urn:cite2:cite:datamodels.v1:somethingelse|Pages|x
#!citecollections
URN|Description|Labelling property|Ordering property|License
urn:cite2:hmt:vaimg.2017a:|Images of the Venetus A|urn:cite2:hmt:vaimg.2017a.caption:||CC-BY
urn:cite2:hmt:emptyimg.v1:|Aardvark images|urn:cite2:hmt:emptyimg.v1.caption:||PD
urn:cite2:hmt:pages.v1:|Pages|urn:cite2:hmt:pages.v1.label:||PD
#!citedata
urn|caption|rights
urn:cite2:hmt:vaimg.2017a:VA012RN_0013|Venetus A: Marcianus Graecus Z. 454 (= 822).  Photograph in natural light, folio 12, recto.|Rights A
urn:cite2:hmt:vaimg.2017a:VA013RN_0014|Venetus A: Marcianus Graecus Z. 454 (= 822), folio 13, recto.|Rights B
#!citedata
urn|label
urn:cite2:hmt:pages.v1:p1|Page 1
#!citedata
urn|caption|rights
urn:cite2:hmt:vaimg.2017a:VA014RN_0015|Venetus A, inside front cover|Rights C
`;

test('imageCollections: only image-model collections, items merged across blocks, sorted by label', () => {
  const cols = imageCollections(parseRelease(CEX));
  assert.deepEqual(cols.map(c => c.urn), ['urn:cite2:hmt:emptyimg.v1:', 'urn:cite2:hmt:vaimg.2017a:']);
  const va = cols[1];
  assert.equal(va.label, 'Images of the Venetus A');
  assert.equal(va.license, 'CC-BY');
  assert.deepEqual(va.items.map(i => i.id), ['VA012RN_0013', 'VA013RN_0014', 'VA014RN_0015']);
  assert.equal(va.items[0].rights, 'Rights A');
  assert.equal(cols[0].items.length, 0);
});

test('cellLabel: the page part of a caption, else the id', () => {
  assert.equal(cellLabel('Venetus A: Marcianus Graecus Z. 454 (= 822).  Photograph in natural light, folio 82, recto.', 'x'), 'folio 82, recto');
  assert.equal(cellLabel('Marciana 841, folio 1, verso.', 'x'), 'folio 1, verso');
  assert.equal(cellLabel('Image of MS Upsilon 1.1, bifolio containing 1v and 2r', 'x'), 'bifolio containing 1v and 2r');
  assert.equal(cellLabel('Florence, Laurentian Library, codex 32.3, inside front cover', 'x'), 'inside front cover');
  assert.equal(cellLabel('Genève, Ms. gr. 44: Homer (http://www.e-codices.unifr.ch/en/list/one/bge/gr0044), page 7.', 'x'), 'page 7');
  assert.equal(cellLabel('A photograph', 'id_1'), 'id_1');
  assert.equal(cellLabel('', 'id_2'), 'id_2');
});

test('imageService: the HMT convention, as in the Venetus A manifest', () => {
  assert.equal(imageService('urn:cite2:hmt:vaimg.2017a:VA012RN_0013'),
    'http://www.homermultitext.org/iipsrv?IIIF=/project/homer/pyramidal/deepzoom/hmt/vaimg/2017a/VA012RN_0013.tif');
  assert.equal(imageService('urn:cite2:citebl:burney86imgs.v1:burney_ms_86_f001r', 'https://x/'),
    'https://x/citebl/burney86imgs/v1/burney_ms_86_f001r.tif');
  assert.equal(imageService('urn:cite2:hmt:vaimg.2017a:'), null);
  assert.equal(imageService('urn:cts:greekLit:tlg0012.tlg001.msA:1.1'), null);
  assert.ok(IMAGE_SERVICE_BASE.startsWith('http'));
});

test('parseInfo: width and height of an image information document', () => {
  assert.deepEqual(parseInfo({ '@id': 'x', width: 5428, height: 7230 }), { width: 5428, height: 7230 });
  assert.deepEqual(parseInfo({ width: '100', height: '200' }), { width: 100, height: 200 });
  assert.equal(parseInfo({ width: 0, height: 5 }), null);
  assert.equal(parseInfo({}), null);
  assert.equal(parseInfo(null), null);
});

test('paginate: pages, ranges and clamping', () => {
  assert.deepEqual(paginate(966, 24, 1), { page: 1, pages: 41, start: 0, end: 24 });
  assert.deepEqual(paginate(966, 24, 41), { page: 41, pages: 41, start: 960, end: 966 });
  assert.equal(paginate(966, 24, 99).page, 41);
  assert.equal(paginate(966, 24, 0).page, 1);
  assert.equal(paginate(966, 24, NaN).page, 1);
  assert.deepEqual(paginate(0, 24, 1), { page: 1, pages: 1, start: 0, end: 0 });
  assert.deepEqual(paginate(24, 24, 2), { page: 1, pages: 1, start: 0, end: 24 });
});

test('location hash round trip', () => {
  const coll = 'urn:cite2:hmt:vaimg.2017a:';
  const img = 'urn:cite2:hmt:vaimg.2017a:VA012RN_0013';
  assert.deepEqual(parseHash(formatHash({ urn: coll, page: 3 })), { urn: coll, page: 3 });
  assert.equal(formatHash({ urn: coll, page: 1 }), formatHash({ urn: coll }));
  assert.deepEqual(parseHash(formatHash({ urn: img, page: 5 })), { urn: img, page: 1 }); // page only for collections
  assert.deepEqual(parseHash('#urn=' + img), { urn: img, page: 1 });
  assert.deepEqual(parseHash('#urn=' + coll + '&page=0'), { urn: coll, page: 1 });
  assert.equal(parseHash(''), null);
  assert.equal(parseHash('#page=2'), null);
  assert.equal(parseHash('#urn=urn:cts:greekLit:tlg0012.tlg001.msA:1.1'), null);
});

const REAL = new URL('../scratch/hmt-current.cex', import.meta.url);
test('real release: the image collections', { skip: !existsSync(REAL) }, () => {
  const cols = imageCollections(parseRelease(readFileSync(REAL, 'utf8')));
  assert.equal(cols.length, 11);
  const va = cols.find(c => c.urn === 'urn:cite2:hmt:vaimg.2017a:');
  assert.ok(va && va.items.length > 900, 'Venetus A images');
  const total = cols.reduce((n, c) => n + c.items.length, 0);
  assert.ok(total > 5000, `total ${total}`);
  for (const c of cols) {
    for (const i of c.items) {
      assert.ok(imageService(i.urn), `no service for ${i.urn}`);
      assert.ok(i.label.length > 0 && i.label.length <= 48, `label of ${i.urn}: ${i.label}`);
    }
    assert.equal(new Set(c.items.map(i => i.urn)).size, c.items.length, `duplicate images in ${c.urn}`);
  }
  assert.ok(cols.some(c => c.items.length === 0), 'at least one empty collection (e3img)');
});
