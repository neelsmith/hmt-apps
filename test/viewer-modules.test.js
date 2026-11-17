import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRelease } from '../src/hmt-release.js';
import { buildTextIndex, textsOfVersion, passageText } from '../src/text-index.js';
import { imageUrnFromService, parseManifest, iiifImageUrl, matchProtocol } from '../src/iiif.js';
import { parseRoi, parseImageRoi, indexDse, passageKind, passageLabel, catalogTitles, DSE_URN } from '../src/dse.js';
import {
  fitTransform, clampTransform, zoomAt, maxLevel, chooseLevel, visibleTiles, roiToRect, imageToScreen, MAX_SCALE,
} from '../src/pan-zoom.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

// ---- iiif.js --------------------------------------------------------------

const SVC = 'http://www.homermultitext.org/iipsrv?IIIF=/project/homer/pyramidal/deepzoom/hmt/vaimg/2017a/';
const canvas = (id, label, file, w = 5428, h = 7230) => ({
  id: `canvases/${id}`, type: 'Canvas', label: { en: [label] }, height: h, width: w,
  items: [{ id: `annotations/${id}`, type: 'AnnotationPage', items: [{
    id: `annotations/${id}`, type: 'Annotation', motivation: 'painting',
    body: { id: `${SVC}${file}.tif/full/2000,/0/default.jpg`, type: 'Image', format: 'image/jpeg', height: h, width: w },
    target: `canvases/${id}`,
    service: [{ id: `${SVC}${file}.tif`, profile: 'level1', type: 'ImageService2' }],
  }] }],
});
const MANIFEST = {
  '@context': 'http://iiif.io/api/presentation/3/context.json', type: 'Manifest',
  label: { en: ['Venetus A manuscript'] },
  items: [
    canvas('insidefrontcover', 'Venetus A (Marciana 454 = 822), inside front cover', 'VAMSInside_front_cover_versoN_0500'),
    canvas('1r', 'Venetus A (Marciana 454 = 822), folio 1, recto', 'VA001RN_0002'),
    canvas('12v', 'Venetus A (Marciana 454 = 822), folio 12, verso', 'VA012VN_0013'),
    { id: 'canvases/broken', type: 'Canvas', label: { en: ['x'] }, items: [] },
  ],
};

test('imageUrnFromService maps hmt/<coll>/<version>/<id>.tif to a CITE2 URN', () => {
  assert.equal(imageUrnFromService(`${SVC}VA012RN_0013.tif`), 'urn:cite2:hmt:vaimg.2017a:VA012RN_0013');
  assert.equal(imageUrnFromService('https://example.org/other.jpg'), null);
});

test('parseManifest reads canvases, labels, sizes, services and URNs', () => {
  const m = parseManifest(MANIFEST);
  assert.equal(m.label, 'Venetus A manuscript');
  assert.equal(m.skipped, 1);
  assert.deepEqual(m.canvases.map(c => c.id), ['insidefrontcover', '1r', '12v']);
  assert.deepEqual(m.canvases.map(c => c.label), ['inside front cover', 'folio 1, recto', 'folio 12, verso']);
  assert.deepEqual(m.canvases.map(c => c.gridLabel), ['inside front cover', '1r', '12v']);
  assert.equal(m.canvases[1].fullLabel, 'Venetus A (Marciana 454 = 822), folio 1, recto');
  assert.equal(m.canvases[1].width, 5428);
  assert.equal(m.canvases[1].service, `${SVC}VA001RN_0002.tif`);
  assert.equal(m.canvases[2].imageUrn, 'urn:cite2:hmt:vaimg.2017a:VA012VN_0013');
});

test('parseManifest tolerates an empty or odd manifest', () => {
  assert.deepEqual(parseManifest({}).canvases, []);
  assert.deepEqual(parseManifest(null).canvases, []);
});

test('IIIF URLs', () => {
  assert.equal(iiifImageUrl('http://h/x.tif', '0,0,512,512', '256,'), 'http://h/x.tif/0,0,512,512/256,/0/default.jpg');
  assert.equal(matchProtocol('http://h/x', 'https:'), 'https://h/x');
  assert.equal(matchProtocol('http://h/x', 'file:'), 'http://h/x');
  assert.equal(matchProtocol('http://h/x', 'http:'), 'http://h/x');
});

// ---- dse.js ---------------------------------------------------------------

