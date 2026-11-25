// @ts-check
/**
 * A pannable, zoomable viewer for one IIIF image, drawn on a canvas from
 * tiles requested with IIIF region/size URLs.  Overlay shapes go in an SVG
 * group (`viewer.overlay`) in IMAGE pixel coordinates; the viewer applies the
 * same transform to the canvas and the group, so overlays stay registered with
 * the image however it is panned or zoomed.
 *
 * Needs no libraries.  Geometry lives in pan-zoom.js (loaded before this file
 * when inlined).  Browser only.
 *
 * Controls: drag to pan, wheel / pinch / double-click to zoom, + - 0 and arrow
 * keys when the viewer has focus.
 */

import { fitTransform, clampTransform, zoomAt, maxLevel, chooseLevel, visibleTiles, imageToScreen, MAX_SCALE } from './pan-zoom.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const MAX_INFLIGHT = 6;
const MAX_CACHED_TILES = 300;
const RETRY_MS = 10000;
const BASE_WIDTH = 1000;

/**
 * @typedef {Object} OpenOptions
 * @property {number} width    Image width in pixels.
 * @property {number} height   Image height in pixels.
 * @property {(region: string, size: string) => string} urlFor  Image URL for an IIIF region and size.
 * @property {string[]} [placeholders]  Small images (e.g. a thumbnail) to show until tiles load.
 */

export class IiifViewer {
  /** @param {HTMLElement} root  Positioned element that will hold the viewer. */
  constructor(root) {
    this.root = root;
    root.classList.add('iiif-viewer');
    root.tabIndex = 0;
    root.style.touchAction = 'none';
    root.style.overflow = 'hidden';
    if (getComputedStyle(root).position === 'static') root.style.position = 'relative';

    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    this.svg = /** @type {SVGSVGElement} */ (document.createElementNS(SVG_NS, 'svg'));
    this.svg.setAttribute('class', 'iiif-overlay');
    this.svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;overflow:hidden';
    /** Group for overlay shapes, in image pixel coordinates. */
    this.overlay = /** @type {SVGGElement} */ (document.createElementNS(SVG_NS, 'g'));
    this.svg.appendChild(this.overlay);
    /** Further groups in image pixel coordinates that follow the transform and are not cleared when an image is opened. @type {SVGGElement[]} */
    this.layers_ = [];
    root.append(this.canvas, this.svg);
    this.ctx = /** @type {CanvasRenderingContext2D} */ (this.canvas.getContext('2d'));

    /** @type {OpenOptions | null} */ this.image = null;
    this.t = { sc: 1, tx: 0, ty: 0 };
    this.minScale = 0.01;
    this.gen = 0;
    /**
     * Called first for the pointer that starts a drag, when no other pointer is down; if it returns true the viewer
     * does not pan.  For tools that draw on the image (see roi-tool.js).
     * @type {((e: PointerEvent) => boolean) | null}
     */
    this.interceptPointer = null;
    /** Called with the transform whenever the view changes.  @type {((t: {sc: number, tx: number, ty: number}) => void) | null} */
    this.onViewChange = null;
    /** True while the pointer is being dragged to pan; hover handlers should ignore events then. */
    this.dragging = false;
    /** @type {Map<number, {x: number, y: number}>} */ this.pointers = new Map();
    this.pinchDist = 0;
    this.downAt = { x: 0, y: 0 };
    this.moved = false;
    /** @type {HTMLImageElement[]} */ this.layers = [];
    /** @type {Map<string, {img: HTMLImageElement, state: string, at: number}>} */ this.tiles = new Map();
    /** @type {{key: string, tile: any}[]} */ this.wanted = [];
    this.inflight = 0;
    this.raf = 0;
    this.size = { w: 0, h: 0, dpr: 1 };

    this.ro = new ResizeObserver(() => this.onResize());
    this.ro.observe(root);
    this.bind();
  }

  /**
   * A group for shapes in image pixel coordinates, above the overlay; it follows the transform and is left alone when
   * an image is opened or closed.
   * @returns {SVGGElement}
   */
  addLayer() {
    const g = /** @type {SVGGElement} */ (document.createElementNS(SVG_NS, 'g'));
    g.setAttribute('transform', `translate(${this.t.tx} ${this.t.ty}) scale(${this.t.sc})`);
    this.svg.appendChild(g);
    this.layers_.push(g);
    return g;
  }

