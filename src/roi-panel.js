// @ts-check
/**
 * The regions of interest of the image in an `IiifViewer`: a Select button and a panel listing each region as a CITE2
 * URN with its `@x,y,w,h` extension, each with a Copy button.  Wraps the drawing tool (roi-tool.js).  Regions are kept
 * for each image while the page is open, so stepping away from an image and back finds them again.
 *
 * An app creates one `RoiUi` for its viewer, calls `open(imageUrn)` once the image is shown and `close()` when it is
 * not; `open` may be given regions to start with (e.g. from the address).
 */

import { RoiTool } from './roi-tool.js';
import { roiUrn, formatRoi } from './roi.js';

/**
 * Copy text to the clipboard; resolves to whether it worked.
 * @param {string} text
 */
export async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
  } catch (e) { /* fall through to the old way */ }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
  ta.remove();
  return ok;
}

/**
 * @param {string} tag
 * @param {string} [cls]
 * @param {string} [text]
 */
function roiEl(tag, cls = '', text = '') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

export class RoiUi {
  /**
   * @param {import('./image-viewer.js').IiifViewer} viewer
   * @param {{button: HTMLButtonElement, panel: HTMLElement}} els  The Select button, and the (empty) element for the list.
   */
  constructor(viewer, els) {
    this.button = els.button;
    this.panel = els.panel;
    this.urn = '';
    /** @type {Map<string, import('./roi.js').Roi[]>} */ this.byImage = new Map();
    this.tool = new RoiTool(viewer, () => this.changed());
    this.tool.onSelecting = on => {
      this.button.setAttribute('aria-pressed', String(on));
      this.button.classList.toggle('on', on);
      if (this.urn) this.show();   // the hint changes
    };
    this.button.type = 'button';
    this.button.setAttribute('aria-pressed', 'false');
    this.button.title = 'Mark regions of the image: drag to draw, or hold Shift and drag at any time';
    this.button.addEventListener('click', () => { if (this.urn) { this.tool.setSelecting(!this.tool.selecting); viewer.root.focus({ preventScroll: true }); } });
    this.close();
  }

  /**
   * Start working on an image.
   * @param {string} imageUrn  CITE2 URN of the image (a region on it is dropped from the URN).
   * @param {import('./roi.js').Roi[]} [start]  Regions to add to those already marked on this image.
   */
  open(imageUrn, start = []) {
    this.tool.setSelecting(false);
    this.urn = imageUrn.split('@')[0];
    this.button.disabled = false;
    this.tool.set(this.byImage.get(this.urn) ?? []);
    for (const r of start) this.tool.add(r);
    this.show();
  }

  /** The image is no longer shown. */
  close() {
    this.tool.setSelecting(false);
    this.urn = '';
    this.button.disabled = true;
    this.tool.set([]);
    this.panel.hidden = true;
    this.panel.textContent = '';
  }

  changed() {
    if (this.urn) this.byImage.set(this.urn, this.tool.list);
    this.show();
  }

  /** The URNs of the regions of the open image, in order. */
  get urns() { return this.tool.list.map(r => roiUrn(this.urn, r)); }

  show() {
    const p = this.panel;
    p.textContent = '';
    const rois = this.tool.list;
    p.hidden = !this.urn || rois.length === 0;
    if (p.hidden) return;
    const cur = this.tool.current;
    p.appendChild(roiEl('h2', 'roi-head', `Regions of interest (${rois.length})`));
    const ol = roiEl('ol', 'roi-list');
    rois.forEach((r, i) => {
      const urn = roiUrn(this.urn, r);
      const li = roiEl('li', i === cur ? 'current' : '');
      const num = /** @type {HTMLButtonElement} */ (roiEl('button', 'roi-num', String(i + 1)));
      num.type = 'button'; num.title = 'Make this the current region';
      num.addEventListener('click', () => this.tool.select(i));
      const code = roiEl('code', 'roi-urn', urn);
      code.title = `x,y,w,h = ${formatRoi(r)}, fractions of the image width and height`;
      const del = /** @type {HTMLButtonElement} */ (roiEl('button', 'roi-btn', '×'));
      del.type = 'button'; del.title = 'Remove this region'; del.setAttribute('aria-label', `Remove region ${i + 1}`);
      del.addEventListener('click', () => this.tool.remove(i));
      li.append(num, code, this.copyButton(urn, 'Copy this URN'), del);
      ol.appendChild(li);
    });
    p.appendChild(ol);
    const row = roiEl('div', 'roi-actions');
    if (rois.length > 1) row.appendChild(this.copyButton(this.urns.join('\n'), 'Copy every URN, one per line', 'Copy all'));
    const clear = /** @type {HTMLButtonElement} */ (roiEl('button', 'roi-btn', 'Clear all'));
    clear.type = 'button'; clear.title = 'Remove every region on this image';
    clear.addEventListener('click', () => this.tool.clear());
    row.appendChild(clear);
    p.appendChild(row);
    p.appendChild(roiEl('p', 'roi-hint', this.tool.selecting
      ? 'Select is on: drag a region to move it, drag a corner handle to resize it, click one to make it current; Delete removes it, Esc leaves Select.'
      : 'To move or resize a region, press Select, then drag it or its corner handles.'));
  }

  /**
   * @param {string} text
   * @param {string} title
   * @param {string} [label]
   */
  copyButton(text, title, label = 'Copy') {
    const b = /** @type {HTMLButtonElement} */ (roiEl('button', 'roi-btn roi-copy', label));
    b.type = 'button'; b.title = title;
    b.addEventListener('click', async () => {
      const ok = await copyToClipboard(text);
      b.textContent = ok ? 'Copied' : 'Copy failed';
      setTimeout(() => { b.textContent = label; }, 1800);
    });
    return b;
  }
}