test('parseRoi accepts whitespace, rejects bad regions', () => {
  assert.deepEqual(parseRoi('0.0611,0.2252,0.4675,0.0901'), { x: 0.0611, y: 0.2252, w: 0.4675, h: 0.0901 });
  assert.deepEqual(parseRoi('0.23894620,0.66639004 ,0.20891673,0.07053942'),
    { x: 0.2389462, y: 0.66639004, w: 0.20891673, h: 0.07053942 });
  assert.equal(parseRoi('0.1,0.1,0.2'), null);
  assert.equal(parseRoi('a,b,c,d'), null);
  assert.equal(parseRoi('0.1,0.1,0,0.2'), null);
  assert.equal(parseRoi('0.9,0.1,0.5,0.2'), null);       // runs off the image
  assert.equal(parseRoi('-0.1,0.1,0.2,0.2'), null);
  const clipped = parseRoi('0.89941046,0.17980636,0.10464259,0.07441217');   // real row: x+w = 1.004, clipped
  close(clipped.x + clipped.w, 1);
  assert.equal(parseRoi('0.9,0.1,0.15,0.2'), null);           // 5% outside: not a rounding error
});

test('parseImageRoi', () => {
  assert.deepEqual(parseImageRoi('urn:cite2:hmt:vaimg.2017a:VA012RN_0013@0.0611,0.2252,0.4675,0.0901'),
    { image: 'urn:cite2:hmt:vaimg.2017a:VA012RN_0013', roi: { x: 0.0611, y: 0.2252, w: 0.4675, h: 0.0901 } });
  assert.equal(parseImageRoi('urn:cite2:hmt:msA.v1:91r'), null);
  assert.equal(parseImageRoi('urn:cite2:hmt:vaimg.2017a:X@junk'), null);
});

const REL = `#!datamodels
Collection|Model|Label|Description
${DSE_URN}|urn:cite2:cite:datamodels.v1:dsemodel|DSE|x
#!citerelationset
urn|${DSE_URN}
label|DSE

passage|imageroi|surface
urn:cts:greekLit:tlg0012.tlg001.msA:1.1|urn:cite2:hmt:vaimg.2017a:VA001RN_0002@0.1,0.2,0.3,0.04|urn:cite2:hmt:msA.v1:1r
urn:cts:greekLit:tlg0012.tlg001.msA:1.2|urn:cite2:hmt:vaimg.2017a:VA001RN_0002@0.1,0.25,0.3,0.04|urn:cite2:hmt:msA.v1:1r
urn:cts:greekLit:tlg5026.msAint.hmt:1.28|urn:cite2:hmt:vaimg.2017a:VA012VN_0013@0.5,0.5,0.1,0.1|urn:cite2:hmt:msA.v1:12v
urn:cts:greekLit:tlg0012.tlg001.e3:8.1|urn:cite2:hmt:e3bifolio.v1:E3_97bisv_98r@0.5,0.3,0.2,0.04|urn:cite2:hmt:e3pages.v1:98r
urn:cts:greekLit:tlg5026.msA.hmt:7.4|urn:cite2:hmt:msA.v1:91r|urn:cite2:hmt:msA.v1:91r
#!ctscatalog
urn|citationScheme|groupName|workTitle|versionLabel|exemplarLabel|online|language
urn:cts:greekLit:tlg7000.tlg001.msA:|book,poem,line|Anthology|Selected poems|Poems||true|grc
#!ctsdata
urn:cts:greekLit:tlg0012.tlg001.msA.diplomatic:1.1|dipl one
urn:cts:greekLit:tlg0012.tlg001.msA.normalized:1.1|norm one
urn:cts:greekLit:tlg5026.msAint.hmt.diplomatic:1.28.lemma|the lemma
urn:cts:greekLit:tlg5026.msAint.hmt.diplomatic:1.28.comment|the comment
urn:cts:greekLit:tlg7000.tlg001.msA.diplomatic:9.387.title|poem title
`;

test('indexDse groups regions by image and skips unusable rows', () => {
  const d = indexDse(parseRelease(REL));
  assert.equal(d.found, true);
  assert.equal(d.rows, 5);
  assert.equal(d.skipped, 1);
  assert.deepEqual([...d.byImage.keys()].sort(), [
    'urn:cite2:hmt:e3bifolio.v1:E3_97bisv_98r', 'urn:cite2:hmt:vaimg.2017a:VA001RN_0002', 'urn:cite2:hmt:vaimg.2017a:VA012VN_0013']);
  assert.equal(d.byImage.get('urn:cite2:hmt:vaimg.2017a:VA001RN_0002').length, 2);
  assert.equal(indexDse(parseRelease('')).found, false);
});