  /** Show an image, fitted to the view. */
  open(/** @type {OpenOptions} */ image) {
    this.gen++;
    this.image = image;
    this.tiles.clear();
    this.wanted = [];
    this.inflight = 0;
    this.layers = [];
    this.overlay.textContent = '';
    for (const url of [...(image.placeholders ?? []), image.urlFor('full', `${BASE_WIDTH},`)]) {
      const gen = this.gen;
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => { if (gen === this.gen) { this.layers.push(img); this.schedule(); } };
      img.src = url;
    }
    this.measure();
    this.fit();
  }

  /** Stop showing the image and drop pending work. */
  close() {
    this.gen++;
    this.image = null;
    this.tiles.clear();
    this.wanted = [];
    this.layers = [];
    this.overlay.textContent = '';
    this.draw();
  }

  /** Fit the whole image in the view. */
  fit() {
    if (!this.image) return;
    const { w, h } = this.measure();
    const t = fitTransform(w, h, this.image.width, this.image.height);
    this.minScale = t.sc;
    this.set(t);
  }

  /** Zoom by a factor around the view centre (or a given screen point). */
  zoomBy(/** @type {number} */ factor, /** @type {number} */ px = this.size.w / 2, /** @type {number} */ py = this.size.h / 2) {
    this.set(zoomAt(this.t, factor, px, py, this.minScale, MAX_SCALE));
  }

  /** Pan by screen pixels. */
  panBy(/** @type {number} */ dx, /** @type {number} */ dy) {
    this.set({ sc: this.t.sc, tx: this.t.tx + dx, ty: this.t.ty + dy });
  }

  /** Screen point (relative to the viewer) of an image point. */
  toScreen(/** @type {number} */ x, /** @type {number} */ y) {
    return imageToScreen(this.t, x, y);
  }

  destroy() {
    this.ro.disconnect();
    cancelAnimationFrame(this.raf);
    this.root.textContent = '';
  }

  // --- internals -----------------------------------------------------------

  measure() {
    const r = this.root.getBoundingClientRect();
    this.size.w = r.width;
    this.size.h = r.height;
    this.size.dpr = window.devicePixelRatio || 1;
    return this.size;
  }

  onResize() {
    const before = { w: this.size.w, h: this.size.h };
    this.measure();
    if (!this.image) return;
    const atFit = Math.abs(this.t.sc - this.minScale) < 1e-9;
    const fitNow = fitTransform(this.size.w, this.size.h, this.image.width, this.image.height);
    this.minScale = fitNow.sc;
    if (atFit || before.w === 0) this.set(fitNow);
    else this.set(this.t);
  }

  set(/** @type {{sc: number, tx: number, ty: number}} */ t) {
    if (!this.image) { this.t = t; return; }
    this.t = clampTransform(t, this.size.w, this.size.h, this.image.width, this.image.height, this.minScale, MAX_SCALE);
    const tf = `translate(${this.t.tx} ${this.t.ty}) scale(${this.t.sc})`;
    this.overlay.setAttribute('transform', tf);
    for (const g of this.layers_) g.setAttribute('transform', tf);
    if (this.onViewChange) this.onViewChange(this.t);
    this.schedule();
  }

  schedule() {
    if (!this.raf) this.raf = requestAnimationFrame(() => { this.raf = 0; this.draw(); });
  }

  draw() {
    const { w, h, dpr } = this.size;
    const cw = Math.round(w * dpr), ch = Math.round(h * dpr);
    if (this.canvas.width !== cw || this.canvas.height !== ch) { this.canvas.width = cw; this.canvas.height = ch; }
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    if (!this.image) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const { sc, tx, ty } = this.t;
    const { width: W, height: H } = this.image;

    for (const img of this.layers) ctx.drawImage(img, tx, ty, W * sc, H * sc);

    const level = chooseLevel(sc, dpr, maxLevel(W, H));
    const tiles = visibleTiles(this.t, w, h, W, H, level);
    /** @type {{key: string, tile: any}[]} */
    const wanted = [];
    const now = Date.now();
    for (const tile of tiles) {
      const key = `${tile.level}/${tile.i}/${tile.j}`;
      const entry = this.tiles.get(key);
      if (entry && entry.state === 'loaded') {
        ctx.drawImage(entry.img, tx + tile.x * sc, ty + tile.y * sc, tile.w * sc, tile.h * sc);
        this.tiles.delete(key); this.tiles.set(key, entry);      // mark recently used
      } else if (!entry || (entry.state === 'error' && now - entry.at > RETRY_MS)) {
        wanted.push({ key, tile });
      }
    }
    const cx = (w / 2 - tx) / sc, cy = (h / 2 - ty) / sc;
    wanted.sort((a, b) =>
      Math.hypot(a.tile.x + a.tile.w / 2 - cx, a.tile.y + a.tile.h / 2 - cy) -
      Math.hypot(b.tile.x + b.tile.w / 2 - cx, b.tile.y + b.tile.h / 2 - cy));
    this.wanted = wanted;
    this.pump();
  }

