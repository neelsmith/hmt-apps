import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MIN_ROI, clamp01, fractionAt, roiFromCorners, moveRoi, resizeRoi, formatRoi, roiUrn, sameRoi } from '../src/roi.js';
import { parseRoi, parseImageRoi } from '../src/dse.js';
import { fitTransform, zoomAt, roiToRect } from '../src/pan-zoom.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

const roiClose = (a, b) => { for (const k of ['x', 'y', 'w', 'h']) close(a[k], b[k], 1e-12); };

test('fractionAt inverts the view transform and clamps to the image', () => {
  const t = { sc: 0.5, tx: 100, ty: 50 };               // a 2000 x 1000 image drawn at half size
  assert.deepEqual(fractionAt(t, 2000, 1000, 100, 50), { fx: 0, fy: 0 });
  assert.deepEqual(fractionAt(t, 2000, 1000, 1100, 550), { fx: 1, fy: 1 });
  const m = fractionAt(t, 2000, 1000, 600, 300);
  close(m.fx, 0.5); close(m.fy, 0.5);
  assert.deepEqual(fractionAt(t, 2000, 1000, -500, 9999), { fx: 0, fy: 1 }, 'outside the image');
});

test('a region keeps its place on the image through zoom and pan', () => {
  const W = 5428, H = 7230;
  let t = fitTransform(900, 700, W, H);
  const a = fractionAt(t, W, H, 300, 200), b = fractionAt(t, W, H, 450, 260);
  const r = roiFromCorners(a, b);
  const before = roiToRect(r, W, H);
  t = zoomAt(t, 3, 450, 350, t.sc, 1.5);
  t = { ...t, tx: t.tx - 40, ty: t.ty + 25 };            // and pan
  // the screen box of the region, then back to fractions, is the same region
  const s1 = { x: before.x * t.sc + t.tx, y: before.y * t.sc + t.ty }, s2 = { x: (before.x + before.w) * t.sc + t.tx, y: (before.y + before.h) * t.sc + t.ty };
  const back = roiFromCorners(fractionAt(t, W, H, s1.x, s1.y), fractionAt(t, W, H, s2.x, s2.y));
  for (const k of ['x', 'y', 'w', 'h']) close(back[k], r[k], 1e-9);
});

test('roiFromCorners: either order, too small is null', () => {
  roiClose(roiFromCorners({ fx: 0.5, fy: 0.6 }, { fx: 0.25, fy: 0.2 }), { x: 0.25, y: 0.2, w: 0.25, h: 0.4 });
  assert.equal(roiFromCorners({ fx: 0.1, fy: 0.1 }, { fx: 0.1, fy: 0.5 }), null, 'no width');
  assert.equal(roiFromCorners({ fx: 0.1, fy: 0.1 }, { fx: 0.1 + MIN_ROI / 2, fy: 0.5 }), null);
  assert.ok(roiFromCorners({ fx: 0.1, fy: 0.1 }, { fx: 0.1 + MIN_ROI * 2, fy: 0.5 }));
});

test('moveRoi stays inside the image', () => {
  const r = { x: 0.2, y: 0.2, w: 0.3, h: 0.1 };
  roiClose(moveRoi(r, 0.1, -0.05), { x: 0.3, y: 0.15, w: 0.3, h: 0.1 });
  assert.deepEqual(moveRoi(r, 5, 5), { x: 0.7, y: 0.9, w: 0.3, h: 0.1 });
  assert.deepEqual(moveRoi(r, -5, -5), { x: 0, y: 0, w: 0.3, h: 0.1 });
});

test('resizeRoi moves one corner and keeps the opposite one', () => {
  const r = { x: 0.2, y: 0.3, w: 0.2, h: 0.2 };
  roiClose(resizeRoi(r, 'se', 0.6, 0.7), { x: 0.2, y: 0.3, w: 0.4, h: 0.4 });
  const nw = resizeRoi(r, 'nw', 0.1, 0.1);
  close(nw.x, 0.1); close(nw.y, 0.1); close(nw.w, 0.3); close(nw.h, 0.4);
  const flipped = resizeRoi(r, 'se', 0.1, 0.1);           // dragged past the opposite corner
  close(flipped.x, 0.1); close(flipped.w, 0.1); close(flipped.y, 0.1); close(flipped.h, 0.2);
  assert.deepEqual(resizeRoi(r, 'se', 0.2, 0.7), r, 'collapsing it keeps the old one');
  roiClose(resizeRoi(r, 'se', 5, 5), { x: 0.2, y: 0.3, w: 0.8, h: 0.7 });
});

test('formatRoi, roiUrn and parsing them back', () => {
  const r = { x: 0.214, y: 0.5184, w: 0.171, h: 0.0225 };
  assert.equal(formatRoi(r), '0.2140,0.5184,0.1710,0.0225');
  const urn = 'urn:cite2:hmt:vaimg.2017a:VA051RN_0052';
  assert.equal(roiUrn(urn, r), `${urn}@0.2140,0.5184,0.1710,0.0225`);
  assert.equal(roiUrn(`${urn}@0.1,0.1,0.2,0.2`, r), `${urn}@0.2140,0.5184,0.1710,0.0225`, 'an existing region is replaced');
  const back = parseImageRoi(roiUrn(urn, r));
  assert.equal(back.image, urn);
  assert.deepEqual(back.roi, r);
  assert.deepEqual(parseRoi(formatRoi({ x: 1 / 3, y: 0, w: 2 / 3, h: 1 })), { x: 0.3333, y: 0, w: 0.6667, h: 1 });
  assert.ok(sameRoi(r, { x: 0.21400001, y: 0.5184, w: 0.171, h: 0.0225 }));
  assert.ok(!sameRoi(r, { ...r, w: 0.172 }));
  assert.equal(clamp01(-1), 0); assert.equal(clamp01(2), 1);
});