test('passageKind and passageLabel', () => {
  const titles = catalogTitles(parseRelease(REL));
  assert.equal(passageKind('urn:cts:greekLit:tlg0012.tlg001.msA:1.1'), 'iliad');
  assert.equal(passageKind('urn:cts:greekLit:tlg5026.msAint.hmt:1.28'), 'scholia');
  assert.equal(passageKind('urn:cts:greekLit:tlg7000.tlg001.msA:9.387.title'), 'other');
  assert.equal(passageLabel('urn:cts:greekLit:tlg0012.tlg001.msA:5.506'), 'Iliad 5.506');
  assert.equal(passageLabel('urn:cts:greekLit:tlg5026.msAint.hmt:1.28'), 'Scholion 1.28 (interior)');
  assert.equal(passageLabel('urn:cts:greekLit:tlg5026.msA.hmt:7.4'), 'Scholion 7.4 (main)');
  assert.equal(passageLabel('urn:cts:greekLit:tlg7000.tlg001.msA:9.387.title', titles), 'Selected poems 9.387.title');
});

// ---- text-index.js: passage text -------------------------------------------

test('passageText: kind preference, scholia parts, fallbacks', () => {
  const idx = buildTextIndex(parseRelease(REL));
  const il = 'urn:cts:greekLit:tlg0012.tlg001.msA:1.1';
  assert.deepEqual(passageText(idx, il, 'diplomatic').parts, [{ part: '', text: 'dipl one' }]);
  assert.deepEqual(passageText(idx, il, 'normalized').parts, [{ part: '', text: 'norm one' }]);
  assert.deepEqual(passageText(idx, 'urn:cts:greekLit:tlg5026.msAint.hmt:1.28', 'normalized').parts,
    [{ part: 'lemma', text: 'the lemma' }, { part: 'comment', text: 'the comment' }]); // only diplomatic exists
  assert.deepEqual(passageText(idx, 'urn:cts:greekLit:tlg7000.tlg001.msA:9.387.title', 'diplomatic').parts,
    [{ part: '', text: 'poem title' }]);
  assert.deepEqual(passageText(idx, 'urn:cts:greekLit:tlg0012.tlg001.msA:99.99', 'diplomatic').parts, []);
  assert.deepEqual(passageText(idx, 'junk', 'diplomatic').parts, []);
  assert.deepEqual(textsOfVersion(idx, 'urn:cts:greekLit:tlg0012.tlg001.msA:').map(t => t.kind), ['normalized', 'diplomatic']);
});

// ---- pan-zoom.js ----------------------------------------------------------

const IW = 5428, IH = 7230;

test('fitTransform centres and fits', () => {
  const t = fitTransform(1000, 800, IW, IH, 8);
  close(t.sc, (800 - 16) / IH);
  close(t.tx, (1000 - IW * t.sc) / 2);
  close(t.ty, 8);
});

test('zoomAt keeps the point under the cursor fixed, within limits', () => {
  const t0 = fitTransform(1000, 800, IW, IH);
  const px = 400, py = 300;
  const ix = (px - t0.tx) / t0.sc, iy = (py - t0.ty) / t0.sc;
  const t1 = zoomAt(t0, 3, px, py, t0.sc, MAX_SCALE);
  close(t1.sc, t0.sc * 3);
  close(ix * t1.sc + t1.tx, px, 1e-6);
  close(iy * t1.sc + t1.ty, py, 1e-6);
  const t2 = zoomAt(t1, 1000, px, py, t0.sc, MAX_SCALE);          // limited by MAX_SCALE
  assert.equal(t2.sc, MAX_SCALE);
  close(ix * t2.sc + t2.tx, px, 1e-6);
  const t3 = zoomAt(t0, 0.01, px, py, t0.sc, MAX_SCALE);          // limited by minimum
  assert.equal(t3.sc, t0.sc);
});

test('clampTransform centres small images and bounds large ones', () => {
  const fit = fitTransform(1000, 800, IW, IH);
  const c = clampTransform({ sc: fit.sc, tx: 999, ty: -999 }, 1000, 800, IW, IH, fit.sc, MAX_SCALE);
  close(c.tx, fit.tx); close(c.ty, fit.ty);                         // fits: stays centred
  const big = clampTransform({ sc: 1, tx: 5000, ty: -99999 }, 1000, 800, IW, IH, fit.sc, MAX_SCALE);
  assert.equal(big.tx, 80);
  close(big.ty, 800 - IH - 80);
});