  pump() {
    const image = this.image;
    if (!image) return;
    while (this.inflight < MAX_INFLIGHT && this.wanted.length) {
      const next = this.wanted.shift();
      if (!next) break;
      const { key, tile } = next;
      if (this.tiles.get(key)?.state === 'loading') continue;
      const img = new Image();
      const entry = { img, state: 'loading', at: Date.now() };
      this.tiles.set(key, entry);
      const gen = this.gen;
      this.inflight++;
      const done = (/** @type {string} */ state) => {
        if (gen !== this.gen) return;
        this.inflight--;
        entry.state = state; entry.at = Date.now();
        this.evict();
        this.schedule();
      };
      img.onload = () => done('loaded');
      img.onerror = () => done('error');
      img.decoding = 'async';
      img.src = image.urlFor(`${tile.x},${tile.y},${tile.w},${tile.h}`, `${tile.outW},`);
    }
  }

  evict() {
    if (this.tiles.size <= MAX_CACHED_TILES) return;
    for (const [key, entry] of this.tiles) {
      if (this.tiles.size <= MAX_CACHED_TILES) break;
      if (entry.state !== 'loading') this.tiles.delete(key);
    }
  }

  bind() {
    const root = this.root;
    const local = (/** @type {MouseEvent} */ e) => {
      const r = root.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    root.addEventListener('pointerdown', e => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      if (this.image && this.pointers.size === 0 && this.interceptPointer && this.interceptPointer(e)) return;
      root.setPointerCapture(e.pointerId);
      const p = local(e);
      this.pointers.set(e.pointerId, p);
      if (this.pointers.size === 1) { this.downAt = p; this.moved = false; }
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
        this.moved = true;
      }
    });

    root.addEventListener('pointermove', e => {
      const prev = this.pointers.get(e.pointerId);
      if (!prev) return;
      const p = local(e);
      this.pointers.set(e.pointerId, p);
      if (this.pointers.size === 1) {
        if (!this.moved && Math.hypot(p.x - this.downAt.x, p.y - this.downAt.y) < 4) return;
        this.moved = true;
        this.dragging = true;
        root.classList.add('dragging');
        this.panBy(p.x - prev.x, p.y - prev.y);
      } else if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinchDist > 0) this.zoomBy(dist / this.pinchDist, (a.x + b.x) / 2, (a.y + b.y) / 2);
        this.pinchDist = dist;
        this.dragging = true;
      }
    });

    const up = (/** @type {PointerEvent} */ e) => {
      if (!this.pointers.delete(e.pointerId)) return;
      if (this.pointers.size === 0) {
        // Clear after the click that ends a drag has been dispatched.
        setTimeout(() => { this.dragging = false; root.classList.remove('dragging'); }, 0);
      }
      this.pinchDist = 0;
    };
    root.addEventListener('pointerup', up);
    root.addEventListener('pointercancel', up);

    root.addEventListener('wheel', e => {
      e.preventDefault();
      const p = local(e);
      this.zoomBy(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), p.x, p.y);
    }, { passive: false });

    root.addEventListener('dblclick', e => {
      const p = local(e);
      this.zoomBy(e.shiftKey ? 0.5 : 2, p.x, p.y);
    });

    root.addEventListener('keydown', e => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const step = 80;
      const handled = {
        '+': () => this.zoomBy(1.4), '=': () => this.zoomBy(1.4), '-': () => this.zoomBy(1 / 1.4), '_': () => this.zoomBy(1 / 1.4),
        '0': () => this.fit(),
        ArrowLeft: () => this.panBy(step, 0), ArrowRight: () => this.panBy(-step, 0),
        ArrowUp: () => this.panBy(0, step), ArrowDown: () => this.panBy(0, -step),
      }[e.key];
      if (handled) { e.preventDefault(); handled(); }
    });
  }
}
