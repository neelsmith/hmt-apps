import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { parseRelease } from '../src/hmt-release.js';
import { imageCollections } from '../src/images.js';
import { codices, indexRegionsBySurface, pageView, formatPageQuery, parsePageQuery } from '../src/codices.js';

const IMG = 'urn:cite2:hmt:vaimg.2017a:';
const CEX = `#!datamodels
Collection|Model|Label|Description
urn:cite2:hmt:msA.v1:|urn:cite2:hmt:datamodels.v1:codexmodel|Codex|x
urn:cite2:hmt:e3pages.v1:|urn:cite2:hmt:datamodels.v1:codexmodel|Codex|x
urn:cite2:hmt:vaimg.2017a:|urn:cite2:cite:datamodels.v1:imagemodel|Images|x
#!citecollections
URN|Description|Labelling property|Ordering property|License
urn:cite2:hmt:msA.v1:|Venetus A manuscript|urn:cite2:hmt:msA.v1.label:|urn:cite2:hmt:msA.v1.sequence:|CC
urn:cite2:hmt:e3pages.v1:|Escorial Y 1.1 manuscript|urn:cite2:hmt:e3pages.v1.label:|urn:cite2:hmt:e3pages.v1.sequence:|CC
urn:cite2:hmt:vaimg.2017a:|Venetus A images|urn:cite2:hmt:vaimg.2017a.caption:||CC
#!citedata
sequence|urn|rv|label|image
2|urn:cite2:hmt:msA.v1:1v|verso|Venetus A, folio 1, verso|${IMG}I1V
1|urn:cite2:hmt:msA.v1:1r|recto|Venetus A, folio 1, recto|${IMG}I1R
3|urn:cite2:hmt:msA.v1:2r|recto|Venetus A, folio 2, recto|${IMG}I2R
-1|urn:cite2:hmt:msA.v1:ir|recto|Venetus A, folio i, recto|${IMG}II
#!citedata
sequence|image|urn|rv|label
1|urn:cite2:hmt:e3bifolio.v1:B1|urn:cite2:hmt:e3pages.v1:1v|verso|Escorial, folio 1 verso
#!citedata
urn|caption|rights
${IMG}I1V|folio 1, verso|r
${IMG}I1R|folio 1, recto|r
${IMG}I1R_ALT|folio 1, recto, second scan|r
${IMG}I2R|folio 2, recto|r
${IMG}II|folio i, recto|r
#!citerelationset
urn|urn:cite2:hmt:hmtdse.v1:all
label|DSE

passage|imageroi|surface
urn:cts:greekLit:tlg0012.tlg001.msA:1.1|${IMG}I1R@0.1,0.1,0.2,0.2|urn:cite2:hmt:msA.v1:1r
urn:cts:greekLit:tlg0012.tlg001.msA:1.2|${IMG}I1R@0.1,0.4,0.2,0.2|urn:cite2:hmt:msA.v1:1r
urn:cts:greekLit:tlg0012.tlg001.msA:1.3|${IMG}I1R_ALT@0.1,0.5,0.2,0.2|urn:cite2:hmt:msA.v1:1r
urn:cts:greekLit:tlg0012.tlg001.msA:1.4|${IMG}I1R@bad|urn:cite2:hmt:msA.v1:1r
urn:cts:greekLit:tlg0012.tlg001.msA:2.1|urn:cite2:hmt:msA.v1:2r|urn:cite2:hmt:msA.v1:2r
urn:cts:greekLit:tlg0012.tlg001.msA:3.1|${IMG}I2R@0.1,0.1,0.2,0.2|
`;
const rel = parseRelease(CEX);
const cx = codices(rel);

test('codices: collections with the codex model, ordered by label, pages in sequence', () => {
  assert.deepEqual(cx.map(c => c.label), ['Escorial Y 1.1 manuscript', 'Venetus A manuscript']);
  const va = cx[1];
  assert.deepEqual(va.pages.map(p => p.id), ['ir', '1r', '1v', '2r']);    // by sequence, not release order
  assert.equal(va.pages[1].short, 'folio 1, recto');
  assert.equal(va.pages[1].image, `${IMG}I1R`);
  assert.equal(cx[0].pages.length, 1);                                    // column order differs in the e3 block
  assert.equal(cx[0].pages[0].image, 'urn:cite2:hmt:e3bifolio.v1:B1');
});

