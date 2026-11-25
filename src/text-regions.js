// @ts-check
/**
 * The indexed text of an image, on an `IiifViewer`: a rectangle over each region the DSE records index to the open
 * image (coloured for the Iliad, scholia and other texts, and switched on and off by checkboxes), the diplomatic text of
 * the passage in a tooltip when the pointer is over it, and a click that copies the passage URN and its text.
 *
 * Needs the release's DSE index (`indexDse`), text index (`buildTextIndex`) and catalog titles (`catalogTitles`), the
 * viewer's overlay (`viewer.overlay`, in image pixel coordinates), and in the page a `#tip` and a `#copied` element
 * inside the viewer's wrapper (see text-regions.css).  The rectangles carry the passage as `data-passage`.
 */

import { passageKind, passageLabel } from './dse.js';
import { passageText } from './text-index.js';
import { roiToRect } from './pan-zoom.js';
import { copyToClipboard } from './roi-panel.js';

const TR_NS = 'http://www.w3.org/2000/svg';
const TR_KINDS = /** @type {const} */ (['iliad', 'scholia', 'other']);
const TR_TIP_MAX_CHARS = 700;
const TR_TIP_MAX_ITEMS = 4;

export class TextRegions {
  /**
   * @param {import('./image-viewer.js').IiifViewer} viewer
   * @param {{tip: HTMLElement, copied: HTMLElement, wrap: HTMLElement, checks: Record<'iliad' | 'scholia' | 'other', HTMLInputElement>, onShown?: (n: number) => void}} els
   */
  constructor(viewer, els) {
    this.viewer = viewer;
    this.els = els;
    /** @type {Map<string, {passage: string, roi: import('./dse.js').Roi}[]>} */ this.byImage = new Map();
    /** @type {Map<string, any>} */ this.textIndex = new Map();
    /** @type {Map<string, string>} */ this.titles = new Map();
    this.lastTipKey = '';
    this.toastTimer = 0;
    viewer.overlay.id = 'rois';
    for (const k of TR_KINDS) els.checks[k].addEventListener('change', () => this.applyLayers());
    this.bind();
  }

  /**
   * @param {{byImage: Map<string, {passage: string, roi: import('./dse.js').Roi}[]>, textIndex: Map<string, any>, titles: Map<string, string>}} data
   */
  setData(data) {
    this.byImage = data.byImage;
    this.textIndex = data.textIndex;
    this.titles = data.titles;
  }

  /** Number of indexed regions of an image. @param {string} imageUrn */
  count(imageUrn) { return (this.byImage.get(imageUrn) ?? []).length; }

  /**
   * Draw the regions of an image that is open in the viewer.
   * @param {string} imageUrn
   * @param {number} width   Image width in pixels.
   * @param {number} height
   * @returns {number} How many regions were drawn.
   */
  show(imageUrn, width, height) {
    const regions = this.byImage.get(imageUrn) ?? [];
    const overlay = this.viewer.overlay;
    overlay.textContent = '';
    const frag = document.createDocumentFragment();
    for (const r of regions) {
      const rect = document.createElementNS(TR_NS, 'rect');
      const p = roiToRect(r.roi, width, height);
      rect.setAttribute('x', String(p.x)); rect.setAttribute('y', String(p.y));
      rect.setAttribute('width', String(p.w)); rect.setAttribute('height', String(p.h));
      rect.setAttribute('class', `roi ${passageKind(r.passage)}`);
      /** @type {SVGElement} */ (rect).dataset.passage = r.passage;
      frag.appendChild(rect);
    }
    overlay.appendChild(frag);
    this.applyLayers();
    if (this.els.onShown) this.els.onShown(regions.length);
    return regions.length;
  }

  /** The image is no longer shown. */
  clear() {
    this.viewer.overlay.textContent = '';
    this.hideTip();
    if (this.els.onShown) this.els.onShown(0);
  }

  applyLayers() {
    for (const k of TR_KINDS) this.viewer.overlay.classList.toggle(`hide-${k}`, !this.els.checks[k].checked);
    this.hideTip();
  }

  hideTip() {
    this.els.tip.hidden = true;
    this.lastTipKey = '';
    for (const el of this.viewer.overlay.querySelectorAll('.hot')) el.classList.remove('hot');
  }

