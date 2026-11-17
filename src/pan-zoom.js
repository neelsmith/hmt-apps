// @ts-check
/**
 * Geometry for a pannable, zoomable, tiled image view.  Pure functions.
 *
 * A view transform maps image pixels to screen (CSS) pixels:
 *     screen = image * sc + (tx, ty)
 * Anything drawn in image coordinates under this transform, including
 * overlay rectangles, keeps its position relative to the image.
 */

/** Largest zoom: CSS pixels per image pixel. */
export const MAX_SCALE = 1.5;

/** Tile size (output pixels) requested from the image server. */
export const TILE = 256;

/** @typedef {{sc: number, tx: number, ty: number}} Transform */

/**
 * Transform that fits the whole image in the view, centred.
 * @returns {Transform}
 */
export function fitTransform(viewW, viewH, imgW, imgH, margin = 8) {
  const sc = Math.min((viewW - 2 * margin) / imgW, (viewH - 2 * margin) / imgH);
  return { sc, tx: (viewW - imgW * sc) / 2, ty: (viewH - imgH * sc) / 2 };
}

const clamp = (/** @type {number} */ v, /** @type {number} */ lo, /** @type {number} */ hi) => Math.min(hi, Math.max(lo, v));

/**
 * Keep the scale in range and the image on screen: an image smaller than
 * the view is centred; a larger one may be dragged until only `slack` pixels
 * of it remain beyond an edge.
 * @param {Transform} t
 * @returns {Transform}
 */
export function clampTransform(t, viewW, viewH, imgW, imgH, minScale, maxScale, slack = 80) {
  const sc = clamp(t.sc, minScale, maxScale);
  const w = imgW * sc, h = imgH * sc;
  const tx = w <= viewW ? (viewW - w) / 2 : clamp(t.tx, viewW - w - slack, slack);
  const ty = h <= viewH ? (viewH - h) / 2 : clamp(t.ty, viewH - h - slack, slack);
  return { sc, tx, ty };
}

/**
 * Zoom by `factor` keeping the image point under screen point (px, py) fixed.
 * The resulting scale is limited to [minScale, maxScale].
 * @param {Transform} t
 * @returns {Transform}
 */
export function zoomAt(t, factor, px, py, minScale, maxScale) {
  const sc = clamp(t.sc * factor, minScale, maxScale);
  const f = sc / t.sc;
  return { sc, tx: px - (px - t.tx) * f, ty: py - (py - t.ty) * f };
}

/** Number of zoom levels above full resolution needed for the whole image to fit one tile. */
export function maxLevel(imgW, imgH, tile = TILE) {
  return Math.max(0, Math.ceil(Math.log2(Math.max(imgW, imgH) / tile)));
}

/**
 * Tile level for a scale: level k tiles show 2^k image pixels per tile pixel.
 * The level is chosen so tile pixels are at least as dense as device pixels.
 */
export function chooseLevel(scale, dpr, maxLvl) {
  const f = 1 / (scale * dpr);
  return clamp(Math.floor(Math.log2(f) + 1e-9), 0, maxLvl);
}

/**
 * @typedef {Object} Tile
 * @property {number} level
 * @property {number} i
 * @property {number} j
 * @property {number} x      Left edge in image pixels.
 * @property {number} y
 * @property {number} w      Width in image pixels (smaller at the right edge).
 * @property {number} h
 * @property {number} outW   Width to request, in output pixels.
 */

/**
 * Tiles of one level that intersect the view.
 * @param {Transform} t
 * @returns {Tile[]}
 */
export function visibleTiles(t, viewW, viewH, imgW, imgH, level, tile = TILE) {
  const span = tile * 2 ** level;
  const ix0 = -t.tx / t.sc, iy0 = -t.ty / t.sc;
  const ix1 = (viewW - t.tx) / t.sc, iy1 = (viewH - t.ty) / t.sc;
  const cols = Math.ceil(imgW / span), rows = Math.ceil(imgH / span);
  const i0 = clamp(Math.floor(ix0 / span), 0, cols - 1), i1 = clamp(Math.floor(ix1 / span), 0, cols - 1);
  const j0 = clamp(Math.floor(iy0 / span), 0, rows - 1), j1 = clamp(Math.floor(iy1 / span), 0, rows - 1);
  /** @type {Tile[]} */
  const out = [];
  if (ix1 < 0 || iy1 < 0 || ix0 > imgW || iy0 > imgH) return out;
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const x = i * span, y = j * span;
      const w = Math.min(span, imgW - x), h = Math.min(span, imgH - y);
      out.push({ level, i, j, x, y, w, h, outW: Math.max(1, Math.round(w / 2 ** level)) });
    }
  }
  return out;
}

/**
 * A region of interest (fractions of the image) in image pixels.
 * @param {{x: number, y: number, w: number, h: number}} roi
 */
export function roiToRect(roi, imgW, imgH) {
  return { x: roi.x * imgW, y: roi.y * imgH, w: roi.w * imgW, h: roi.h * imgH };
}

/** Screen position of an image point under a transform. */
export function imageToScreen(t, x, y) {
  return { x: x * t.sc + t.tx, y: y * t.sc + t.ty };
}
