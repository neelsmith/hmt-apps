// @ts-check
/**
 * Regions of interest on an image: rectangles kept as fractions of the whole image (0 to 1), so that they mean the
 * same part of the image at any size or zoom, and written as an extension of the image's CITE2 URN,
 * `urn:cite2:hmt:vaimg.2017a:VA051RN_0052@0.2140,0.5184,0.1710,0.0225` (`@x,y,w,h`).  Pure; the drawing and
 * the list of regions are in roi-tool.js and roi-panel.js.  Parsing a written region is `parseRoi` in dse.js.
 */

/** @typedef {{x: number, y: number, w: number, h: number}} Roi  Fractions of the image width and height. */
/** @typedef {{sc: number, tx: number, ty: number}} ViewTransform  Screen = image pixel * sc + (tx, ty); see pan-zoom.js. */
/** @typedef {'nw' | 'ne' | 'sw' | 'se'} Handle */

/** Smallest region kept, as a fraction of the width or height; smaller drags are ignored (they were clicks). */
export const MIN_ROI = 0.002;

/** @param {number} v */
export const clamp01 = v => Math.min(1, Math.max(0, v));

/**
 * The point of the image, as fractions, under a point of the screen (relative to the viewer); clamped to the image.
 * @param {ViewTransform} t
 * @param {number} imgW
 * @param {number} imgH
 * @param {number} sx
 * @param {number} sy
 * @returns {{fx: number, fy: number}}
 */
export function fractionAt(t, imgW, imgH, sx, sy) {
  return { fx: clamp01((sx - t.tx) / t.sc / imgW), fy: clamp01((sy - t.ty) / t.sc / imgH) };
}

/**
 * The rectangle between two corners, given in either order.
 * @param {{fx: number, fy: number}} a
 * @param {{fx: number, fy: number}} b
 * @returns {Roi | null}  Null if it is too small to be a region.
 */
export function roiFromCorners(a, b) {
  const x = Math.min(a.fx, b.fx), y = Math.min(a.fy, b.fy);
  const w = Math.abs(a.fx - b.fx), h = Math.abs(a.fy - b.fy);
  return w < MIN_ROI || h < MIN_ROI ? null : { x, y, w, h };
}

/**
 * Move a region by fractions of the image, keeping it inside the image.
 * @param {Roi} r
 * @param {number} dx
 * @param {number} dy
 * @returns {Roi}
 */
export function moveRoi(r, dx, dy) {
  return { ...r, x: Math.min(1 - r.w, Math.max(0, r.x + dx)), y: Math.min(1 - r.h, Math.max(0, r.y + dy)) };
}

/**
 * Drag one corner of a region to a point; the opposite corner stays where it is (and the region may be turned inside out).
 * @param {Roi} r
 * @param {Handle} handle
 * @param {number} fx
 * @param {number} fy
 * @returns {Roi}  The region unchanged if the result would be too small.
 */
export function resizeRoi(r, handle, fx, fy) {
  const fixed = { fx: handle.includes('w') ? r.x + r.w : r.x, fy: handle.includes('n') ? r.y + r.h : r.y };
  return roiFromCorners(fixed, { fx: clamp01(fx), fy: clamp01(fy) }) ?? r;
}

/**
 * `x,y,w,h` with four decimals (under half a pixel on a 4000-pixel image).
 * @param {Roi} r
 */
export function formatRoi(r) {
  return [r.x, r.y, r.w, r.h].map(v => v.toFixed(4)).join(',');
}

/**
 * The URN of a region: the image URN (without any region it already has) and `@x,y,w,h`.
 * @param {string} imageUrn
 * @param {Roi} r
 */
export function roiUrn(imageUrn, r) {
  return `${imageUrn.split('@')[0]}@${formatRoi(r)}`;
}

/**
 * Two regions as written the same?
 * @param {Roi} a
 * @param {Roi} b
 */
export function sameRoi(a, b) {
  return formatRoi(a) === formatRoi(b);
}