  /** @param {string} passage */
  tipItem(passage) {
    const div = document.createElement('div');
    div.className = 'item';
    const what = document.createElement('div');
    what.className = 'what';
    const b = document.createElement('b');
    b.textContent = passageLabel(passage, this.titles);
    what.appendChild(b);
    div.appendChild(what);
    const body = document.createElement('div');
    body.className = 'greek'; body.lang = 'grc';
    const { parts } = passageText(this.textIndex, passage, 'diplomatic');
    if (!parts.length) {
      body.className = 'none';
      body.textContent = 'Text not available in this release.';
    } else {
      let remaining = TR_TIP_MAX_CHARS;
      for (const p of parts) {
        if (remaining <= 0) break;
        const text = p.text.length > remaining ? p.text.slice(0, remaining) + '…' : p.text;
        remaining -= text.length;
        const span = document.createElement('span');
        if (p.part === 'lemma') span.className = 'lemma';
        span.textContent = text;
        if (body.childNodes.length) body.append(' ');
        body.appendChild(span);
      }
    }
    div.appendChild(body);
    return div;
  }

  /** The indexed regions under a point of the screen, topmost first.  @param {number} x @param {number} y */
  regionsAt(x, y) {
    return /** @type {SVGElement[]} */ (document.elementsFromPoint(x, y).filter(el => el.classList && el.classList.contains('roi')));
  }

  /** @param {number} clientX @param {number} clientY */
  showTipAt(clientX, clientY) {
    const els = this.regionsAt(clientX, clientY);
    const tip = this.els.tip;
    if (!els.length) { this.hideTip(); return; }
    const key = els.map(el => el.dataset.passage).join('\n');
    if (key !== this.lastTipKey) {
      this.lastTipKey = key;
      for (const el of this.viewer.overlay.querySelectorAll('.hot')) el.classList.remove('hot');
      for (const el of els) el.classList.add('hot');
      tip.textContent = '';
      for (const el of els.slice(0, TR_TIP_MAX_ITEMS)) tip.appendChild(this.tipItem(/** @type {string} */ (el.dataset.passage)));
      if (els.length > TR_TIP_MAX_ITEMS) {
        const more = document.createElement('div');
        more.className = 'what'; more.textContent = `+ ${els.length - TR_TIP_MAX_ITEMS} more here`;
        tip.appendChild(more);
      }
    }
    tip.hidden = false;
    const wrap = this.els.wrap.getBoundingClientRect();
    const x0 = clientX - wrap.left, y0 = clientY - wrap.top;
    let x = x0 + 14, y = y0 + 18;
    if (x + tip.offsetWidth > wrap.width - 4) x = x0 - 14 - tip.offsetWidth;
    if (y + tip.offsetHeight > wrap.height - 4) y = y0 - 14 - tip.offsetHeight;
    tip.style.left = Math.max(4, x) + 'px';
    tip.style.top = Math.max(4, y) + 'px';
  }

  /** @param {string} msg @param {boolean} [bad] */
  toast(msg, bad = false) {
    const t = this.els.copied;
    t.textContent = msg;
    t.classList.toggle('bad', bad);
    t.hidden = false;
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => { t.hidden = true; }, 2200);
  }

  /** Copy the passage URN and the diplomatic text of the topmost region under the pointer.  @param {number} clientX @param {number} clientY */
  async copyAt(clientX, clientY) {
    const el = this.regionsAt(clientX, clientY)[0];
    if (!el) return;
    const passage = /** @type {string} */ (el.dataset.passage);
    const label = passageLabel(passage, this.titles);
    const text = passageText(this.textIndex, passage, 'diplomatic').parts.map(p => p.text).join(' ');
    if (!text) { this.toast(`No text of ${label} in this release`, true); return; }
    this.toast((await copyToClipboard(`${passage}\n${text}`)) ? `Copied the URN and text of ${label} to the clipboard` : `Could not copy ${label}`);
  }

  bind() {
    const root = this.viewer.root, v = this.viewer;
    /** @type {PointerEvent | null} */
    let pending = null;
    root.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse' || v.dragging) return;
      pending = e;
      requestAnimationFrame(() => { if (pending) { this.showTipAt(pending.clientX, pending.clientY); pending = null; } });
    });
    root.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { pending = null; this.hideTip(); } });
    root.addEventListener('pointerdown', () => { if (v.pointers.size === 0) this.els.tip.hidden = true; });
    root.addEventListener('click', e => {
      if (v.dragging) return;
      if (e.target instanceof Element && e.target.closest('.roi-layer')) return;   // a region of interest of your own
      if (e.pointerType !== 'mouse') this.showTipAt(e.clientX, e.clientY);   // touch has no hover: a tap shows the text too
      this.copyAt(e.clientX, e.clientY);
    });
    root.addEventListener('wheel', () => this.hideTip(), { passive: true });
  }
}
