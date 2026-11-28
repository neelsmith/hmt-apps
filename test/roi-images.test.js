import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRelease } from '../src/hmt-release.js';
import { roisByPassage, regionRequest, imageRoiLink } from '../src/roi-images.js';

const T = 'urn:cts:greekLit:tlg0012.tlg001.msA';
const S = 'urn:cts:greekLit:tlg5026.msA.hmt';
const CEX = `#!citerelationset
urn|urn:cite2:hmt:hmtdse.v1:all
label|DSE
passage|imageroi|surface
${T}.normalized:1.1|urn:cite2:hmt:vaimg.2017a:VA001RN_0001@0.1,0.2,0.5,0.05|urn:cite2:hmt:msA.v1:1r
${S}.normalized:1.1.comment|urn:cite2:hmt:vaimg.2017a:VA001RN_0001@0.6,0.2,0.2,0.1|urn:cite2:hmt:msA.v1:1r
${S}.diplomatic:1.1.lemma|urn:cite2:hmt:vaimg.2017a:VA001RN_0001@0.7,0.3,0.1,0.1|urn:cite2:hmt:msA.v1:1r
${T}.normalized:1.2|nonsense|urn:cite2:hmt:msA.v1:1r
`;

test('roisByPassage: regions by passage key; lemma and comment of a scholion share one key', () => {
  const m = roisByPassage(parseRelease(CEX));
  assert.deepEqual(m.get(`${T}:1.1`), [{ image: 'urn:cite2:hmt:vaimg.2017a:VA001RN_0001', roi: { x: 0.1, y: 0.2, w: 0.5, h: 0.05 } }]);
  assert.equal(m.get(`${S}:1.1`).length, 2);
  assert.equal(m.has(`${T}:1.2`), false);   // no usable region
});

test('roisByPassage: no DSE in the release', () => {
  assert.equal(roisByPassage(parseRelease('#!ctscatalog\nurn|x\n')).size, 0);
});

test('regionRequest: pixels with the image size, percentages without', () => {
  assert.deepEqual(regionRequest({ x: 0.1, y: 0.2, w: 0.5, h: 0.05 }, { width: 4000, height: 6000 }), { region: '400,1200,2000,300', size: '1200,' });
  assert.deepEqual(regionRequest({ x: 0.1, y: 0.2, w: 0.1, h: 0.05 }, { width: 4000, height: 6000 }), { region: '400,1200,400,300', size: '400,' });
  assert.deepEqual(regionRequest({ x: 0.1, y: 0.2, w: 0.5, h: 0.05 }, null), { region: 'pct:10,20,50,5', size: '1200,' });
  // never past the edge
  assert.deepEqual(regionRequest({ x: 0.9, y: 0, w: 0.5, h: 1 }, { width: 100, height: 100 }), { region: '90,0,10,100', size: '10,' });
});

test('imageRoiLink: images app, image URN with its region as the image parameter', () => {
  const u = imageRoiLink('urn:cite2:hmt:vaimg.2017a:VA001RN_0001', { x: 0.1, y: 0.2, w: 0.5, h: 0.05 });
  assert.match(u, /^https:\/\/neelsmith\.github\.io\/hmt-apps\/images\.html\?image=/);
  const q = new URL(u).searchParams.get('image');
  assert.equal(q, 'urn:cite2:hmt:vaimg.2017a:VA001RN_0001@0.1,0.2,0.5,0.05');
});