test('indexRegionsBySurface: regions by page; unusable records are counted', () => {
  const idx = indexRegionsBySurface(rel);
  assert.equal(idx.found, true);
  assert.equal(idx.rows, 6);
  assert.equal(idx.skipped, 3);               // bad region, no @, no surface
  assert.deepEqual(idx.bySurface.get('urn:cite2:hmt:msA.v1:1r').map(r => r.passage.split(':')[4]), ['1.1', '1.2', '1.3']);
  assert.equal(indexRegionsBySurface(parseRelease('#!ctsdata\n')).found, false);
});

test('pageView: the image of the DSE records, most frequent among catalog images', () => {
  const idx = indexRegionsBySurface(rel);
  const cat = new Set([`${IMG}I1V`, `${IMG}I1R`, `${IMG}I1R_ALT`, `${IMG}I2R`, `${IMG}II`]);
  const p1r = cx[1].pages[1];
  const v = pageView(p1r, idx.bySurface.get(p1r.urn), cat);
  assert.equal(v.image, `${IMG}I1R`);
  assert.equal(v.regions.length, 2);
  assert.equal(v.elsewhere, 1);
  assert.equal(v.source, 'dse');
  // a record's image can differ from the catalog's page image: the record wins
  const odd = pageView({ ...p1r, image: `${IMG}I1V` }, idx.bySurface.get(p1r.urn), cat);
  assert.equal(odd.image, `${IMG}I1R`);
});

test('pageView: no usable DSE image falls back to the catalog image, without regions', () => {
  const cat = new Set([`${IMG}I2R`]);
  const page = { urn: 'u', id: '2r', label: '', short: '', sequence: 1, image: `${IMG}I2R` };
  const surfaceAsImage = [{ passage: 'p', image: 'urn:cite2:hmt:msA.v1:2r', roi: { x: 0, y: 0, w: 1, h: 1 } }];
  assert.deepEqual(pageView(page, surfaceAsImage, cat), { image: `${IMG}I2R`, regions: [], elsewhere: 1, source: 'catalog' });
  assert.deepEqual(pageView(page, [], cat), { image: `${IMG}I2R`, regions: [], elsewhere: 0, source: 'catalog' });
  assert.equal(pageView({ ...page, image: '' }, [], cat).source, 'none');
});

test('address of a page', () => {
  const urn = 'urn:cite2:hmt:msA.v1:12r';
  assert.equal(formatPageQuery(urn), '?page=' + urn);
  assert.equal(parsePageQuery(formatPageQuery(urn)), urn);
  assert.equal(parsePageQuery(''), null);
  assert.equal(parsePageQuery('?page=notaurn'), null);
  assert.equal(parsePageQuery('?urn=' + urn), null, 'the old name is not read');
  assert.equal(parsePageQuery('#page=' + urn), null, 'nor a # fragment');
});

const REAL = new URL('../scratch/hmt-current.cex', import.meta.url);
test('real release: seven codices; Venetus A and Escorial have regions', { skip: !existsSync(REAL) }, () => {
  const r = parseRelease(readFileSync(REAL, 'utf8'));
  const c = codices(r);
  assert.equal(c.length, 7);
  assert.equal(c.reduce((n, x) => n + x.pages.length, 0), 4254);
  const va = c.find(x => x.urn === 'urn:cite2:hmt:msA.v1:');
  assert.equal(va.pages.length, 662);
  assert.equal(va.pages[0].id, 'insidefrontcover');
  const idx = indexRegionsBySurface(r);
  assert.ok(idx.bySurface.get('urn:cite2:hmt:msA.v1:12r').length > 10);
  const cat = new Set(imageCollections(r).flatMap(x => x.items.map(i => i.urn)));
  // folio 83r: the DSE records use a different scan from the catalog's page image
  const p83 = va.pages.find(p => p.id === '83r');
  const v = pageView(p83, idx.bySurface.get(p83.urn), cat);
  assert.equal(v.image, 'urn:cite2:hmt:vaimg.2017a:VA083RN_0255');
  assert.notEqual(v.image, p83.image);
  // folio 91r: one record names the surface as its image, with no region: it is skipped
  const p91 = va.pages.find(p => p.id === '91r');
  const v91 = pageView(p91, idx.bySurface.get(p91.urn), cat);
  assert.equal(v91.image, 'urn:cite2:hmt:vaimg.2017a:VA091RN_0263');
  assert.equal(v91.elsewhere, 0);
  assert.ok(idx.skipped >= 1);
});
