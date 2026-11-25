// @ts-check
/**
 * Drawing regions of interest on the image of an `IiifViewer` (image-viewer.js).  Shift-drag draws a rectangle at any
 * time; with Select on (a button for touch screens), a plain drag draws, a region can be dragged to move it or by its
 * corner handles to resize it, and clicking one makes it the current region.  Delete removes the current region;
 * Escape leaves Select.
 *
 * A region is kept as fractions of the whole image (roi.js) and redrawn whenever the view changes, so it always
 * bounds the same part of the image however it is panned or zoomed.  The rectangles are in a layer of the viewer
 * that follows its transform (`viewer.addLayer()`); labels and handles are redrawn at a fixed size on screen.
 */

import { fractionAt, roiFromCorners, moveRoi, resizeRoi, sameRoi } from './roi.js';

const ROI_SVG_NS = 'http://www.w3.org/2000/svg';
const ROI_HANDLES = /** @type {const} */ (['nw', 'ne', 'sw', 'se']);
const ROI_HANDLE_PX = 11;

/**
 * @param {string} tag
 * @param {Record<string, string | number>} attrs
 */
function roiSvgEl(tag, attrs) {
  const e = document.createElementNS(ROI_SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

export class RoiTool {
  /**
   * @param {import('./image-viewer.js').IiifViewer} viewer
   * @param {(rois: import('./roi.js').Roi[], current: number) => void} onChange  Called when the regions or the current one change.
   */
  constructor(viewer, onChange) {
    this.viewer = viewer;
    this.onChange = onChange;
    /** @type {import('./roi.js').Roi[]} */ this.rois = [];
    this.current = -1;
    this.selecting = false;
    this.shiftHeld = false;
    this.drawing = false;
    this.shiftDrawing = false;   // the drag in progress was started with Shift
    /** Called when Select is turned on or off.  @type {((on: boolean) => void) | null} */
    this.onSelecting = null;
    this.layer = viewer.addLayer();
    this.layer.classList.add('roi-layer');

    viewer.interceptPointer = e => this.pointerDown(e);
    const prev = viewer.onViewChange;
    viewer.onViewChange = t => { if (prev) prev(t); this.render(); };
    const root = viewer.root;
    root.addEventListener('keydown', e => { if (this.handleKey(e)) { e.preventDefault(); e.stopPropagation(); } });
    this.overViewer = false;
    root.addEventListener('pointerenter', e => { this.overViewer = true; this.setShift(e.shiftKey); this.updateCursor(); });
    root.addEventListener('pointerleave', () => { this.overViewer = false; this.updateCursor(); });
    root.addEventListener('pointermove', e => this.setShift(e.shiftKey));
    // Shift is noticed wherever the focus is, so the cursor is a crosshair as soon as Shift is down over the image
    window.addEventListener('keydown', e => { if (e.key === 'Shift') this.setShift(true); });
    window.addEventListener('keyup', e => { if (e.key === 'Shift') this.setShift(false); });
    window.addEventListener('blur', () => this.setShift(false));
  }

  /** A copy of the regions. */
  get list() { return this.rois.map(r => ({ ...r })); }

  /**
   * Replace all regions (on opening another image).
   * @param {import('./roi.js').Roi[]} rois
   * @param {boolean} [notify]
   */
  set(rois, notify = false) {
    this.rois = rois.map(r => ({ ...r }));
    this.current = this.rois.length ? this.rois.length - 1 : -1;
    this.render();
    if (notify) this.changed();
  }

  /** Add a region unless the same one is there; it becomes the current one. */
  add(/** @type {import('./roi.js').Roi} */ r) {
    const i = this.rois.findIndex(x => sameRoi(x, r));
    if (i >= 0) this.current = i;
    else { this.rois.push({ ...r }); this.current = this.rois.length - 1; }
    this.render();
    this.changed();
  }

  /** @param {boolean} on */
  setSelecting(on) {
    this.selecting = on;
    this.layer.classList.toggle('selecting', on);
    this.updateCursor();
    this.render();
    if (this.onSelecting) this.onSelecting(on);
  }

  /** @param {number} i */
  select(i) { this.current = i; this.render(); this.changed(); }

  /** @param {number} i */
  remove(i) {
    this.rois.splice(i, 1);
    this.current = Math.min(this.current, this.rois.length - 1);
    this.render();
    this.changed();
  }

  clear() { this.rois = []; this.current = -1; this.render(); this.changed(); }

  /**
   * Delete or Backspace removes the current region; Escape leaves Select.
   * @param {KeyboardEvent} e
   * @returns {boolean} True if the key was used.
   */
  handleKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    if ((e.key === 'Delete' || e.key === 'Backspace') && this.current >= 0) { this.remove(this.current); return true; }
    if (e.key === 'Escape' && this.selecting) { this.setSelecting(false); return true; }
    return false;
  }

  changed() { this.onChange(this.list, this.current); }

  /** @param {boolean} on */
  setShift(on) {
    if (on === this.shiftHeld) return;
    this.shiftHeld = on;
    this.updateCursor();
  }

  updateCursor() {
    const root = this.viewer.root;
    root.classList.toggle('roi-draw', this.shiftHeld || this.drawing || this.selecting);
    root.classList.toggle('roi-shift', (this.shiftHeld && this.overViewer) || this.shiftDrawing);
  }

  /** Draw the regions for the current view. */
  render() {
    const g = this.layer;
    g.textContent = '';
    const img = this.viewer.image;
    if (!img) return;
    const { sc } = this.viewer.t;
    const hs = ROI_HANDLE_PX / sc;
    this.rois.forEach((r, i) => {
      const x = r.x * img.width, y = r.y * img.height, w = r.w * img.width, h = r.h * img.height;
      const cur = i === this.current;
      const box = roiSvgEl('rect', { x, y, width: w, height: h, class: `user-roi${cur ? ' current' : ''}` });
      /** @type {SVGElement} */ (box).dataset.i = String(i);
      g.appendChild(box);
      const label = roiSvgEl('text', { x, y: y - 6 / sc, class: `user-roi-label${cur ? ' current' : ''}`, 'font-size': 15 / sc });
      label.textContent = String(i + 1);
      g.appendChild(label);
      if (this.selecting && cur) {
        for (const hd of ROI_HANDLES) {
          const hx = hd.includes('w') ? x : x + w, hy = hd.includes('n') ? y : y + h;
          const el = roiSvgEl('rect', { x: hx - hs / 2, y: hy - hs / 2, width: hs, height: hs, class: `user-roi-handle ${hd}` });
          /** @type {SVGElement} */ (el).dataset.handle = hd;
          /** @type {SVGElement} */ (el).dataset.i = String(i);
          g.appendChild(el);
        }
      }
    });
  }

  /** @param {{clientX: number, clientY: number}} e */
  fraction(e) {
    const img = /** @type {NonNullable<typeof this.viewer.image>} */ (this.viewer.image);
    const r = this.viewer.root.getBoundingClientRect();
    return fractionAt(this.viewer.t, img.width, img.height, e.clientX - r.left, e.clientY - r.top);
  }

  /**
   * Start of a drag in the viewer.
   * @param {PointerEvent} e
   * @returns {boolean} True if the tool takes the drag (the viewer then does not pan).
   */
  pointerDown(e) {
    if (!this.viewer.image || (e.pointerType === 'mouse' && e.button !== 0)) return false;
    const t = /** @type {Element} */ (e.target);
    const ds = /** @type {DOMStringMap} */ (t.closest ? (t.closest('[data-i]')?.dataset ?? {}) : {});
    const shift = e.shiftKey;
    const onHandle = !shift && this.selecting && !!ds.handle;
    const onBox = !shift && this.selecting && !onHandle && ds.i !== undefined && t.classList.contains('user-roi');
    if (!shift && !this.selecting) return false;
    e.preventDefault();
    e.stopPropagation();
    this.viewer.root.focus({ preventScroll: true });
    this.drawing = true;
    this.shiftDrawing = shift;
    this.updateCursor();
    const start = this.fraction(e);
    const i = Number(ds.i ?? -1);
    /** @type {(f: {fx: number, fy: number}) => void} */
    let op;
    if (onHandle) {
      const base = this.rois[i], h = /** @type {'nw'|'ne'|'sw'|'se'} */ (ds.handle);
      this.current = i;
      op = f => { this.rois[i] = resizeRoi(base, h, f.fx, f.fy); };
    } else if (onBox) {
      const base = this.rois[i];
      this.current = i;
      op = f => { this.rois[i] = moveRoi(base, f.fx - start.fx, f.fy - start.fy); };
    } else {
      let idx = -1;
      op = f => {
        const r = roiFromCorners(start, f);
        if (!r) return;
        if (idx < 0) { this.rois.push(r); idx = this.rois.length - 1; this.current = idx; }
        else this.rois[idx] = r;
      };
    }
    let moved = false;
    const move = (/** @type {PointerEvent} */ ev) => { moved = true; op(this.fraction(ev)); this.render(); };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      this.drawing = false;
      this.shiftDrawing = false;
      this.updateCursor();
      // like a pan: let the click that ends the drag pass before hover and click handlers act again
      this.viewer.dragging = true;
      setTimeout(() => { this.viewer.dragging = false; }, 0);
      if (!moved && (onBox || onHandle)) this.current = i;
      this.render();
      this.changed();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    this.render();
    return true;
  }
}