test('chooseLevel / maxLevel', () => {
  assert.equal(maxLevel(IW, IH), 5);                                // 7230/256 = 28.2 -> 2^5 = 32
  assert.equal(chooseLevel(1, 1, 5), 0);
  assert.equal(chooseLevel(0.5, 1, 5), 1);
  assert.equal(chooseLevel(0.26, 1, 5), 1);
  assert.equal(chooseLevel(0.24, 1, 5), 2);
  assert.equal(chooseLevel(0.5, 2, 5), 0);                          // retina needs denser tiles
  assert.equal(chooseLevel(0.001, 1, 5), 5);
  assert.equal(chooseLevel(2, 1, 5), 0);
});

test('visibleTiles cover exactly the visible part of the image', () => {
  // Level 0, scale 1, view 600x400 starting at image (300, 700)
  const t = { sc: 1, tx: -300, ty: -700 };
  const tiles = visibleTiles(t, 600, 400, IW, IH, 0);
  assert.deepEqual([tiles[0].i, tiles[0].j], [1, 2]);
  const is = new Set(tiles.map(x => x.i)), js = new Set(tiles.map(x => x.j));
  assert.deepEqual([...is], [1, 2, 3]);                              // x 300..900 -> tiles 1..3
  assert.deepEqual([...js], [2, 3, 4]);                              // y 700..1100 -> tiles 2..4
  assert.equal(tiles.length, 9);
  // right/bottom edge tiles are clipped to the image
  const last = visibleTiles({ sc: 1, tx: -(IW - 100), ty: -(IH - 100) }, 600, 400, IW, IH, 0).at(-1);
  assert.equal(last.x + last.w, IW);
  assert.equal(last.y + last.h, IH);
  assert.equal(last.outW, last.w);
  // level 2: each tile spans 1024 image pixels, requested at 256 px
  const l2 = visibleTiles({ sc: 0.25, tx: 0, ty: 0 }, 600, 400, IW, IH, 2);
  assert.equal(l2[0].w, 1024);
  assert.equal(l2[0].outW, 256);
  // fully off-screen -> no tiles
  assert.equal(visibleTiles({ sc: 1, tx: -IW - 500, ty: 0 }, 600, 400, IW, IH, 0).length, 0);
});

test('regions of interest keep their relative position under any transform', () => {
  const roi = { x: 0.0611, y: 0.2252, w: 0.4675, h: 0.0901 };
  const r = roiToRect(roi, IW, IH);
  close(r.x, 0.0611 * IW); close(r.h, 0.0901 * IH);
  for (const t of [fitTransform(1000, 800, IW, IH), { sc: 0.4, tx: -123, ty: -456 }, { sc: 1.5, tx: 17, ty: -9000 }]) {
    const a = imageToScreen(t, r.x, r.y), b = imageToScreen(t, r.x + r.w, r.y + r.h);
    // As a fraction of the displayed image, the rectangle is always the same
    close((a.x - t.tx) / (IW * t.sc), roi.x);
    close((a.y - t.ty) / (IH * t.sc), roi.y);
    close((b.x - a.x) / (IW * t.sc), roi.w);
    close((b.y - a.y) / (IH * t.sc), roi.h);
  }
});

// ---- real release ---------------------------------------------------------

import { existsSync, readFileSync } from 'node:fs';
const REAL = new URL('../scratch/hmt-current.cex', import.meta.url);
test('real release: DSE index and passage text', { skip: !existsSync(REAL) }, () => {
  const release = parseRelease(readFileSync(REAL, 'utf8'));
  const d = indexDse(release);
  assert.equal(d.found, true);
  assert.equal(d.rows, 26666);
  const va = [...d.byImage.entries()].filter(([k]) => k.startsWith('urn:cite2:hmt:vaimg.2017a:'));
  assert.equal(va.length, 631);
  assert.ok(va.length > 600 && va.length < 700, `${va.length} Venetus A images have regions`);
  assert.equal(d.byImage.get('urn:cite2:hmt:vaimg.2017a:VA012RN_0013').length, 48);
  assert.equal(d.skipped, 1);                       // the msA.v1:91r row, which has no region
  const idx = buildTextIndex(release);
  const kinds = { iliad: 0, scholia: 0, other: 0 }, missing = [];
  for (const [, list] of va) for (const r of list) {
    kinds[passageKind(r.passage)]++;
    if (passageText(idx, r.passage, 'diplomatic').parts.length === 0) missing.push(r.passage);
  }
  assert.ok(kinds.iliad > 15000 && kinds.scholia > 8000 && kinds.other > 0, JSON.stringify(kinds));
  assert.ok(missing.length < 150, `${missing.length} passages without text, e.g. ${missing.slice(0, 3)}`);
  assert.match(passageText(idx, 'urn:cts:greekLit:tlg0012.tlg001.msA:1.1', 'diplomatic').parts[0].text, /^Μῆνιν ἄειδε/);
});
